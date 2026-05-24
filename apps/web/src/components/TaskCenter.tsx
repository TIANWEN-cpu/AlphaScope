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
import { cn } from "@/lib/utils";

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
    pending: { icon: <Clock size={12} />, cls: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20", label: "等待中" },
    running: { icon: <Loader2 size={12} className="animate-spin" />, cls: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", label: "运行中" },
    success: { icon: <CheckCircle2 size={12} />, cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "成功" },
    failed: { icon: <AlertCircle size={12} />, cls: "bg-rose-500/10 text-rose-400 border-rose-500/20", label: "失败" },
    cancelled: { icon: <Ban size={12} />, cls: "bg-amber-500/10 text-amber-400 border-amber-500/20", label: "已取消" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs border font-mono", s.cls)}>
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
    <div className="flex-1 flex flex-col min-h-0 p-6 gap-4 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-medium text-white flex items-center gap-3">
          <ListTodo size={22} className="text-indigo-400" />
          任务中心
        </h2>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 bg-white/[0.02] hover:bg-white/[0.04] rounded-lg transition-colors border border-white/5"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          刷新
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={cn(
              "px-3 py-1 text-xs rounded-lg transition-colors",
              statusFilter === opt.value
                ? "bg-indigo-600 text-white"
                : "bg-white/[0.02] text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04] border border-white/5"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-neutral-600">
          <div className="text-center">
            <ListTodo size={48} className="opacity-20 mx-auto mb-3" />
            <p className="text-sm">暂无任务</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden backdrop-blur-md">
              <div
                className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => handleExpand(t.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={t.status} />
                    <span className="text-sm text-neutral-200 font-mono">{t.id}</span>
                    <span className="text-xs text-neutral-500">{t.task_type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-600 font-mono">
                      {formatTime(t.created_at)}
                    </span>
                    {(t.status === "running" || t.status === "pending") && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(t.id);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors"
                      >
                        <XCircle size={12} />
                        取消
                      </button>
                    )}
                    {expandedId === t.id ? (
                      <ChevronUp size={14} className="text-neutral-500" />
                    ) : (
                      <ChevronDown size={14} className="text-neutral-500" />
                    )}
                  </div>
                </div>
              </div>

              {expandedId === t.id && detail && (
                <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-neutral-500">会话 ID: </span>
                      <span className="text-neutral-300 font-mono">
                        {(detail.conversation_id as string) || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500">类型: </span>
                      <span className="text-neutral-300">{detail.task_type as string}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">开始: </span>
                      <span className="text-neutral-300">{formatTime(detail.started_at as number)}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">完成: </span>
                      <span className="text-neutral-300">{formatTime(detail.completed_at as number)}</span>
                    </div>
                  </div>

                  {(detail.error as string) && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-2 text-xs text-rose-400">
                      {detail.error as string}
                    </div>
                  )}

                  {(detail.input_json as string) && (detail.input_json as string) !== "{}" && (
                    <div>
                      <div className="text-[10px] text-neutral-500 mb-1 font-mono">输入参数</div>
                      <pre className="bg-black/20 rounded-lg p-2 text-xs text-neutral-400 overflow-x-auto max-h-40 custom-scrollbar border border-white/5">
                        {JSON.stringify(JSON.parse(detail.input_json as string), null, 2)}
                      </pre>
                    </div>
                  )}

                  {(detail.output_json as string) && (detail.output_json as string) !== "{}" && (
                    <div>
                      <div className="text-[10px] text-neutral-500 mb-1 font-mono">输出结果</div>
                      <pre className="bg-black/20 rounded-lg p-2 text-xs text-neutral-400 overflow-x-auto max-h-60 custom-scrollbar border border-white/5">
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
