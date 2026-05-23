"use client";

import { useState } from "react";
import {
  Play,
  Settings2,
  TrendingUp,
  History,
  BarChart,
  Activity,
  Code2,
  Layers,
  Cpu,
  CheckCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

const TABS = [
  { id: "overview", label: "回测大厅", icon: History },
  { id: "workshop", label: "策略工坊", icon: Code2 },
  { id: "pool", label: "股票池解析", icon: Layers },
  { id: "compare", label: "实盘比对", icon: Activity },
];

const MOCK_EQUITY_CURVE = Array.from({ length: 40 }).map((_, i) => ({
  month: `M${i + 1}`,
  strategy: Math.round(10000 * Math.pow(1.015, i) * (1 + (Math.random() * 0.1 - 0.03))),
  benchmark: Math.round(10000 * Math.pow(1.006, i)),
}));

const MOCK_STRATEGIES = [
  { id: "1", name: "MACD 动量策略", type: "趋势跟踪", returnRate: 42.5, maxDrawdown: -12.4, sharpe: 1.8, winRate: 64 },
  { id: "2", name: "均值回归策略", type: "统计套利", returnRate: 18.2, maxDrawdown: -6.1, sharpe: 2.1, winRate: 58 },
  { id: "3", name: "RSI 超买超卖", type: "反转", returnRate: 28.7, maxDrawdown: -9.3, sharpe: 1.5, winRate: 61 },
];

export function BacktestView() {
  const [activeTab, setActiveTab] = useState("overview");
  const [running, setRunning] = useState(false);

  const runTest = () => {
    setRunning(true);
    setTimeout(() => setRunning(false), 2000);
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1600px] mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-medium text-white flex items-center gap-3">
            <Cpu className="w-6 h-6 text-indigo-500" />
            金策智算引擎
            <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block mr-1.5 animate-pulse-glow" />
              CORE-V2
            </span>
          </h2>
          <p className="text-sm font-mono text-neutral-400 mt-1">量化策略验证与回测执行中枢</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 relative ${
                activeTab === tab.id ? "text-white" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="backtest-tab"
                  className="absolute inset-0 bg-white/10 rounded-lg border border-white/10"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <tab.icon className="w-4 h-4 relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Action Bar */}
              <div className="flex justify-end mb-6 gap-4">
                <button className="px-5 py-2.5 glass glass-hover rounded-lg flex items-center gap-2 text-xs font-mono uppercase text-neutral-300">
                  <Settings2 className="w-4 h-4" /> 回测参数
                </button>
                <button
                  onClick={runTest}
                  disabled={running}
                  className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white border border-indigo-500/50 rounded-lg flex items-center gap-2 text-xs font-mono uppercase transition-all glow-indigo"
                >
                  {running ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  {running ? "引擎计算中..." : "启动回测"}
                </button>
              </div>

              {/* Strategy List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {MOCK_STRATEGIES.map((s) => (
                  <div key={s.id} className="glass glass-hover rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-neutral-200">{s.name}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                        {s.type}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-neutral-500">收益率</div>
                        <div className="text-lg font-mono text-emerald-400">+{s.returnRate}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase text-neutral-500">最大回撤</div>
                        <div className="text-lg font-mono text-red-400">{s.maxDrawdown}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase text-neutral-500">Sharpe</div>
                        <div className="text-lg font-mono text-neutral-200">{s.sharpe}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase text-neutral-500">胜率</div>
                        <div className="text-lg font-mono text-neutral-200">{s.winRate}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Equity Curve */}
              <div className="glass rounded-2xl p-6">
                <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-6">权益曲线</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MOCK_EQUITY_CURVE}>
                      <defs>
                        <linearGradient id="strategyGradient" x1="0" y1="0" x2="0" y2="1">
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
                      <ReferenceLine y={10000} stroke="#52525b" strokeDasharray="3 3" />
                      <Area
                        type="monotone"
                        dataKey="strategy"
                        stroke="#6366f1"
                        fill="url(#strategyGradient)"
                        strokeWidth={2}
                        name="策略"
                      />
                      <Line
                        type="monotone"
                        dataKey="benchmark"
                        stroke="#52525b"
                        strokeDasharray="5 5"
                        dot={false}
                        name="基准"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "workshop" && (
            <motion.div
              key="workshop"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass rounded-2xl p-8 text-center"
            >
              <Code2 className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
              <h3 className="text-lg text-neutral-200 mb-2">策略工坊</h3>
              <p className="text-sm text-neutral-500">自定义策略编辑与参数调优（v1.1.2 完善）</p>
            </motion.div>
          )}

          {activeTab === "pool" && (
            <motion.div
              key="pool"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass rounded-2xl p-8 text-center"
            >
              <Layers className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
              <h3 className="text-lg text-neutral-200 mb-2">股票池解析</h3>
              <p className="text-sm text-neutral-500">批量回测与股票池管理（v1.1.2 完善）</p>
            </motion.div>
          )}

          {activeTab === "compare" && (
            <motion.div
              key="compare"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass rounded-2xl p-8 text-center"
            >
              <Activity className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
              <h3 className="text-lg text-neutral-200 mb-2">实盘比对</h3>
              <p className="text-sm text-neutral-500">回测结果与实盘表现对比（v1.1.2 完善）</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
