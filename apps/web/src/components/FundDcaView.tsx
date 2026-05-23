"use client";

import { useState } from "react";
import {
  Coins,
  Search,
  TrendingUp,
  ShieldAlert,
  Scale,
  Sliders,
  Play,
  RotateCcw,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

const MOCK_DCA_RESULT = Array.from({ length: 24 }).map((_, i) => ({
  month: `第${i + 1}月`,
  dcaReturn: Math.round(1000 * (i + 1) * (1 + (Math.random() * 0.2 - 0.05))),
  lumpSum: Math.round(24000 * (1 + (Math.random() * 0.3 - 0.1))),
  invested: 1000 * (i + 1),
}));

export function FundDcaView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [simulating, setSimulating] = useState(false);

  const handleSimulate = () => {
    setSimulating(true);
    setTimeout(() => setSimulating(false), 2000);
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-medium text-neutral-100 flex items-center gap-3">
          <Coins className="w-6 h-6 text-indigo-500" />
          基金与定投研究室
        </h2>
        <p className="text-sm font-mono text-neutral-500 mt-1">基金筛选、定投模拟与风险评估</p>
      </div>

      {/* Search Bar */}
      <div className="glass rounded-xl p-4 mb-8">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="输入基金代码或名称搜索..."
            className="flex-1 bg-transparent text-neutral-200 placeholder-neutral-600 outline-none text-sm"
          />
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-mono transition-colors">
            搜索
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* DCA Simulation Config */}
        <div className="glass rounded-2xl p-6 lg:col-span-1">
          <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-6 flex items-center gap-2">
            <Sliders className="w-4 h-4" /> 定投参数
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-mono uppercase text-neutral-500 mb-1 block">每期投入 (元)</label>
              <input
                type="number"
                defaultValue={1000}
                className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm font-mono text-neutral-200 outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-neutral-500 mb-1 block">定投频率</label>
              <select className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm text-neutral-200 outline-none focus:border-indigo-500/50">
                <option>每周</option>
                <option>每两周</option>
                <option>每月</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-neutral-500 mb-1 block">起始日期</label>
              <input
                type="date"
                defaultValue="2024-01-01"
                className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm font-mono text-neutral-200 outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-neutral-500 mb-1 block">结束日期</label>
              <input
                type="date"
                defaultValue="2025-12-31"
                className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm font-mono text-neutral-200 outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="w-full mt-6 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-mono transition-all glow-indigo"
          >
            {simulating ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" /> 模拟中...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> 运行定投模拟
              </>
            )}
          </button>
        </div>

        {/* DCA Result Chart */}
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-6">定投收益曲线</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_DCA_RESULT}>
                <defs>
                  <linearGradient id="dcaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" stroke="#52525b" tick={{ fontSize: 10, fontFamily: "monospace" }} />
                <YAxis stroke="#52525b" tick={{ fontSize: 10, fontFamily: "monospace" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#171717",
                    borderColor: "#262626",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                  }}
                  itemStyle={{ color: "#e5e5e5" }}
                />
                <Line type="monotone" dataKey="invested" stroke="#52525b" strokeDasharray="5 5" dot={false} name="累计投入" />
                <Area type="monotone" dataKey="dcaReturn" stroke="#6366f1" fill="url(#dcaGradient)" strokeWidth={2} name="定投市值" />
                <Line type="monotone" dataKey="lumpSum" stroke="#10b981" dot={false} name="一次性投入" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Risk Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "定投收益率", value: "+18.5%", icon: TrendingUp, color: "text-emerald-400" },
          { label: "最大回撤", value: "-8.2%", icon: ShieldAlert, color: "text-red-400" },
          { label: "年化波动率", value: "15.3%", icon: Scale, color: "text-neutral-200" },
          { label: "Sharpe 比率", value: "1.24", icon: DollarSign, color: "text-indigo-400" },
        ].map((m) => (
          <div key={m.label} className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <m.icon className="w-4 h-4 text-neutral-500" />
              <span className="text-[10px] font-mono uppercase text-neutral-500">{m.label}</span>
            </div>
            <div className={`text-xl font-mono font-medium ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
