"use client";

import { useState, useEffect } from "react";
import {
  Zap,
  PieChart,
  BarChart2,
  TerminalSquare,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  listNews,
  getFundamentals,
  getFundFlow,
  getFactors,
  type NewsItem,
  type FundamentalsData,
  type FundFlowData,
  type FactorReport,
} from "@/lib/api";
import { cn } from "@/lib/utils";

interface DataTabsPanelProps {
  symbol: string;
  stockName: string;
}

type TabId = "news" | "fin" | "flow" | "factor";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "news", label: "实时资讯", icon: <Zap size={14} /> },
  { id: "fin", label: "核心财务", icon: <PieChart size={14} /> },
  { id: "flow", label: "主力资金", icon: <BarChart2 size={14} /> },
  { id: "factor", label: "量化因子", icon: <TerminalSquare size={14} /> },
];

export function DataTabsPanel({ symbol, stockName }: DataTabsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("news");

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all outline-none",
              activeTab === tab.id
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                : "border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]"
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
        {activeTab === "news" && <NewsTab symbol={symbol} />}
        {activeTab === "fin" && <FinTab symbol={symbol} />}
        {activeTab === "flow" && <FlowTab symbol={symbol} />}
        {activeTab === "factor" && <FactorTab symbol={symbol} stockName={stockName} />}
      </div>
    </div>
  );
}

// ---- News Tab ----

