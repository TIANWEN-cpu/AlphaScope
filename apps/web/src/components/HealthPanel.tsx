"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { getProvidersHealth, type ProvidersHealthData, type ProviderInfo } from "@/lib/api";

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
        return <AlertTriangle size={14} className="text-yellow-500" />;
      default:
        return <XCircle size={14} className="text-red-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "degraded":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
      default:
        return "text-red-400 bg-red-500/10 border-red-500/20";
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <Activity size={20} className="text-emerald-400" />
          数据源健康
        </h2>
        <button
          onClick={loadData}
          disabled={loading}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          刷新
        </button>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "总计", value: data.total, color: "text-zinc-200" },
            { label: "健康", value: data.healthy, color: "text-emerald-400" },
            { label: "降级", value: data.degraded, color: "text-yellow-400" },
            { label: "异常", value: data.unhealthy, color: "text-red-400" },
          ].map((s, i) => (
            <div
              key={i}
              className="bg-[#18181b] p-3 rounded-lg border border-zinc-800/50 text-center"
            >
              <div className="text-[10px] text-zinc-500 mb-1">{s.label}</div>
              <div className={`text-xl font-mono ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Provider list */}
      {loading && !data ? (
        <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
          <RefreshCw size={14} className="animate-spin mr-2" />
          加载中...
        </div>
      ) : !data || data.providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-zinc-600">
          <Activity size={32} className="opacity-20 mb-2" />
          <p className="text-sm">暂无数据源信息</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.providers.map((p, i) => (
            <div
              key={i}
              className="bg-[#18181b] rounded-lg border border-zinc-800/50 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(p.status)}
                  <span className="text-sm text-zinc-200 font-medium">
                    {p.name}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0 rounded border ${getStatusColor(
                      p.status
                    )}`}
                  >
                    {p.status}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 font-mono">
                  {p.avg_latency_ms.toFixed(0)}ms
                </div>
              </div>

              <div className="flex gap-3 mt-2 text-[10px] text-zinc-600">
                <span>类型: {p.data_types?.join(", ") || "--"}</span>
                <span>市场: {p.markets?.join(", ") || "--"}</span>
                {p.consecutive_failures > 0 && (
                  <span className="text-red-400">
                    连续失败: {p.consecutive_failures}
                  </span>
                )}
              </div>

              {p.last_error && (
                <div className="mt-2 text-[10px] text-red-400/80 bg-red-500/5 p-2 rounded border border-red-500/10">
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
