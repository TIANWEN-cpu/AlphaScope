"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ListTodo,
  RefreshCw,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Ban,
} from "lucide-react";
import { listTasks, getTask, cancelTask, type TaskItem } from "@/lib/api";

const STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "pending", label: "等待中" },
  { value: "running", label: "运行中" },
  { value: "success", label: "成功" },
  { value: "failed", label: "失败" },
  { value: "cancelled", label: "已取消" },
] as const;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
    pending: { icon: <Clock size={12} />, cls: "bg-zinc-500/10 text-zinc-400", label: "等待中" },
    running: { icon: <Loader2 size={12} className="animate-spin" />, cls: "bg-blue-500/10 text-blue-400", label: "运行中" },
    success: { icon: <CheckCircle2 size={12} />, cls: "bg-emerald-500/10 text-emerald-400", label: "成功" },
    failed: { icon: <AlertCircle size={12} />, cls: "bg-red-500/10 text-red-400", label: "失败" },
    cancelled: { icon: <Ban size={12} />, cls: "bg-yellow-500/10 text-yellow-400", label: "已取消" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

function formatTime(ts?: number | null) {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function TaskCenter() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listTasks(statusFilter || undefined, 100);
      setTasks((res.tasks || []) as TaskItem[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh every 10s when there are running tasks
  useEffect(() => {
    const hasRunning = tasks.some((t) => t.status === "running" || t.status === "pending");
    if (hasRunning) {
      timerRef.current = setInterval(load, 10_000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tasks, load]);

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    try {
      const d = await getTask(id);
      setDetail(d as unknown as Record<string, unknown>);
    } catch {
      setDetail(null);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelTask(id);
      load();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 gap-4 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <ListTodo size={20} className="text-blue-400" />
          任务中心
        </h2>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 rounded-md transition-colors"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          刷新
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              statusFilter === opt.value
                ? "bg-blue-600 text-white"
                : "bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zinc-600">
          <div className="text-center">
            <ListTodo size={48} className="opacity-20 mx-auto mb-3" />
            <p className="text-sm">暂无任务</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <div
              key={t.id}
              className="bg-[#18181b] rounded-lg border border-zinc-800/50 overflow-hidden"
            >
              <div
                className="p-3 cursor-pointer hover:bg-zinc-800/20 transition-colors"
                onClick={() => handleExpand(t.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={t.status} />
                    <span className="text-sm text-zinc-200 font-mono">{t.id}</span>
                    <span className="text-xs text-zinc-500">{t.task_type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-600">
                      {formatTime(t.created_at)}
                    </span>
                    {(t.status === "running" || t.status === "pending") && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(t.id);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
                      >
                        <XCircle size={12} />
                        取消
                      </button>
                    )}
                    {expandedId === t.id ? (
                      <ChevronUp size={14} className="text-zinc-500" />
                    ) : (
                      <ChevronDown size={14} className="text-zinc-500" />
                    )}
                  </div>
                </div>
              </div>

              {expandedId === t.id && detail && (
                <div className="px-3 pb-3 border-t border-zinc-800/50 pt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-500">会话 ID: </span>
                      <span className="text-zinc-300 font-mono">
                        {(detail.conversation_id as string) || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">类型: </span>
                      <span className="text-zinc-300">{detail.task_type as string}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">开始: </span>
                      <span className="text-zinc-300">{formatTime(detail.started_at as number)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">完成: </span>
                      <span className="text-zinc-300">{formatTime(detail.completed_at as number)}</span>
                    </div>
                  </div>

                  {(detail.error as string) && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-xs text-red-400">
                      {detail.error as string}
                    </div>
                  )}

                  {(detail.input_json as string) && (detail.input_json as string) !== "{}" && (
                    <div>
                      <div className="text-[10px] text-zinc-500 mb-1">输入参数</div>
                      <pre className="bg-[#09090b] rounded p-2 text-xs text-zinc-400 overflow-x-auto max-h-40 custom-scrollbar">
                        {JSON.stringify(JSON.parse(detail.input_json as string), null, 2)}
                      </pre>
                    </div>
                  )}

                  {(detail.output_json as string) && (detail.output_json as string) !== "{}" && (
                    <div>
                      <div className="text-[10px] text-zinc-500 mb-1">输出结果</div>
                      <pre className="bg-[#09090b] rounded p-2 text-xs text-zinc-400 overflow-x-auto max-h-60 custom-scrollbar">
                        {JSON.stringify(JSON.parse(detail.output_json as string), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
