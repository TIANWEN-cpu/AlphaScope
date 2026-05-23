"use client";

import { useState, useCallback } from "react";
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
  Loader2,
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
  Legend,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FundInfo {
  symbol: string;
  name: string;
  type: string;
  risk: string;
  manager: string;
  size_yi: number;
}

interface DCAResult {
  dca: {
    total_invested: number;
    total_shares: number;
    average_cost: number;
    final_value: number;
    total_return_pct: number;
    annualized_return_pct: number;
    max_drawdown_pct: number;
    volatility_pct: number;
    sharpe_ratio: number;
    monthly_records: Array<{
      date: string;
      price: number;
      invested: number;
      total_invested: number;
      current_value: number;
      return_pct: number;
    }>;
  };
  lumpsum: {
    total_invested: number;
    return_pct: number;
    final_value: number;
  };
  winner: string;
  prices: number[];
}

export function FundDcaView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [funds, setFunds] = useState<FundInfo[]>([]);
  const [selectedFund, setSelectedFund] = useState<FundInfo | null>(null);
  const [amount, setAmount] = useState(1000);
  const [frequency, setFrequency] = useState("monthly");
  const [periods, setPeriods] = useState(24);
  const [result, setResult] = useState<DCAResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async () => {
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      const res = await fetch(`${API_BASE}/api/funds/search?${params}`);
      const data = await res.json();
      if (data.success) setFunds(data.data);
    } catch {} finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleSimulate = useCallback(async () => {
    if (!selectedFund) return;
    setSimulating(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/funds/dca/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: selectedFund.symbol,
          amount_per_period: amount,
          frequency,
          periods,
        }),
      });
      const data = await res.json();
      if (data.success) setResult(data.data);
    } catch {} finally {
      setSimulating(false);
    }
  }, [selectedFund, amount, frequency, periods]);

  const chartData = result?.dca.monthly_records.map((r, i) => ({
    month: `第${i + 1}期`,
    invested: r.total_invested,
    dcaValue: r.current_value,
    lumpValue: Math.round(result.lumpsum.total_invested * (1 + result.lumpsum.return_pct / 100) * (i + 1) / (result.dca.monthly_records.length)),
  })) ?? [];

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
      <div className="glass rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="输入基金代码或名称搜索..."
            className="flex-1 bg-transparent text-neutral-200 placeholder-neutral-600 outline-none text-sm"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-mono transition-colors"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "搜索"}
          </button>
        </div>
      </div>

      {/* Fund List */}
      {funds.length > 0 && (
        <div className="glass rounded-xl p-4 mb-6">
          <h3 className="text-xs font-mono uppercase text-neutral-500 mb-3">搜索结果</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {funds.map((f) => (
              <button
                key={f.symbol}
                onClick={() => setSelectedFund(f)}
                className={`glass glass-hover rounded-lg p-3 text-left transition-all ${
                  selectedFund?.symbol === f.symbol ? "border-indigo-500/50 glow-indigo" : ""
                }`}
              >
                <div className="text-sm text-neutral-200 font-mono">{f.symbol}</div>
                <div className="text-xs text-neutral-400 truncate">{f.name}</div>
                <div className="flex gap-2 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-500">{f.type}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-500">{f.risk}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* DCA Config */}
        <div className="glass rounded-2xl p-6 lg:col-span-1">
          <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-6 flex items-center gap-2">
            <Sliders className="w-4 h-4" /> 定投参数
          </h3>

          {selectedFund && (
            <div className="mb-4 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
              <div className="text-xs font-mono text-indigo-400">{selectedFund.symbol}</div>
              <div className="text-sm text-neutral-200">{selectedFund.name}</div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-mono uppercase text-neutral-500 mb-1 block">每期投入 (元)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm font-mono text-neutral-200 outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-neutral-500 mb-1 block">定投频率</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm text-neutral-200 outline-none focus:border-indigo-500/50"
              >
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-neutral-500 mb-1 block">期数</label>
              <input
                type="number"
                value={periods}
                onChange={(e) => setPeriods(Number(e.target.value))}
                className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm font-mono text-neutral-200 outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          <button
            onClick={handleSimulate}
            disabled={simulating || !selectedFund}
            className="w-full mt-6 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-mono transition-all glow-indigo"
          >
            {simulating ? (
              <><RotateCcw className="w-4 h-4 animate-spin" /> 模拟中...</>
            ) : (
              <><Play className="w-4 h-4 fill-current" /> 运行定投模拟</>
            )}
          </button>
        </div>

        {/* DCA Result Chart */}
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-6">定投收益曲线</h3>
          {chartData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
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
                  <Legend />
                  <Line type="monotone" dataKey="invested" stroke="#52525b" strokeDasharray="5 5" dot={false} name="累计投入" />
                  <Area type="monotone" dataKey="dcaValue" stroke="#6366f1" fill="url(#dcaGradient)" strokeWidth={2} name="定投市值" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center">
              <p className="text-neutral-500 text-sm">选择基金并运行模拟查看收益曲线</p>
            </div>
          )}
        </div>
      </div>

      {/* Risk Metrics */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "定投收益率", value: `${result.dca.total_return_pct >= 0 ? "+" : ""}${result.dca.total_return_pct.toFixed(2)}%`, icon: TrendingUp, color: result.dca.total_return_pct >= 0 ? "text-emerald-400" : "text-red-400" },
            { label: "最大回撤", value: `${result.dca.max_drawdown_pct.toFixed(2)}%`, icon: ShieldAlert, color: "text-red-400" },
            { label: "年化波动率", value: `${result.dca.volatility_pct.toFixed(2)}%`, icon: Scale, color: "text-neutral-200" },
            { label: "Sharpe 比率", value: result.dca.sharpe_ratio.toFixed(2), icon: DollarSign, color: "text-indigo-400" },
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
      )}

      {/* Comparison */}
      {result && (
        <div className="glass rounded-2xl p-6 mt-6">
          <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-4">定投 vs 一次性投入</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] font-mono text-neutral-500 mb-1">定投</div>
              <div className="text-lg font-mono text-indigo-400">
                {result.dca.total_return_pct >= 0 ? "+" : ""}{result.dca.total_return_pct.toFixed(2)}%
              </div>
              <div className="text-xs text-neutral-500">
                总投入 ¥{result.dca.total_invested.toLocaleString()} → ¥{result.dca.final_value.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-neutral-500 mb-1">一次性投入</div>
              <div className="text-lg font-mono text-emerald-400">
                {result.lumpsum.return_pct >= 0 ? "+" : ""}{result.lumpsum.return_pct.toFixed(2)}%
              </div>
              <div className="text-xs text-neutral-500">
                总投入 ¥{result.lumpsum.total_invested.toLocaleString()} → ¥{result.lumpsum.final_value.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="mt-4 text-center text-sm font-mono">
            <span className="text-neutral-500">胜出策略: </span>
            <span className={result.winner === "dca" ? "text-indigo-400" : "text-emerald-400"}>
              {result.winner === "dca" ? "定投" : "一次性投入"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
