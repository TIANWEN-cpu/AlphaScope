"use client";

import { useState, useEffect } from "react";
import {
  PieChart as PieChartIcon,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

interface Position {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

const MOCK_POSITIONS: Position[] = [
  { symbol: "600519", name: "贵州茅台", shares: 100, avgCost: 1680, currentPrice: 1725, pnl: 4500, pnlPercent: 2.68 },
  { symbol: "300750", name: "宁德时代", shares: 200, avgCost: 215, currentPrice: 198, pnl: -3400, pnlPercent: -7.91 },
  { symbol: "000858", name: "五粮液", shares: 300, avgCost: 152, currentPrice: 161, pnl: 2700, pnlPercent: 5.92 },
  { symbol: "601318", name: "中国平安", shares: 500, avgCost: 48.5, currentPrice: 52.3, pnl: 1900, pnlPercent: 7.84 },
];

const ALLOCATION_DATA = MOCK_POSITIONS.map((p) => ({
  name: p.name,
  value: p.shares * p.currentPrice,
}));

export function PortfolioView() {
  const [positions] = useState<Position[]>(MOCK_POSITIONS);

  const totalValue = positions.reduce((sum, p) => sum + p.shares * p.currentPrice, 0);
  const totalCost = positions.reduce((sum, p) => sum + p.shares * p.avgCost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = ((totalPnl / totalCost) * 100);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-medium text-neutral-100 flex items-center gap-3">
          <Briefcase className="w-6 h-6 text-indigo-500" />
          投资组合
        </h2>
        <p className="text-sm font-mono text-neutral-500 mt-1">实时资产追踪与持仓管理</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10 text-indigo-300">
            <DollarSign className="w-20 h-20 stroke-[0.5]" />
          </div>
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 mb-2">总资产</h3>
          <h2 className="text-3xl font-mono font-medium text-white">
            ¥{totalValue.toLocaleString()}
          </h2>
          <p className={`text-xs font-mono flex items-center gap-1 mt-2 ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalPnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {totalPnl >= 0 ? "+" : ""}¥{totalPnl.toLocaleString()} ({totalPnlPercent.toFixed(2)}%)
          </p>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">持仓数量</h3>
          <h2 className="text-3xl font-mono font-medium text-neutral-100">{positions.length}</h2>
          <p className="text-xs font-mono text-emerald-400 mt-2">
            {positions.filter((p) => p.pnl > 0).length} 盈利, {positions.filter((p) => p.pnl < 0).length} 亏损
          </p>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">总收益率</h3>
          <h2 className={`text-3xl font-mono font-medium ${totalPnlPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalPnlPercent >= 0 ? "+" : ""}{totalPnlPercent.toFixed(2)}%
          </h2>
          <p className="text-xs font-mono text-neutral-500 mt-2">基于持仓成本计算</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocation Pie Chart */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-6 pb-3 border-b border-white/5">
            资产配置
          </h3>
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ALLOCATION_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {ALLOCATION_DATA.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "#171717",
                    borderColor: "#262626",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                  }}
                  itemStyle={{ color: "#e5e5e5" }}
                  formatter={(value: number) => `¥${value.toLocaleString()}`}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-1/2 ml-4">
              {ALLOCATION_DATA.map((item, i) => (
                <div key={item.name} className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-neutral-400">{item.name}</span>
                  </div>
                  <span className="text-xs font-mono text-neutral-200">
                    ¥{(item.value / 10000).toFixed(1)}万
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Positions Table */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400">持仓明细</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-neutral-500">股票</th>
                  <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest text-neutral-500">持仓</th>
                  <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest text-neutral-500">成本</th>
                  <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest text-neutral-500">现价</th>
                  <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest text-neutral-500">盈亏</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.symbol} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm text-neutral-200">{p.name}</div>
                      <div className="text-[10px] font-mono text-neutral-500">{p.symbol}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-neutral-300">{p.shares}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-neutral-400">¥{p.avgCost}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-neutral-200">¥{p.currentPrice}</td>
                    <td className={`px-4 py-3 text-right font-mono text-sm ${p.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      <div>{p.pnl >= 0 ? "+" : ""}¥{p.pnl.toLocaleString()}</div>
                      <div className="text-[10px]">{p.pnlPercent >= 0 ? "+" : ""}{p.pnlPercent.toFixed(2)}%</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
