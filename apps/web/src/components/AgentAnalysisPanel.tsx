"use client";

import { useState, useEffect } from "react";
import {
  Brain,
  Play,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Shield,
  TrendingUp,
  BarChart2,
  Gauge,
} from "lucide-react";
import { runAnalysis, getFactors, type FactorReport } from "@/lib/api";

interface AgentAnalysisPanelProps {
  symbol: string;
  stockName: string;
}

type AnalysisMode = "rule" | "llm";

interface AgentResult {
  name: string;
  icon: string;
  signal: string;
  confidence: number;
  reason: string;
  vendor?: string;
  model?: string;
}

interface AnalysisResult {
  agents: AgentResult[];
  summary?: {
    final: string;
    buy: number;
    sell: number;
    hold: number;
    avg_confidence: number;
  };
}

const RULE_AGENTS = [
  { name: "技术分析师", icon: " ", desc: "MA交叉/MACD/RSI/KDJ", weight: 0.3 },
  { name: "趋势跟随者", icon: " ", desc: "均线趋势/突破信号", weight: 0.25 },
  { name: "量价分析师", icon: " ", desc: "量比/换手率/资金流向", weight: 0.25 },
  { name: "风险控制官", icon: " ", desc: "波动率/回撤/止损位", weight: 0.2 },
];

export function AgentAnalysisPanel({ symbol, stockName }: AgentAnalysisPanelProps) {
  const [mode, setMode] = useState<AnalysisMode>("rule");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [factors, setFactors] = useState<FactorReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getFactors(symbol, stockName, 30).catch(() => null);
        setFactors(res);
      } catch {
        // ignore
      }
    };
    load();
  }, [symbol, stockName]);

  const handleRun = async () => {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const res = await runAnalysis({
        stock_symbol: symbol,
        stock_name: stockName,
        mode: mode === "llm" ? "deep" : "standard",
      });
      setResult(res as unknown as AnalysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setRunning(false);
    }
  };

  const getSignalColor = (signal: string) => {
    if (signal.includes("买") || signal.includes("多") || signal.includes("bullish"))
      return "text-red-400 bg-red-500/10 border-red-500/20";
    if (signal.includes("卖") || signal.includes("空") || signal.includes("bearish"))
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    return "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
  };

  const getSignalIcon = (signal: string) => {
    if (signal.includes("买") || signal.includes("多"))
      return <TrendingUp size={12} />;
    if (signal.includes("卖") || signal.includes("空"))
      return <TrendingUp size={12} className="rotate-180" />;
    return <Shield size={12} />;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 gap-3 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <Brain size={20} className="text-purple-400" />
          Agent 协同分析
          <span className="text-xs text-zinc-500 font-normal ml-2">
            {stockName} ({symbol})
          </span>
        </h2>
      </div>

      {/* Mode selector + Run button */}
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          {[
            { id: "rule" as AnalysisMode, label: "规则引擎", desc: "4个规则Agent" },
            { id: "llm" as AnalysisMode, label: "LLM 深度分析", desc: "5个LLM + Critic + Chairman" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                mode === m.id
                  ? "border-purple-500/50 text-purple-400 bg-purple-500/10"
                  : "border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
              }`}
            >
              {m.label}
              <span className="ml-1 text-[10px] text-zinc-600">{m.desc}</span>
            </button>
          ))}
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs rounded-md transition-colors"
        >
          <Play size={14} />
          {running ? "分析中..." : "开始分析"}
        </button>
      </div>

      {/* Factor radar */}
      {factors && (
        <div className="bg-[#18181b] p-3 rounded-lg border border-zinc-800/50">
          <div className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
            <Gauge size={13} /> 量化因子概览
          </div>
          <div className="grid grid-cols-6 gap-2">
            {[
              { label: "综合", value: factors.factors.composite, color: "text-blue-400" },
              { label: "情绪", value: factors.factors.news_sentiment, color: "text-yellow-400" },
              { label: "事件", value: factors.factors.event_signal, color: "text-purple-400" },
              { label: "分析师", value: factors.factors.analyst_rating, color: "text-cyan-400" },
              { label: "资金", value: factors.factors.fund_flow, color: "text-red-400" },
              { label: "动量", value: factors.factors.momentum, color: "text-orange-400" },
            ].map((f, i) => (
              <div key={i} className="text-center">
                <div className="text-[10px] text-zinc-600 mb-1">{f.label}</div>
                <div className={`text-sm font-mono font-medium ${f.color}`}>
                  {f.value >= 0 ? "+" : ""}{f.value.toFixed(3)}
                </div>
                <div className="mt-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${f.value >= 0 ? "bg-red-500/60" : "bg-emerald-500/60"}`}
                    style={{ width: `${Math.min(Math.abs(f.value) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-xs text-red-400 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Loading */}
      {running && (
        <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
          <RefreshCw size={14} className="animate-spin mr-2" />
          {mode === "llm" ? "多Agent深度分析中，预计30-60秒..." : "规则引擎计算中..."}
        </div>
      )}

      {/* Results */}
      {result && !running && (
        <div className="space-y-4">
          {/* Summary */}
          {result.summary && (
            <div className="bg-[#18181b] p-4 rounded-lg border border-zinc-800/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-zinc-500">投票汇总</span>
                <span className={`text-sm font-medium px-3 py-1 rounded border ${getSignalColor(result.summary.final)}`}>
                  {getSignalIcon(result.summary.final)}
                  <span className="ml-1">{result.summary.final}</span>
                </span>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center">
                {[
                  { label: "买入", value: result.summary.buy, color: "text-red-400" },
                  { label: "持有", value: result.summary.hold, color: "text-zinc-300" },
                  { label: "卖出", value: result.summary.sell, color: "text-emerald-400" },
                  { label: "平均置信度", value: `${result.summary.avg_confidence.toFixed(0)}%`, color: "text-blue-400" },
                ].map((s, i) => (
                  <div key={i}>
                    <div className="text-[10px] text-zinc-500">{s.label}</div>
                    <div className={`text-lg font-mono ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent results */}
          <div className="grid grid-cols-1 gap-2">
            {result.agents?.map((agent, i) => (
              <div
                key={i}
                className="bg-[#18181b] rounded-lg border border-zinc-800/50 p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{agent.icon || " "}</span>
                    <span className="text-sm text-zinc-200 font-medium">{agent.name}</span>
                    {agent.vendor && (
                      <span className="text-[10px] text-zinc-600 font-mono">
                        {agent.vendor}/{agent.model}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded border ${getSignalColor(agent.signal)}`}>
                      {agent.signal}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">
                      {agent.confidence}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{agent.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !running && !error && (
        <div className="flex-1 flex items-center justify-center text-zinc-600">
          <div className="text-center">
            <Brain size={48} className="opacity-20 mx-auto mb-3" />
            <p className="text-sm">选择分析模式后点击「开始分析」</p>
            <p className="text-[10px] text-zinc-700 mt-1">
              规则引擎: 基于技术指标的快速研判 · LLM: 多模型深度推理
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
