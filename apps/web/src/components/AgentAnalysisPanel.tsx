"use client";

import { useState, useEffect } from "react";
import {
  Brain,
  Play,
  RefreshCw,
  AlertTriangle,
  Shield,
  TrendingUp,
  Gauge,
} from "lucide-react";
import { runAnalysis, getFactors, type FactorReport } from "@/lib/api";
import { cn } from "@/lib/utils";

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
      return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    if (signal.includes("卖") || signal.includes("空") || signal.includes("bearish"))
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    return "text-neutral-400 bg-neutral-500/10 border-neutral-500/20";
  };

  const getSignalIcon = (signal: string) => {
    if (signal.includes("买") || signal.includes("多"))
      return <TrendingUp size={12} />;
    if (signal.includes("卖") || signal.includes("空"))
      return <TrendingUp size={12} className="rotate-180" />;
    return <Shield size={12} />;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6 gap-4 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-medium text-white flex items-center gap-3">
          <Brain size={22} className="text-indigo-400" />
          Agent 协同分析
          <span className="text-xs text-neutral-500 font-mono font-normal ml-2">
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
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg border transition-colors",
                mode === m.id
                  ? "border-indigo-500/50 text-indigo-400 bg-indigo-500/10"
                  : "border-white/5 text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]"
              )}
            >
              {m.label}
              <span className="ml-1 text-[10px] text-neutral-600">{m.desc}</span>
            </button>
          ))}
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-neutral-600 text-white text-xs rounded-lg transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)]"
        >
          <Play size={14} />
          {running ? "分析中..." : "开始分析"}
        </button>
      </div>

      {/* Factor radar */}
      {factors && (
        <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 backdrop-blur-md">
          <div className="text-xs text-neutral-500 mb-3 flex items-center gap-1 font-mono uppercase tracking-wider">
            <Gauge size={13} /> 量化因子概览
          </div>
          <div className="grid grid-cols-6 gap-3">
            {[
              { label: "综合", value: factors.factors.composite, color: "text-indigo-400" },
              { label: "情绪", value: factors.factors.news_sentiment, color: "text-yellow-400" },
              { label: "事件", value: factors.factors.event_signal, color: "text-purple-400" },
              { label: "分析师", value: factors.factors.analyst_rating, color: "text-cyan-400" },
              { label: "资金", value: factors.factors.fund_flow, color: "text-rose-400" },
              { label: "动量", value: factors.factors.momentum, color: "text-amber-400" },
            ].map((f, i) => (
              <div key={i} className="text-center">
                <div className="text-[10px] text-neutral-600 mb-1 font-mono">{f.label}</div>
                <div className={cn("text-sm font-mono font-medium", f.color)}>
                  {f.value >= 0 ? "+" : ""}{f.value.toFixed(3)}
                </div>
                <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", f.value >= 0 ? "bg-indigo-500/60" : "bg-emerald-500/60")}
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
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-400 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Loading */}
      {running && (
        <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
          <RefreshCw size={14} className="animate-spin mr-2" />
          {mode === "llm" ? "多Agent深度分析中，预计30-60秒..." : "规则引擎计算中..."}
        </div>
      )}

      {/* Results */}
      {result && !running && (
        <div className="space-y-4">
          {result.summary && (
            <div className="bg-white/[0.02] p-5 rounded-xl border border-white/5 backdrop-blur-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-neutral-500 font-mono uppercase tracking-wider">投票汇总</span>
                <span className={cn("text-sm font-medium px-3 py-1 rounded-lg border flex items-center gap-1", getSignalColor(result.summary.final))}>
                  {getSignalIcon(result.summary.final)}
                  <span>{result.summary.final}</span>
                </span>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center">
                {[
                  { label: "买入", value: result.summary.buy, color: "text-rose-400" },
                  { label: "持有", value: result.summary.hold, color: "text-neutral-300" },
                  { label: "卖出", value: result.summary.sell, color: "text-emerald-400" },
                  { label: "平均置信度", value: `${result.summary.avg_confidence.toFixed(0)}%`, color: "text-indigo-400" },
                ].map((s, i) => (
                  <div key={i}>
                    <div className="text-[10px] text-neutral-500 font-mono">{s.label}</div>
                    <div className={cn("text-lg font-mono", s.color)}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            {result.agents?.map((agent, i) => (
              <div key={i} className="bg-white/[0.02] rounded-xl border border-white/5 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{agent.icon || " "}</span>
                    <span className="text-sm text-neutral-200 font-medium">{agent.name}</span>
                    {agent.vendor && (
                      <span className="text-[10px] text-neutral-600 font-mono">
                        {agent.vendor}/{agent.model}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-lg border font-mono", getSignalColor(agent.signal))}>
                      {agent.signal}
                    </span>
                    <span className="text-xs text-neutral-500 font-mono">
                      {agent.confidence}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">{agent.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !running && !error && (
        <div className="flex-1 flex items-center justify-center text-neutral-600">
          <div className="text-center">
            <Brain size={48} className="opacity-20 mx-auto mb-3" />
            <p className="text-sm">选择分析模式后点击「开始分析」</p>
            <p className="text-[10px] text-neutral-700 mt-1 font-mono">
              规则引擎: 基于技术指标的快速研判 · LLM: 多模型深度推理
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
