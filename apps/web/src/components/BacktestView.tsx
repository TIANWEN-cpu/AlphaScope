"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Settings2,
  History,
  Code2,
  Layers,
  Activity,
  Cpu,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  listStrategies,
  runBacktest,
  type StrategyInfo,
  type BacktestResultData,
} from "@/lib/api";
import { EquityCurveChart } from "./EquityCurveChart";
import { RiskMetricsPanel } from "./RiskMetricsPanel";
import { StrategyCard } from "./StrategyCard";

const TABS = [
  { id: "overview", label: "回测大厅", icon: History },
  { id: "workshop", label: "策略工坊", icon: Code2 },
  { id: "pool", label: "股票池解析", icon: Layers },
  { id: "compare", label: "实盘比对", icon: Activity },
];

export function BacktestView() {
  const [activeTab, setActiveTab] = useState("overview");
  const [strategies, setStrategies] = useState<StrategyInfo[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string>("");
  const [symbol, setSymbol] = useState("600519");
  const [days, setDays] = useState(120);
  const [capital, setCapital] = useState(100000);
  const [result, setResult] = useState<BacktestResultData | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listStrategies()
      .then(setStrategies)
      .catch(() => {});
  }, []);

  const handleRun = useCallback(async () => {
    if (!selectedStrategy) return;
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const data = await runBacktest({
        strategy_name: selectedStrategy,
        symbol,
        initial_capital: capital,
        days,
      });
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "回测失败");
    } finally {
      setRunning(false);
    }
  }, [selectedStrategy, symbol, days, capital]);

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
              V1.1.2
            </span>
          </h2>
          <p className="text-sm font-mono text-neutral-400 mt-1">
            量化策略验证与回测执行中枢
          </p>
        </div>

        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 relative ${
                activeTab === tab.id
                  ? "text-white"
                  : "text-neutral-500 hover:text-neutral-300"
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

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Parameters */}
              <div className="glass rounded-2xl p-6 mb-6">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">
                      策略
                    </label>
                    <select
                      value={selectedStrategy}
                      onChange={(e) => setSelectedStrategy(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500/50"
                    >
                      <option value="">选择策略...</option>
                      {strategies.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <label className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">
                      股票代码
                    </label>
                    <input
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500/50"
                      placeholder="600519"
                    />
                  </div>
                  <div className="w-28">
                    <label className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">
                      天数
                    </label>
                    <input
                      type="number"
                      value={days}
                      onChange={(e) => setDays(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <div className="w-36">
                    <label className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">
                      初始资金
                    </label>
                    <input
                      type="number"
                      value={capital}
                      onChange={(e) => setCapital(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <button
                    onClick={handleRun}
                    disabled={running || !selectedStrategy}
                    className="px-8 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white border border-indigo-500/50 rounded-lg flex items-center gap-2 text-xs font-mono uppercase transition-all glow-indigo"
                  >
                    {running ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    {running ? "计算中..." : "启动回测"}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="glass rounded-xl p-4 mb-6 border-red-500/20 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span className="text-sm text-red-300">{error}</span>
                </div>
              )}

              {/* Results */}
              {result && (
                <>
                  <div className="mb-6">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-4">
                      风险指标
                    </h3>
                    <RiskMetricsPanel metrics={result.performance} />
                  </div>

                  <div className="glass rounded-2xl p-6 mb-6">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-4">
                      权益曲线 — {result.strategy_name} / {result.symbol}
                    </h3>
                    <EquityCurveChart
                      equityCurve={result.equity_curve}
                      dates={result.dates}
                      initialCapital={result.performance.initial_capital}
                      trades={result.trades}
                    />
                  </div>

                  {/* Trades Table */}
                  {result.trades.length > 0 && (
                    <div className="glass rounded-2xl p-6">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-4">
                        交易记录 ({result.trades.length} 笔)
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs font-mono">
                          <thead>
                            <tr className="text-neutral-500 border-b border-white/5">
                              <th className="text-left py-2 px-3">时间</th>
                              <th className="text-left py-2 px-3">方向</th>
                              <th className="text-right py-2 px-3">数量</th>
                              <th className="text-right py-2 px-3">价格</th>
                              <th className="text-right py-2 px-3">手续费</th>
                              <th className="text-right py-2 px-3">盈亏</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.trades.map((t, i) => (
                              <tr
                                key={i}
                                className="border-b border-white/5 hover:bg-white/[0.02]"
                              >
                                <td className="py-2 px-3 text-neutral-400">
                                  {t.timestamp}
                                </td>
                                <td className="py-2 px-3">
                                  <span
                                    className={
                                      t.side === "buy"
                                        ? "text-emerald-400"
                                        : "text-red-400"
                                    }
                                  >
                                    {t.side === "buy" ? "买入" : "卖出"}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right text-neutral-300">
                                  {t.shares}
                                </td>
                                <td className="py-2 px-3 text-right text-neutral-300">
                                  {t.price.toFixed(2)}
                                </td>
                                <td className="py-2 px-3 text-right text-neutral-500">
                                  {t.commission.toFixed(2)}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right ${
                                    t.pnl >= 0
                                      ? "text-emerald-400"
                                      : "text-red-400"
                                  }`}
                                >
                                  {t.pnl >= 0 ? "+" : ""}
                                  {t.pnl.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Risk Violations */}
                  {result.risk_violations.length > 0 && (
                    <div className="glass rounded-2xl p-6 mt-6">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-4">
                        风控违规记录 ({result.risk_violations.length})
                      </h3>
                      <div className="space-y-2">
                        {result.risk_violations.map((v, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 text-xs"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-neutral-500 font-mono">
                              {v.timestamp}
                            </span>
                            <span className="text-amber-300">{v.rule}</span>
                            <span className="text-neutral-400">
                              {v.details}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Strategy List (when no result) */}
              {!result && !error && (
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-4">
                    可用策略
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {strategies.map((s) => (
                      <StrategyCard
                        key={s.name}
                        name={s.name}
                        description={s.description}
                        defaultParams={s.default_params}
                        selected={selectedStrategy === s.name}
                        onSelect={() => setSelectedStrategy(s.name)}
                        onRun={() => {
                          setSelectedStrategy(s.name);
                          handleRun();
                        }}
                      />
                    ))}
                    {strategies.length === 0 && (
                      <div className="col-span-full glass rounded-2xl p-8 text-center">
                        <Settings2 className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
                        <p className="text-sm text-neutral-500">
                          正在加载策略...
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "workshop" && (
            <motion.div
              key="workshop"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="glass rounded-2xl p-6 mb-6">
                <h3 className="text-sm font-medium text-neutral-200 mb-4">
                  策略参数调优
                </h3>
                {selectedStrategy ? (
                  <div>
                    <p className="text-xs text-neutral-400 mb-4">
                      当前策略:{" "}
                      <span className="text-indigo-400 font-mono">
                        {selectedStrategy}
                      </span>
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(
                        strategies.find((s) => s.name === selectedStrategy)
                          ?.default_params ?? {}
                      ).map(([key, val]) => (
                        <div key={key}>
                          <label className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">
                            {key}
                          </label>
                          <input
                            type="number"
                            defaultValue={val}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500/50"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">
                    请先在回测大厅选择一个策略
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "pool" && (
            <motion.div
              key="pool"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="glass rounded-2xl p-8 text-center">
                <Layers className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
                <h3 className="text-lg text-neutral-200 mb-2">股票池解析</h3>
                <p className="text-sm text-neutral-500">
                  批量回测与股票池管理功能开发中
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === "compare" && (
            <motion.div
              key="compare"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="glass rounded-2xl p-8 text-center">
                <Activity className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
                <h3 className="text-lg text-neutral-200 mb-2">实盘比对</h3>
                <p className="text-sm text-neutral-500">
                  回测结果与实盘表现对比功能开发中
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
