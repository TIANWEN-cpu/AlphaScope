"use client";

import { useState, useEffect } from "react";
import {
  BarChart2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import { getFundFlow, getMarketFundFlow, type FundFlowData } from "@/lib/api";
import { cn } from "@/lib/utils";

interface FundFlowPanelProps {
  symbol: string;
  stockName: string;
}

type SubTab = "individual" | "market";

export function FundFlowPanel({ symbol, stockName }: FundFlowPanelProps) {
  const [activeTab, setActiveTab] = useState<SubTab>("individual");
  const [individual, setIndividual] = useState<FundFlowData | null>(null);
  const [market, setMarket] = useState<{ summary: Record<string, number>; records: Record<string, unknown>[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (activeTab === "individual") {
          const res = await getFundFlow(symbol, 30).catch(() => null);
          setIndividual(res);
        } else {
          const res = await getMarketFundFlow(30).catch(() => null);
          setMarket(res);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [symbol, activeTab]);

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 gap-3 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-semibold text-neutral-100 flex items-center gap-2">
          <BarChart2 size={20} className="text-rose-400" />
          资金流向
          <span className="text-xs text-neutral-500 font-normal ml-2">
            {stockName} ({symbol})
          </span>
        </h2>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-2">
        {[
          { id: "individual" as SubTab, label: "个股资金" },
          { id: "market" as SubTab, label: "大盘资金" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-1.5 text-xs rounded-md border transition-colors",
              activeTab === tab.id
                ? "border-indigo-500/50 text-indigo-400 bg-indigo-500/10"
                : "border-white/5 text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
          <RefreshCw size={14} className="animate-spin mr-2" />
          加载资金流向...
        </div>
      ) : activeTab === "individual" ? (
        <IndividualFlow data={individual} />
      ) : (
        <MarketFlow data={market} />
      )}
    </div>
  );
}

function IndividualFlow({ data }: { data: FundFlowData | null }) {
  if (!data || !data.summary) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-neutral-600">
        <AlertTriangle size={24} className="text-neutral-700 mb-2" />
        <p className="text-sm">暂无个股资金流向数据</p>
        <p className="text-[10px] text-neutral-700 mt-1">需akshare数据源可用</p>
      </div>
    );
  }

  const s = data.summary;
  const mainTotal = (s as Record<string, number>).main_total_yi ?? 0;
  const superTotal = (s as Record<string, number>).super_total_yi ?? 0;
  const largeTotal = (s as Record<string, number>).large_total_yi ?? 0;
  const mediumTotal = (s as Record<string, number>).medium_total_yi ?? 0;
  const smallTotal = (s as Record<string, number>).small_total_yi ?? 0;

  const flowCards = [
    { label: "主力净流入(5日)", value: mainTotal, color: mainTotal >= 0 ? "text-rose-400" : "text-emerald-400" },
    { label: "超大单", value: superTotal, color: superTotal >= 0 ? "text-rose-400" : "text-emerald-400" },
    { label: "大单", value: largeTotal, color: largeTotal >= 0 ? "text-rose-400" : "text-emerald-400" },
    { label: "中单", value: mediumTotal, color: mediumTotal >= 0 ? "text-rose-400" : "text-emerald-400" },
    { label: "小单", value: smallTotal, color: smallTotal >= 0 ? "text-rose-400" : "text-emerald-400" },
  ];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-2">
        {flowCards.map((card, i) => (
          <div key={i} className="bg-transparent p-3 rounded-xl border border-white/5">
            <div className="text-[10px] font-mono text-neutral-500 mb-1">{card.label}</div>
            <div className={`text-sm font-mono font-medium ${card.color}`}>
              {card.value >= 0 ? "+" : ""}
              {card.value.toFixed(2)}亿
            </div>
          </div>
        ))}
      </div>

      {/* Main force judgment */}
      <div className="bg-transparent p-3 rounded-xl border border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-neutral-500">主力判断</span>
          <span className={`text-sm font-medium flex items-center gap-1 ${
            mainTotal > 0.5 ? "text-rose-400" : mainTotal < -0.5 ? "text-emerald-400" : "text-neutral-400"
          }`}>
            {mainTotal > 0.5 ? <><TrendingUp size={14} /> 进场</> :
             mainTotal < -0.5 ? <><TrendingDown size={14} /> 出货</> : "观望"}
          </span>
        </div>
        <div className="text-[10px] font-mono text-neutral-600 mt-1">
          近5日: 流入{(s as Record<string, number>).inflow_days ?? 0}天 / 流出{(s as Record<string, number>).outflow_days ?? 0}天
        </div>
      </div>

      {/* Bar chart */}
      {data.records && data.records.length > 0 && (
        <div className="bg-transparent p-3 rounded-xl border border-white/5">
          <div className="text-xs font-mono text-neutral-500 mb-2">近期主力净流入趋势</div>
          <div className="flex items-end gap-1 h-24">
            {data.records.slice(-20).map((r, i) => {
              const h = Math.abs(r.main_net_yi) * 6;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={`w-full rounded-t ${r.main_net_yi >= 0 ? "bg-rose-500/60" : "bg-emerald-500/60"}`}
                    style={{ height: `${Math.min(h, 80)}px` }}
                  />
                  <div className="text-[7px] text-neutral-600 font-mono">
                    {r.date?.slice(5) || ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail table */}
      {data.records && data.records.length > 0 && (
        <div className="bg-transparent rounded-xl border border-white/5 overflow-hidden">
          <div className="text-xs font-mono text-neutral-500 p-3 pb-0">每日明细</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-3 py-2 text-left font-mono text-neutral-500 font-normal">日期</th>
                  <th className="px-3 py-2 text-right font-mono text-neutral-500 font-normal">收盘</th>
                  <th className="px-3 py-2 text-right font-mono text-neutral-500 font-normal">涨跌%</th>
                  <th className="px-3 py-2 text-right font-mono text-neutral-500 font-normal">主力净额</th>
                  <th className="px-3 py-2 text-right font-mono text-neutral-500 font-normal">超大单</th>
                  <th className="px-3 py-2 text-right font-mono text-neutral-500 font-normal">大单</th>
                  <th className="px-3 py-2 text-right font-mono text-neutral-500 font-normal">中单</th>
                  <th className="px-3 py-2 text-right font-mono text-neutral-500 font-normal">小单</th>
                </tr>
              </thead>
              <tbody>
                {data.records.slice(-15).reverse().map((r, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-3 py-1.5 text-neutral-400 font-mono">{r.date}</td>
                    <td className="px-3 py-1.5 text-right text-neutral-300 font-mono">{r.close?.toFixed(2)}</td>
                    <td className={`px-3 py-1.5 text-right font-mono ${r.change_pct >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {r.change_pct >= 0 ? "+" : ""}{r.change_pct?.toFixed(2)}%
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${r.main_net_yi >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {r.main_net_yi >= 0 ? "+" : ""}{r.main_net_yi?.toFixed(2)}亿
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${r.super_net_yi >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {r.super_net_yi >= 0 ? "+" : ""}{r.super_net_yi?.toFixed(2)}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${r.large_net_yi >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {r.large_net_yi >= 0 ? "+" : ""}{r.large_net_yi?.toFixed(2)}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${r.medium_net_yi >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {r.medium_net_yi >= 0 ? "+" : ""}{r.medium_net_yi?.toFixed(2)}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${r.small_net_yi >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {r.small_net_yi >= 0 ? "+" : ""}{r.small_net_yi?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketFlow({ data }: { data: { summary: Record<string, number>; records: Record<string, unknown>[] } | null }) {
  if (!data || !data.summary) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-neutral-600">
        <AlertTriangle size={24} className="text-neutral-700 mb-2" />
        <p className="text-sm">暂无大盘资金流向数据</p>
      </div>
    );
  }

  const s = data.summary;
  const cards = [
    { label: "主力净流入", value: s.main_total_yi ?? 0 },
    { label: "超大单", value: s.super_total_yi ?? 0 },
    { label: "大单", value: s.large_total_yi ?? 0 },
    { label: "中单", value: s.medium_total_yi ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {cards.map((card, i) => (
          <div key={i} className="bg-transparent p-3 rounded-xl border border-white/5">
            <div className="text-[10px] font-mono text-neutral-500 mb-1">{card.label}</div>
            <div className={`text-sm font-mono font-medium ${card.value >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {card.value >= 0 ? "+" : ""}{card.value.toFixed(2)}亿
            </div>
          </div>
        ))}
      </div>

      {data.records && data.records.length > 0 && (
        <div className="bg-transparent p-3 rounded-xl border border-white/5">
          <div className="text-xs font-mono text-neutral-500 mb-2">大盘主力资金趋势</div>
          <div className="flex items-end gap-1 h-24">
            {data.records.slice(-20).map((r, i) => {
              const val = Number(r.main_net_yi) || 0;
              const h = Math.abs(val) * 4;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={`w-full rounded-t ${val >= 0 ? "bg-rose-500/60" : "bg-emerald-500/60"}`}
                    style={{ height: `${Math.min(h, 80)}px` }}
                  />
                  <div className="text-[7px] text-neutral-600 font-mono">
                    {String(r.date || "").slice(5)}
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
