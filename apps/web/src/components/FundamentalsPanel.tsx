"use client";

import { useState, useEffect } from "react";
import {
  PieChart,
  RefreshCw,
  Users,
  Building2,
  Award,
} from "lucide-react";
import {
  getFundamentals,
  getShareholders,
  getPeers,
} from "@/lib/api";
import { cn } from "@/lib/utils";

interface FundamentalsPanelProps {
  symbol: string;
  stockName: string;
}

type SubTab = "overview" | "shareholders" | "peers";

export function FundamentalsPanel({ symbol, stockName }: FundamentalsPanelProps) {
  const [activeTab, setActiveTab] = useState<SubTab>("overview");
  const [fundData, setFundData] = useState<any>(null);
  const [holders, setHolders] = useState<any>(null);
  const [peers, setPeers] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [fundRes, holdersRes, peersRes] = await Promise.all([
          getFundamentals(symbol).catch(() => null),
          getShareholders(symbol).catch(() => null),
          getPeers(symbol).catch(() => null),
        ]);
        setFundData(fundRes);
        setHolders(holdersRes);
        setPeers(peersRes);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [symbol]);

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 gap-3 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-semibold text-neutral-100 flex items-center gap-2">
          <PieChart size={20} className="text-cyan-400" />
          基本面分析
          <span className="text-xs text-neutral-500 font-normal ml-2">
            {stockName} ({symbol})
          </span>
        </h2>
      </div>

      <div className="flex gap-2">
        {[
          { id: "overview" as SubTab, label: "财务概览", icon: <PieChart size={13} /> },
          { id: "shareholders" as SubTab, label: "股东结构", icon: <Users size={13} /> },
          { id: "peers" as SubTab, label: "行业对比", icon: <Building2 size={13} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors",
              activeTab === tab.id
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                : "border-white/5 text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]"
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
          <RefreshCw size={14} className="animate-spin mr-2" />
          加载基本面数据...
        </div>
      ) : activeTab === "overview" ? (
        <OverviewTab data={fundData} />
      ) : activeTab === "shareholders" ? (
        <ShareholdersTab data={holders} />
      ) : (
        <PeersTab data={peers} />
      )}
    </div>
  );
}