function NewsTab({ symbol }: { symbol: string }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await listNews({ symbol, limit: 20 });
        setNews(res.news || []);
      } catch {
        setNews([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
        <RefreshCw size={14} className="animate-spin mr-2" />
        加载资讯...
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="text-neutral-600 text-sm mt-4 text-center">
        暂无近期重要资讯
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {news.map((item, i) => (
        <div
          key={item.id || i}
          className="flex gap-4 group cursor-pointer hover:bg-white/[0.02] p-2 -mx-2 rounded-lg transition-colors"
        >
          <div className="text-neutral-500 text-xs font-mono w-20 flex-shrink-0 pt-0.5">
            {item.datetime
              ? new Date(item.datetime).toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--:--"}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0 rounded border font-mono",
                  item.event_type === "announcement"
                    ? "border-purple-500/30 text-purple-400 bg-purple-500/10"
                    : item.source
                    ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                    : "border-indigo-500/30 text-indigo-400 bg-indigo-500/10"
                )}
              >
                {item.event_type === "announcement"
                  ? "公告"
                  : item.source || "快讯"}
              </span>
              {item.sentiment !== undefined && (
                <span
                  className={cn(
                    "w-2 h-2 rounded-full shadow-sm",
                    item.sentiment > 0.2
                      ? "bg-rose-500 shadow-rose-500/50"
                      : item.sentiment < -0.2
                      ? "bg-emerald-500 shadow-emerald-500/50"
                      : "bg-neutral-600"
                  )}
                />
              )}
            </div>
            <p className="text-sm text-neutral-300 group-hover:text-indigo-400 transition-colors leading-relaxed">
              {item.title}
            </p>
            {item.summary && (
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                {item.summary}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Financial Tab ----

function FinTab({ symbol }: { symbol: string }) {
  const [data, setData] = useState<FundamentalsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getFundamentals(symbol);
        setData(res);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
        <RefreshCw size={14} className="animate-spin mr-2" />
        加载财务数据...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-neutral-600 text-sm mt-4 text-center">
        暂无财务数据
      </div>
    );
  }

  const latest = data.financial_periods?.[0];
  const valuation = data.valuation || {};

  const cards = [
    { label: "市盈率(TTM)", value: valuation.pe?.toFixed(2) ?? "--" },
    { label: "市净率(MRQ)", value: valuation.pb?.toFixed(2) ?? "--" },
    { label: "总市值", value: valuation.market_cap ?? "--" },
    { label: "ROE", value: latest ? `${latest.roe_pct.toFixed(1)}%` : "--" },
    { label: "营业总收入", value: latest ? `${latest.revenue_yi.toFixed(1)}亿` : "--" },
    { label: "净利润", value: latest ? `${latest.net_profit_yi.toFixed(1)}亿` : "--" },
    { label: "毛利率", value: latest ? `${latest.gross_margin_pct.toFixed(1)}%` : "--" },
    { label: "资产负债率", value: latest ? `${latest.debt_ratio_pct.toFixed(1)}%` : "--" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <div
          key={i}
          className="bg-black/20 p-3 rounded-xl border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors cursor-default"
        >
          <div className="text-xs text-neutral-500 mb-2">{card.label}</div>
          <div className="text-base font-mono text-neutral-200">{card.value}</div>
        </div>
      ))}

      {data.financial_periods && data.financial_periods.length > 1 && (
        <div className="col-span-4 mt-2">
          <div className="text-xs text-neutral-500 mb-2 font-mono uppercase tracking-wider">近四期营收趋势</div>
          <div className="flex gap-2">
            {data.financial_periods.slice(0, 4).map((p, i) => (
              <div
                key={i}
                className="flex-1 bg-black/20 p-2.5 rounded-xl border border-white/5 text-center"
              >
                <div className="text-[10px] text-neutral-600 font-mono">{p.period}</div>
                <div className="text-sm font-mono text-neutral-300">
                  {p.revenue_yi.toFixed(1)}亿
                </div>
                <div
                  className={cn(
                    "text-[10px] font-mono",
                    p.yoy_revenue_pct >= 0 ? "text-rose-400" : "text-emerald-400"
                  )}
                >
                  {p.yoy_revenue_pct >= 0 ? "+" : ""}
                  {p.yoy_revenue_pct.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Fund Flow Tab ----

function FlowTab({ symbol }: { symbol: string }) {
  const [data, setData] = useState<FundFlowData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getFundFlow(symbol, 30);
        setData(res);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
        <RefreshCw size={14} className="animate-spin mr-2" />
        加载资金流向...
      </div>
    );
  }

  if (!data || !data.summary) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-neutral-600 space-y-3">
        <AlertTriangle size={24} className="text-neutral-700" />
        <p className="text-sm">暂无资金流向数据</p>
      </div>
    );
  }

  const s = data.summary;
  const mainTotal = s.main_total_yi ?? 0;
  const superTotal = s.super_total_yi ?? 0;
  const largeTotal = s.large_total_yi ?? 0;
  const mediumTotal = s.medium_total_yi ?? 0;

  const flowCards = [
    { label: "主力净流入(5日)", value: mainTotal, unit: "亿" },
    { label: "超大单", value: superTotal, unit: "亿" },
    { label: "大单", value: largeTotal, unit: "亿" },
    { label: "中单", value: mediumTotal, unit: "亿" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {flowCards.map((card, i) => (
          <div key={i} className="bg-black/20 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-neutral-500 mb-1 font-mono">{card.label}</div>
            <div
              className={cn(
                "text-sm font-mono font-medium",
                card.value >= 0 ? "text-rose-400" : "text-emerald-400"
              )}
            >
              {card.value >= 0 ? "+" : ""}
              {card.value.toFixed(2)}
              {card.unit}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-black/20 p-3 rounded-xl border border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500">主力判断</span>
          <span
            className={cn(
              "text-sm font-medium flex items-center gap-1",
              mainTotal > 0.5
                ? "text-rose-400"
                : mainTotal < -0.5
                ? "text-emerald-400"
                : "text-neutral-400"
            )}
          >
            {mainTotal > 0.5 ? (
              <><TrendingUp size={14} /> 进场</>
            ) : mainTotal < -0.5 ? (
              <><TrendingDown size={14} /> 出货</>
            ) : (
              "观望"
            )}
          </span>
        </div>
        <div className="text-[10px] text-neutral-600 mt-1 font-mono">
          近5日: 流入{s.inflow_days ?? 0}天 / 流出{s.outflow_days ?? 0}天
        </div>
      </div>

      {data.records && data.records.length > 0 && (
        <div>
          <div className="text-xs text-neutral-500 mb-2 font-mono uppercase tracking-wider">近期主力净流入</div>
          <div className="flex items-end gap-1 h-20">
            {data.records.slice(-15).map((r, i) => {
              const h = Math.abs(r.main_net_yi) * 8;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={cn(
                      "w-full rounded-t",
                      r.main_net_yi >= 0 ? "bg-rose-500/60" : "bg-emerald-500/60"
                    )}
                    style={{ height: `${Math.min(h, 60)}px` }}
                  />
                  <div className="text-[8px] text-neutral-600 font-mono">
                    {r.date.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Factor Tab ----

function FactorTab({ symbol, stockName }: { symbol: string; stockName: string }) {
  const [data, setData] = useState<FactorReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getFactors(symbol, stockName, 30);
        setData(res);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [symbol, stockName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
        <RefreshCw size={14} className="animate-spin mr-2" />
        计算量化因子...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-neutral-600 text-sm mt-4 text-center">
        暂无因子数据
      </div>
    );
  }

  const factors = data.factors;
  const factorItems = [
    { label: "综合因子", value: factors.composite, color: "text-indigo-400" },
    { label: "新闻情绪", value: factors.news_sentiment, color: "text-yellow-400" },
    { label: "事件信号", value: factors.event_signal, color: "text-purple-400" },
    { label: "分析师评级", value: factors.analyst_rating, color: "text-cyan-400" },
    { label: "资金流向", value: factors.fund_flow, color: "text-rose-400" },
    { label: "价格动量", value: factors.momentum, color: "text-amber-400" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {factorItems.map((item, i) => (
          <div key={i} className="bg-black/20 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-neutral-500 mb-1 font-mono">{item.label}</div>
            <div className={cn("text-lg font-mono font-medium", item.color)}>
              {item.value >= 0 ? "+" : ""}
              {item.value.toFixed(3)}
            </div>
            <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  item.value >= 0 ? "bg-indigo-500/60" : "bg-emerald-500/60"
                )}
                style={{ width: `${Math.min(Math.abs(item.value) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-black/20 p-3 rounded-xl border border-white/5 text-[10px] text-neutral-600 font-mono">
        样本: 新闻 {data.sample_counts.news} 条 | 公告 {data.sample_counts.events} 条 | 研报 {data.sample_counts.reports} 条 | 计算时间: {new Date(data.computed_at).toLocaleString("zh-CN")}
      </div>

      {data.signals && data.signals.length > 0 && (
        <div>
          <div className="text-xs text-neutral-500 mb-2 font-mono uppercase tracking-wider">关键信号</div>
          <div className="space-y-1.5">
            {data.signals.slice(0, 8).map((sig, i) => (
              <div key={i} className="text-xs text-neutral-400 bg-black/20 p-2.5 rounded-lg border border-white/5">
                <span className="text-neutral-600 mr-2 font-mono">[{String(sig.type)}]</span>
                {String(sig.title || sig.institution || "")}
                {sig.sentiment !== undefined && (
                  <span
                    className={cn(
                      "ml-2 font-mono",
                      Number(sig.sentiment) >= 0 ? "text-rose-400" : "text-emerald-400"
                    )}
                  >
                    {Number(sig.sentiment) >= 0 ? "+" : ""}
                    {Number(sig.sentiment).toFixed(2)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
