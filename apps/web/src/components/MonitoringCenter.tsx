import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Coins,
  Database,
  GitBranch,
  Gauge,
  HelpCircle,
  RefreshCcw,
  Server,
  Wrench,
  XCircle,
} from 'lucide-react';
import { fetchApi } from '../lib/api';

type MonStatus = 'good' | 'warn' | 'poor' | 'unknown';

interface MonComponent {
  key: string;
  label: string;
  status: MonStatus;
  summary: string;
  detail: string;
  metrics: Record<string, unknown>;
}

interface MonitorSnapshot {
  generated_at: number;
  overall: MonStatus;
  overall_label: string;
  component_count: number;
  status_counts: Record<string, number>;
  components: MonComponent[];
  disclaimer: string;
}

const statusMeta: Record<MonStatus, { label: string; text: string; chip: string; dot: string; icon: React.ReactNode }> = {
  good: {
    label: '正常',
    text: 'text-emerald-400',
    chip: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  warn: {
    label: '降级',
    text: 'text-amber-400',
    chip: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  poor: {
    label: '异常',
    text: 'text-red-400',
    chip: 'border-red-500/25 bg-red-500/10 text-red-300',
    dot: 'bg-red-400',
    icon: <XCircle className="h-4 w-4" />,
  },
  unknown: {
    label: '未知',
    text: 'text-neutral-400',
    chip: 'border-white/10 bg-white/5 text-neutral-300',
    dot: 'bg-neutral-500',
    icon: <HelpCircle className="h-4 w-4" />,
  },
};

const componentIcons: Record<string, React.ReactNode> = {
  data_sources: <Server className="h-4 w-4" />,
  quant_engine: <Activity className="h-4 w-4" />,
  experiments: <Database className="h-4 w-4" />,
  llm_cost: <Coins className="h-4 w-4" />,
  tool_calls: <Wrench className="h-4 w-4" />,
  traces: <GitBranch className="h-4 w-4" />,
};

const normalizeStatus = (status: unknown): MonStatus => {
  if (status === 'good' || status === 'warn' || status === 'poor' || status === 'unknown') return status;
  return 'unknown';
};

const formatTime = (value?: number) => {
  if (!value || value <= 0) return '-';
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const isPrimitive = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

const POLL_MS = 20000;

export const MonitoringCenter: React.FC = () => {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setIsRefreshing(true);
    setError('');
    try {
      const data = await fetchApi<MonitorSnapshot>('/api/monitor/snapshot');
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '监控快照读取失败');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(() => void load(), POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [autoRefresh, load]);

  const overall = snapshot ? normalizeStatus(snapshot.overall) : 'unknown';
  const counts = snapshot?.status_counts ?? {};

  const sortedComponents = useMemo(() => {
    const weight: Record<MonStatus, number> = { poor: 0, warn: 1, unknown: 2, good: 3 };
    return [...(snapshot?.components ?? [])].sort(
      (a, b) => weight[normalizeStatus(a.status)] - weight[normalizeStatus(b.status)],
    );
  }, [snapshot]);

  return (
    <motion.div
      key="monitor"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex h-full flex-col gap-4 overflow-y-auto p-5"
    >
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500/20">
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-neutral-100">系统监控中心</h1>
            <p className="mt-1 max-w-2xl text-xs text-neutral-500">
              单页总览数据源、回测引擎、实验记录、模型成本、工具调用与执行追踪的运行状态。纯本地聚合、失败安全，仅反映系统自身运行情况。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
              autoRefresh
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10'
            }`}
            title="每 20 秒自动刷新"
          >
            <span className={`h-2 w-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'}`} />
            自动刷新
          </button>
          <button
            type="button"
            onClick={load}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-100">
          后端监控接口暂不可用：{error}
        </div>
      )}

      {/* 总状态英雄卡 */}
      <div className={`mb-5 rounded-xl border p-5 ${statusMeta[overall].chip}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={statusMeta[overall].text}>{statusMeta[overall].icon}</span>
            <div>
              <div className="text-lg font-semibold text-neutral-100">
                {snapshot?.overall_label ?? '加载中…'}
              </div>
              <div className="text-xs text-neutral-400">
                最近刷新：{formatTime(snapshot?.generated_at)}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['good', 'warn', 'poor', 'unknown'] as MonStatus[]).map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-neutral-300"
              >
                <span className={`h-2 w-2 rounded-full ${statusMeta[s].dot}`} />
                {statusMeta[s].label} {counts[s] ?? 0}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 组件卡片 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {sortedComponents.length === 0 && !error && (
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-neutral-400">
            {isRefreshing ? '正在采集系统状态…' : '暂无监控数据。'}
          </div>
        )}

        {sortedComponents.map((comp, idx) => {
          const status = normalizeStatus(comp.status);
          const meta = statusMeta[status];
          const metricEntries = Object.entries(comp.metrics || {}).filter(([, v]) => isPrimitive(v));
          return (
            <motion.div
              key={comp.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.25 }}
              className="rounded-lg border border-white/10 bg-black/20 p-4 transition-colors hover:bg-white/[0.03]"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-indigo-300/80">{componentIcons[comp.key] ?? <Gauge className="h-4 w-4" />}</span>
                  <span className="font-medium text-white/90">{comp.label}</span>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${meta.chip}`}>
                  {meta.icon}
                  {meta.label}
                </span>
              </div>

              <div className="text-sm text-neutral-300">{comp.summary}</div>

              {status === 'unknown' && comp.detail && (
                <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                  采集异常：{comp.detail}
                </div>
              )}

              {metricEntries.length > 0 && (
                <details className="mt-3 group">
                  <summary className="cursor-pointer list-none text-xs text-neutral-500 hover:text-neutral-300">
                    指标明细
                  </summary>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                    {metricEntries.map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-neutral-500">{k}</span>
                        <span className="font-mono text-neutral-300">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </motion.div>
          );
        })}
      </div>

      {snapshot?.disclaimer && (
        <div className="mt-5 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-neutral-500">
          {snapshot.disclaimer}
        </div>
      )}
    </motion.div>
  );
};
