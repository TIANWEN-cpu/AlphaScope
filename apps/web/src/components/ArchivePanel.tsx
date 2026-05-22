"use client";

import { useState, useEffect } from "react";
import {
  Bookmark,
  Search,
  Filter,
  Trash2,
  Eye,
  ArrowLeft,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  listArchiveReports,
  getArchiveStats,
  loadArchiveReport,
  deleteArchiveReport,
  type ArchiveReport,
} from "@/lib/api";

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
      <div className="flex-1 flex flex-col min-h-0 p-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setSelectedReport(null)}
            className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft size={16} /> 返回列表
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-[#18181b] rounded-lg border border-zinc-800 p-6">
          <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
            {reportContent}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <Bookmark size={20} className="text-blue-400" />
          研究存档
        </h2>
        <button
          onClick={loadData}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          刷新
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "总报告", value: String(stats.total ?? 0) },
          { label: "覆盖股票", value: String(stats.stocks ?? stats.distinct_stocks ?? 0) },
          { label: "买入", value: String(stats.buy ?? 0) },
          { label: "卖出", value: String(stats.sell ?? 0) },
          { label: "持有", value: String(stats.hold ?? 0) },
        ].map((s, i) => (
          <div
            key={i}
            className="bg-[#18181b] p-3 rounded-lg border border-zinc-800/50 text-center"
          >
            <div className="text-[10px] text-zinc-500 mb-1">{s.label}</div>
            <div className="text-lg font-mono text-zinc-200">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            placeholder="搜索股票名称/代码..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-[#18181b] border border-zinc-800 text-zinc-100 text-xs rounded-md pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <select
          value={decisionFilter}
          onChange={(e) => setDecisionFilter(e.target.value)}
          className="bg-[#18181b] border border-zinc-800 text-zinc-100 text-xs rounded-md px-3 py-2 focus:outline-none focus:border-blue-500/50"
        >
          <option value="">全部决策</option>
          <option value="买">买入</option>
          <option value="卖">卖出</option>
          <option value="持">持有</option>
        </select>
      </div>

      {/* Report list */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
          加载中...
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-zinc-600">
          <Bookmark size={32} className="opacity-20 mb-2" />
          <p className="text-sm">暂无研究报告</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report, i) => (
            <div
              key={report.path || i}
              className="bg-[#18181b] rounded-lg border border-zinc-800/50 p-3 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        report.decision?.includes("买")
                          ? "border-red-500/30 text-red-400 bg-red-500/10"
                          : report.decision?.includes("卖")
                          ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                          : "border-zinc-500/30 text-zinc-400 bg-zinc-500/10"
                      }`}
                    >
                      {report.decision || "未知"}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">
                      {report.symbol}
                    </span>
                    <span className="text-xs text-zinc-300">
                      {report.stock_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
                    <span>{report.date}</span>
                    <span>置信度: {report.avg_confidence?.toFixed(0)}%</span>
                    <span
                      className={`px-1 rounded ${
                        report.type === "roundtable"
                          ? "bg-purple-500/10 text-purple-400"
                          : "bg-blue-500/10 text-blue-400"
                      }`}
                    >
                      {report.type === "roundtable" ? "圆桌" : "Agent"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleView(report.path)}
                    className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 rounded transition-colors"
                    title="查看"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(report.path)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
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
