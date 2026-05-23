"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Loader2,
  Play,
  RefreshCw,
  Zap,
} from "lucide-react";
import {
  getQuantStatus,
  listQuantStrategies,
  listQuantRuns,
  type JinceStatus,
  type StrategyInfo,
} from "@/lib/api";

type ViewState = "loading" | "disconnected" | "ready" | "error";

export function QuantLabPanel() {
  const [state, setState] = useState<ViewState>("loading");
  const [status, setStatus] = useState<JinceStatus | null>(null);
  const [strategies, setStrategies] = useState<StrategyInfo[]>([]);
  const [runs, setRuns] = useState<
    { run_id: string; strategy_id: string; symbol: string; status: string; total_return?: number }[]
  >([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const s = await getQuantStatus();
      setStatus(s);
      if (!s.connected) {
        setState("disconnected");
        return;
      }
      const [strats, runList] = await Promise.all([
        listQuantStrategies(),
        listQuantRuns(),
      ]);
      setStrategies(strats);
      setRuns(runList);
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <Zap size={20} className="text-blue-400" />
          量化实验室
        </h2>
        <button
          onClick={load}
          className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 text-zinc-300 flex items-center gap-1"
        >
          <RefreshCw size={12} />
          刷新
        </button>
      </div>

      {/* Status */}
      <StatusCard status={status} state={state} />

      {state === "loading" && (
        <div className="flex-1 flex items-center justify-center text-zinc-500">
          <Loader2 size={24} className="animate-spin mr-2" />
          连接 Jince 服务中...
        </div>
      )}

      {state === "disconnected" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500">
          <AlertTriangle size={32} className="text-amber-500" />
          <p className="text-sm">Jince 量化引擎未连接</p>
          <p className="text-xs text-zinc-600">
            请启动 jin-ce-zhi-suan 服务后点击刷新
          </p>
          <button
            onClick={load}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
          >
            重新连接
          </button>
        </div>
      )}

      {state === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500">
          <AlertTriangle size={32} className="text-red-500" />
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm"
          >
            重试
          </button>
        </div>
      )}

      {state === "ready" && (
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* Strategies */}
          <Section title="策略列表" count={strategies.length}>
            {strategies.length === 0 ? (
              <Empty text="暂无策略" />
            ) : (
              <div className="grid gap-2">
                {strategies.map((s) => (
                  <StrategyRow key={s.id} strategy={s} />
                ))}
              </div>
            )}
          </Section>

          {/* Runs */}
          <Section title="运行记录" count={runs.length}>
            {runs.length === 0 ? (
              <Empty text="暂无运行记录" />
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="text-zinc-500 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-1.5 px-2">运行ID</th>
                      <th className="text-left py-1.5 px-2">策略</th>
                      <th className="text-left py-1.5 px-2">标的</th>
                      <th className="text-left py-1.5 px-2">状态</th>
                      <th className="text-right py-1.5 px-2">收益</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr
                        key={r.run_id}
                        className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                      >
                        <td className="py-1.5 px-2 font-mono text-zinc-400">
                          {r.run_id.slice(0, 8)}
                        </td>
                        <td className="py-1.5 px-2">{r.strategy_id}</td>
                        <td className="py-1.5 px-2">{r.symbol}</td>
                        <td className="py-1.5 px-2">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {r.total_return != null ? (
                            <span
                              className={
                                r.total_return >= 0
                                  ? "text-emerald-400"
                                  : "text-red-400"
                              }
                            >
                              {(r.total_return * 100).toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function StatusCard({
  status,
  state,
}: {
  status: JinceStatus | null;
  state: ViewState;
}) {
  const connected = status?.connected ?? false;
  return (
    <div
      className={`rounded-lg border p-3 flex items-center gap-3 ${
        connected
          ? "bg-emerald-500/5 border-emerald-500/20"
          : state === "loading"
            ? "bg-zinc-800/50 border-zinc-700"
            : "bg-amber-500/5 border-amber-500/20"
      }`}
    >
      <Activity
        size={16}
        className={
          connected
            ? "text-emerald-400"
            : state === "loading"
              ? "text-zinc-500 animate-pulse"
              : "text-amber-500"
        }
      />
      <div className="text-sm">
        <span className="text-zinc-300">
          {connected ? "Jince 已连接" : state === "loading" ? "连接中..." : "Jince 未连接"}
        </span>
        {connected && status?.version && (
          <span className="text-zinc-500 ml-2">v{status.version}</span>
        )}
        {connected && (
          <span className="text-zinc-500 ml-2">
            {status?.strategy_count} 策略 / {status?.active_runs} 运行中
          </span>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <h3 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
        {title}
        <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
          {count}
        </span>
      </h3>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-8 text-center text-zinc-600 text-sm">{text}</div>
  );
}

function StrategyRow({ strategy }: { strategy: StrategyInfo }) {
  return (
    <div className="bg-zinc-800/40 rounded border border-zinc-800/60 p-3 flex items-center justify-between">
      <div>
        <div className="text-sm text-zinc-200">{strategy.name}</div>
        <div className="text-xs text-zinc-500">{strategy.description}</div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            strategy.status === "active"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-zinc-700 text-zinc-400"
          }`}
        >
          {strategy.status}
        </span>
        <button
          title="运行回测"
          className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-blue-400"
        >
          <Play size={14} />
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-emerald-500/10 text-emerald-400",
    running: "bg-blue-500/10 text-blue-400",
    failed: "bg-red-500/10 text-red-400",
    pending: "bg-zinc-700 text-zinc-400",
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colors[status] || colors.pending}`}>
      {status}
    </span>
  );
}