function OverviewTab({ data }: { data: any }) {
  if (!data) {
    return <div className="text-neutral-600 text-sm text-center py-8">暂无财务数据</div>;
  }

  const periods: any[] = data.financial_periods || [];
  const valuation: any = data.valuation || {};
  const score: any = data.fundamental_score || {};
  const latest: any = periods[0];

  const metricCards = [
    { label: "市盈率(TTM)", value: valuation.pe ? String(valuation.pe) : "--" },
    { label: "市净率(MRQ)", value: valuation.pb ? String(valuation.pb) : "--" },
    { label: "ROE", value: latest ? `${Number(latest.roe_pct).toFixed(1)}%` : "--" },
    { label: "营业总收入", value: latest ? `${Number(latest.revenue_yi).toFixed(1)}亿` : "--" },
    { label: "净利润", value: latest ? `${Number(latest.net_profit_yi).toFixed(1)}亿` : "--" },
    { label: "毛利率", value: latest ? `${Number(latest.gross_margin_pct).toFixed(1)}%` : "--" },
    { label: "资产负债率", value: latest ? `${Number(latest.debt_ratio_pct).toFixed(1)}%` : "--" },
    { label: "综合评分", value: score.total_score ? `${Number(score.total_score).toFixed(0)}分 (${String(score.grade || "")})` : "--" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {metricCards.map((card, i) => (
          <div key={i} className="bg-black/40 p-3 rounded-lg border border-white/5">
            <div className="text-[10px] font-mono text-neutral-500 mb-1">{card.label}</div>
            <div className="text-sm font-mono text-neutral-200">{card.value}</div>
          </div>
        ))}
      </div>

      {score.dimension_scores && (
        <div className="bg-black/40 p-3 rounded-lg border border-white/5">
          <div className="text-xs font-mono text-neutral-500 mb-2">评分维度</div>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(score.dimension_scores as Record<string, number>).map(([key, val]) => (
              <div key={key} className="text-center">
                <div className="text-[10px] font-mono text-neutral-600 mb-1">{key}</div>
                <div className="text-sm font-mono text-neutral-300">{String(val)}</div>
                <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500/60 rounded-full"
                    style={{ width: `${Math.min(Number(val), 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {periods.length > 0 && (
        <div className="bg-black/40 p-3 rounded-lg border border-white/5">
          <div className="text-xs font-mono text-neutral-500 mb-2">近四期财务趋势</div>
          <div className="grid grid-cols-4 gap-2">
            {periods.slice(0, 4).map((p: any, i: number) => (
              <div key={i} className="bg-black/20 p-2 rounded border border-white/5 text-center">
                <div className="text-[10px] font-mono text-neutral-600">{String(p.period || "")}</div>
                <div className="text-sm font-mono text-neutral-300">
                  {Number(p.revenue_yi || 0).toFixed(1)}亿
                </div>
                <div className="text-[10px] font-mono text-neutral-500">
                  净利 {Number(p.net_profit_yi || 0).toFixed(1)}亿
                </div>
                <div className={`text-[10px] font-mono ${
                  Number(p.yoy_revenue_pct || 0) >= 0 ? "text-rose-400" : "text-emerald-400"
                }`}>
                  {Number(p.yoy_revenue_pct || 0) >= 0 ? "+" : ""}
                  {Number(p.yoy_revenue_pct || 0).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ShareholdersTab({ data }: { data: any }) {
  if (!data) {
    return <div className="text-neutral-600 text-sm text-center py-8">暂无股东数据</div>;
  }

  const topHolders: any[] = data.top_holders || [];
  const circHolders: any[] = data.circulate_holders || [];
  const instChanges: any[] = data.institutional_changes || [];

  const sections = [
    { title: "十大股东", data: topHolders, icon: <Users size={14} className="text-indigo-400" /> },
    { title: "十大流通股东", data: circHolders, icon: <Users size={14} className="text-purple-400" /> },
    { title: "机构变动", data: instChanges, icon: <Building2 size={14} className="text-amber-400" /> },
  ];

  return (
    <div className="space-y-4">
      {sections.map((section, si) => (
        <div key={si} className="bg-black/40 rounded-lg border border-white/5 overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-white/5">
            {section.icon}
            <span className="text-xs font-mono text-neutral-300 font-medium">{section.title}</span>
            <span className="text-[10px] font-mono text-neutral-600">({section.data.length}人)</span>
          </div>
          {section.data.length === 0 ? (
            <div className="p-4 text-xs font-mono text-neutral-600 text-center">暂无数据</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-3 py-2 text-left font-mono text-neutral-500 font-normal">#</th>
                    <th className="px-3 py-2 text-left font-mono text-neutral-500 font-normal">股东名称</th>
                    <th className="px-3 py-2 text-right font-mono text-neutral-500 font-normal">持股(亿股)</th>
                    <th className="px-3 py-2 text-right font-mono text-neutral-500 font-normal">持股比例</th>
                    <th className="px-3 py-2 text-center font-mono text-neutral-500 font-normal">变动</th>
                  </tr>
                </thead>
                <tbody>
                  {section.data.map((h: any, i: number) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-3 py-1.5 font-mono text-neutral-500">{Number(h.rank || i + 1)}</td>
                      <td className="px-3 py-1.5 font-mono text-neutral-300">{String(h.name || "")}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-neutral-300">
                        {Number(h.shares_yi || 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-neutral-300">
                        {Number(h.ratio_pct || 0).toFixed(2)}%
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={cn(
                          "text-[10px] font-mono px-1.5 py-0.5 rounded",
                          String(h.change_type || "").includes("增")
                            ? "bg-rose-500/10 text-rose-400"
                            : String(h.change_type || "").includes("减")
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-white/5 text-neutral-500"
                        )}>
                          {String(h.change_type || "不变")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PeersTab({ data }: { data: any }) {
  if (!data) {
    return <div className="text-neutral-600 text-sm text-center py-8">暂无行业对比数据</div>;
  }

  const industry = String(data.industry || "");
  const peerList: any[] = data.peers || [];

  return (
    <div className="space-y-4">
      <div className="bg-black/40 p-3 rounded-lg border border-white/5">
        <div className="text-xs font-mono text-neutral-500 mb-1">所属行业</div>
        <div className="text-sm font-mono text-neutral-200 flex items-center gap-2">
          <Building2 size={14} className="text-cyan-400" />
          {industry || "未知"}
        </div>
      </div>

      {peerList.length > 0 && (
        <div className="bg-black/40 rounded-lg border border-white/5 overflow-hidden">
          <div className="p-3 border-b border-white/5 text-xs font-mono text-neutral-500">
            同行业对比 ({peerList.length}家)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-3 py-2 text-left font-mono text-neutral-500 font-normal">代码</th>
                  <th className="px-3 py-2 text-left font-mono text-neutral-500 font-normal">名称</th>
                  <th className="px-3 py-2 text-right font-mono text-neutral-500 font-normal">总市值(亿)</th>
                  <th className="px-3 py-2 text-right font-mono text-neutral-500 font-normal">PE</th>
                  <th className="px-3 py-2 text-right font-mono text-neutral-500 font-normal">PB</th>
                  <th className="px-3 py-2 text-center font-mono text-neutral-500 font-normal">标记</th>
                </tr>
              </thead>
              <tbody>
                {peerList.map((p: any, i: number) => (
                  <tr key={i} className={cn(
                    "border-b border-white/5 hover:bg-white/[0.02]",
                    p.is_self && "bg-indigo-500/5"
                  )}>
                    <td className="px-3 py-1.5 font-mono text-neutral-400">{String(p.symbol || "")}</td>
                    <td className="px-3 py-1.5 font-mono text-neutral-300">{String(p.name || "")}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-neutral-300">
                      {Number(p.total_mcap_yi || 0).toFixed(0)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-neutral-300">
                      {Number(p.pe || 0).toFixed(1)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-neutral-300">
                      {Number(p.pb || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {p.is_self && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <Award size={10} className="inline mr-0.5" /> 自身
                        </span>
                      )}
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
