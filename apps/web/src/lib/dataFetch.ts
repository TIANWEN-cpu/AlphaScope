/**
 * Shared data-fetching helpers for the demonstrative modules
 * (Backtesting / EvidenceChain / FundDcaLab / AgentsSystem).
 *
 * These mirror the proven idioms already used by Workbench.tsx and
 * ReportGenerator.tsx without mutating those healthy components.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';
import { fetchApi } from './api';
import {
  getTaskEventsUrl,
  getTaskResult,
  getTaskStatus,
  startAsyncAnalysis,
} from './analysisAdapter';
import type { AnalysisResult } from '../types';

// ------------------------------------------------------------------
// Pure helpers (copied from Workbench.tsx so new modules can share them)
// ------------------------------------------------------------------

/** Strip the `.SH`/`.SZ`/`.BJ`/`.HK` suffix from a symbol for API paths. */
export function stripSymbolSuffix(symbol: string): string {
  return String(symbol || '').trim().split('.')[0];
}

/** Normalize an unknown thrown value into a human-readable message. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || '未知错误');
}

/** Map a backend `source_status`/`degraded` pair to a short Chinese label. */
export function sourceStatusLabel(sourceStatus?: string, degraded?: boolean): string {
  if (degraded) {
    if (sourceStatus === 'cache') return '缓存数据';
    if (sourceStatus === 'timeout') return '数据源超时';
    if (sourceStatus === 'empty') return '暂无数据';
    if (sourceStatus === 'unavailable') return '数据源不可用';
    return `降级：${sourceStatus || 'unknown'}`;
  }
  if (!sourceStatus || sourceStatus === 'ok') return '真实数据';
  return sourceStatus;
}

// ------------------------------------------------------------------
// useAsync — tri-state GET hook (loading / data / error) with refresh
// ------------------------------------------------------------------

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Run an async fetcher and track its loading/data/error state.
 * Re-runs whenever `deps` change or `refresh()` is called.
 * Stale responses are ignored via a `cancelled` flag (same idiom as Workbench).
 */
export function useAsync<T>(fetcher: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState<number>(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcher()
      .then((value) => {
        if (!cancelled) {
          setData(value);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getErrorMessage(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, refresh };
}

// ------------------------------------------------------------------
// useTaskStream — async analysis task runner (SSE + polling fallback)
// Mirrors ReportGenerator.tsx's completeTask/pollTaskStatus/EventSource flow.
// ------------------------------------------------------------------

export interface TaskStreamState {
  isRunning: boolean;
  progress: number;
  status: string;
  message: string;
  result: AnalysisResult | null;
  error: string | null;
  taskId: string | null;
}

export interface TaskStreamApi extends TaskStreamState {
  /** Start an async analysis task for the given stock. */
  run: (
    stockSymbol: string,
    stockName: string,
    mode?: string,
    globalAiSettings?: Record<string, unknown>,
  ) => Promise<void>;
  /** Cancel the current task (best-effort POST + local teardown). */
  cancel: () => Promise<void>;
  /** Tear down SSE + polling without notifying the backend. */
  stop: () => void;
}

export function useTaskStream(): TaskStreamApi {
  const [state, setState] = useState<TaskStreamState>({
    isRunning: false,
    progress: 0,
    status: '',
    message: '',
    result: null,
    error: null,
    taskId: null,
  });
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const taskIdRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const finishWithError = useCallback(
    (message: string) => {
      stop();
      taskIdRef.current = null;
      setState((s) => ({
        ...s,
        isRunning: false,
        status: 'failed',
        error: message,
      }));
    },
    [stop],
  );

  const complete = useCallback(
    async (taskId: string) => {
      try {
        stop();
        const result = await getTaskResult(taskId, false);
        taskIdRef.current = null;
        setState((s) => ({
          ...s,
          isRunning: false,
          progress: 100,
          status: 'success',
          result,
          message: '任务完成',
          error: null,
        }));
      } catch (err) {
        finishWithError(getErrorMessage(err));
      }
    },
    [stop, finishWithError],
  );

  const poll = useCallback(
    (taskId: string) => {
      pollTimerRef.current = window.setTimeout(async () => {
        try {
          const snapshot = await getTaskStatus(taskId);
          const p = Number(snapshot.progress) || 0;
          setState((s) => ({
            ...s,
            progress: Math.max(s.progress, p),
            status: snapshot.status,
            message: snapshot.message || `任务状态：${snapshot.status}`,
          }));
          if (snapshot.status === 'success') {
            await complete(taskId);
            return;
          }
          if (snapshot.status === 'failed' || snapshot.status === 'cancelled') {
            finishWithError(
              snapshot.error ||
                (snapshot.status === 'cancelled' ? '任务已取消' : '任务执行失败'),
            );
            return;
          }
          poll(taskId);
        } catch (err) {
          console.warn('Failed to poll task status', err);
          poll(taskId);
        }
      }, 1500);
    },
    [complete, finishWithError],
  );

  const run = useCallback(
    async (
      stockSymbol: string,
      stockName: string,
      mode = 'deep',
      globalAiSettings?: Record<string, unknown>,
    ) => {
      stop();
      taskIdRef.current = null;
      setState({
        isRunning: true,
        progress: 0,
        status: 'pending',
        message: '正在提交任务...',
        result: null,
        error: null,
        taskId: null,
      });
      try {
        const taskId = await startAsyncAnalysis(stockSymbol, stockName, mode, false, globalAiSettings);
        taskIdRef.current = taskId;
        setState((s) => ({
          ...s,
          progress: 8,
          status: 'running',
          message: `任务已启动：${taskId}`,
          taskId,
        }));
        poll(taskId);

        const eventSource = new EventSource(getTaskEventsUrl(taskId));
        eventSourceRef.current = eventSource;
        eventSource.onmessage = async (e) => {
          if (e.data.trim() === ': heartbeat') return;
          try {
            const data = JSON.parse(e.data);
            if (data.task_id !== taskId) return;
            if (data.type === 'task_progress') {
              const p = Number(data.progress) || 0;
              setState((s) => ({
                ...s,
                progress: p,
                status: data.status || s.status,
                message: data.message || s.message,
              }));
            } else if (data.type === 'task_completed') {
              await complete(taskId);
            } else if (data.type === 'task_failed' || data.type === 'task_cancelled') {
              finishWithError(data.error || data.message || '任务执行失败');
            }
          } catch (err) {
            console.warn('Failed to parse task event payload', err);
          }
        };
        eventSource.onerror = () => {
          console.error('Task SSE error');
          eventSource.close();
          eventSourceRef.current = null;
          setState((s) => ({ ...s, message: '进度流连接中断，已切换为轮询任务状态...' }));
        };
      } catch (err) {
        finishWithError(getErrorMessage(err));
      }
    },
    [stop, poll, complete, finishWithError],
  );

  const cancel = useCallback(async () => {
    const taskId = taskIdRef.current;
    if (!taskId) {
      stop();
      return;
    }
    try {
      await fetchApi(`/api/tasks/${encodeURIComponent(taskId)}/cancel`, { method: 'POST' });
    } catch (err) {
      // Backend may already be done; tear down locally regardless.
      console.warn('Task cancel failed', err);
    }
    stop();
    taskIdRef.current = null;
    setState((s) => ({
      ...s,
      isRunning: false,
      status: 'cancelled',
      message: '任务已取消',
    }));
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  return { ...state, run, cancel, stop };
}
