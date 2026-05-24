"use client";

import { useState, useEffect } from "react";
import {
  Bookmark,
  Search,
  Trash2,
  Eye,
  ArrowLeft,
} from "lucide-react";
import {
  listArchiveReports,
  getArchiveStats,
  loadArchiveReport,
  deleteArchiveReport,
  type ArchiveReport,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export function ArchivePanel() {
  const [reports, setReports] = useState<ArchiveReport[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportsRes, statsRes] = await Promise.all([
        listArchiveReports({
          stock_filter: filter || undefined,
          decision_filter: decisionFilter || undefined,
          limit: 50,
        }),
        getArchiveStats(),
      ]);
      setReports(reportsRes.reports || []);
      setStats(statsRes);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, decisionFilter]);

  const handleView = async (path: string) => {
    try {
      const res = await loadArchiveReport(path);
      setReportContent(res.content || "");
      setSelectedReport(path);
    } catch {
      setReportContent("加载失败");
    }
  };

  const handleDelete = async (path: string) => {
    if (!confirm("确定删除此报告？")) return;
    try {
      await deleteArchiveReport(path);
      setReports((prev) => prev.filter((r) => r.path !== path));
    } catch {
      // ignore
    }
  };

  if (selectedReport) {
    return (
      <div className="flex-1 flex flex-col min-h-0 p-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setSelectedReport(null)}
            className="flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <ArrowLeft size={16} /> 返回列表
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-white/[0.02] rounded-xl border border-white/5 p-6 backdrop-blur-md">
          <pre className="text-sm text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed">
            {reportContent}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6 gap-4 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-medium text-white flex items-center gap-3">
          <Bookmark size={22} className="text-indigo-400" />
          研究存档
        </h2>
        <button
          onClick={loadData}
          className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors font-mono"
        >
          刷新
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "总报告", value: String(stats.total ?? 0) },
          { label: "覆盖股票", value: String(stats.stocks ?? stats.distinct_stocks ?? 0) },
          { label: "买入", value: String(stats.buy ?? 0) },
          { label: "卖出", value: String(stats.sell ?? 0) },
          { label: "持有", value: String(stats.hold ?? 0) },
        ].map((s, i) => (
          <div key={i} className="bg-white/[0.02] p-3 rounded-xl border border-white/5 text-center backdrop-blur-md">
            <div className="text-[10px] text-neutral-500 mb-1 font-mono">{s.label}</div>
            <div className="text-lg font-mono text-neutral-200">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="搜索股票名称/代码..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-black/20 border border-white/5 text-neutral-100 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
        <select
          value={decisionFilter}
          onChange={(e) => setDecisionFilter(e.target.value)}
          className="bg-black/20 border border-white/5 text-neutral-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500/50"
        >
          <option value="">全部决策</option>
          <option value="买">买入</option>
          <option value="卖">卖出</option>
          <option value="持">持有</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
          加载中...
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-neutral-600">
          <Bookmark size={32} className="opacity-20 mb-2" />
          <p className="text-sm">暂无研究报告</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report, i) => (
            <div
              key={report.path || i}
              className="bg-white/[0.02] rounded-xl border border-white/5 p-4 hover:border-white/10 transition-colors backdrop-blur-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-lg border font-mono",
                        report.decision?.includes("买")
                          ? "border-rose-500/30 text-rose-400 bg-rose-500/10"
                          : report.decision?.includes("卖")
                          ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                          : "border-neutral-500/30 text-neutral-400 bg-neutral-500/10"
                      )}
                    >
                      {report.decision || "未知"}
                    </span>
                    <span className="text-xs text-neutral-500 font-mono">{report.symbol}</span>
                    <span className="text-xs text-neutral-300">{report.stock_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-neutral-500 font-mono">
                    <span>{report.date}</span>
                    <span>置信度: {report.avg_confidence?.toFixed(0)}%</span>
                    <span
                      className={cn(
                        "px-1 rounded",
                        report.type === "roundtable"
                          ? "bg-purple-500/10 text-purple-400"
                          : "bg-indigo-500/10 text-indigo-400"
                      )}
                    >
                      {report.type === "roundtable" ? "圆桌" : "Agent"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleView(report.path)}
                    className="p-1.5 text-neutral-500 hover:text-indigo-400 hover:bg-white/[0.02] rounded-lg transition-colors"
                    title="查看"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(report.path)}
                    className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-white/[0.02] rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
