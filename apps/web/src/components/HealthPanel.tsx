"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { getProvidersHealth, type ProvidersHealthData } from "@/lib/api";
import { cn } from "@/lib/utils";

export function HealthPanel() {
  const [data, setData] = useState<ProvidersHealthData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getProvidersHealth();
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle size={14} className="text-emerald-500" />;
      case "degraded":
        return <AlertTriangle size={14} className="text-amber-500" />;
      default:
        return <XCircle size={14} className="text-rose-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "degraded":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      default:
        return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6 gap-4 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-medium text-white flex items-center gap-3">
          <Activity size={22} className="text-emerald-400" />
          数据源健康
        </h2>
        <button
          onClick={loadData}
          disabled={loading}
          className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1 font-mono"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          刷新
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "总计", value: data.total, color: "text-neutral-200" },
            { label: "健康", value: data.healthy, color: "text-emerald-400" },
            { label: "降级", value: data.degraded, color: "text-amber-400" },
            { label: "异常", value: data.unhealthy, color: "text-rose-400" },
          ].map((s, i) => (
            <div key={i} className="bg-white/[0.02] p-3 rounded-xl border border-white/5 text-center backdrop-blur-md">
              <div className="text-[10px] text-neutral-500 mb-1 font-mono">{s.label}</div>
              <div className={cn("text-xl font-mono", s.color)}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
          <RefreshCw size={14} className="animate-spin mr-2" />
          加载中...
        </div>
      ) : !data || data.providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-neutral-600">
          <Activity size={32} className="opacity-20 mb-2" />
          <p className="text-sm">暂无数据源信息</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.providers.map((p, i) => (
            <div key={i} className="bg-white/[0.02] rounded-xl border border-white/5 p-4 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(p.status)}
                  <span className="text-sm text-neutral-200 font-medium">{p.name}</span>
                  <span className={cn("text-[10px] px-1.5 py-0 rounded-lg border font-mono", getStatusColor(p.status))}>
                    {p.status}
                  </span>
                </div>
                <div className="text-xs text-neutral-500 font-mono">
                  {p.avg_latency_ms.toFixed(0)}ms
                </div>
              </div>

              <div className="flex gap-3 mt-2 text-[10px] text-neutral-600 font-mono">
                <span>类型: {p.data_types?.join(", ") || "--"}</span>
                <span>市场: {p.markets?.join(", ") || "--"}</span>
                {p.consecutive_failures > 0 && (
                  <span className="text-rose-400">连续失败: {p.consecutive_failures}</span>
                )}
              </div>

              {p.last_error && (
                <div className="mt-2 text-[10px] text-rose-400/80 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">
                  {p.last_error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
