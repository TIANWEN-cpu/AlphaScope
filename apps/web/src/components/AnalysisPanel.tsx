"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Minus,
  Shield,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MODES } from "./Sidebar";

interface AgentResult {
  signal: string;
  confidence: number;
  reason?: string;
}

interface Evidence {
  type?: string;
  claim?: string;
  source?: string;
}

interface AnalysisPanelProps {
  mode: string;
  stockSymbol: string;
  stockName: string;
  messageCount: number;
  conversationId: string | null;
  agents?: Record<string, AgentResult>;
  evidence?: Evidence[];
  complianceNote?: string;
}

function SignalIcon({ signal }: { signal: string }) {
  const s = signal.toLowerCase();
  if (s.includes("买") || s.includes("buy")) {
    return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  }
  if (s.includes("卖") || s.includes("sell")) {
    return <TrendingDown className="h-4 w-4 text-rose-400" />;
  }
  return <Minus className="h-4 w-4 text-amber-400" />;
}

export function AnalysisPanel({
  mode,
  stockSymbol,
  stockName,
  messageCount,
  conversationId,
  agents,
  evidence,
  complianceNote,
}: AnalysisPanelProps) {
  const currentMode = MODES.find((m) => m.id === mode);
  const agentEntries = agents ? Object.entries(agents) : [];

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-hidden rounded-[2rem] border border-white/5 bg-white/[0.02] text-neutral-300 shadow-2xl shadow-black/20 backdrop-blur-md">
      <div className="border-b border-white/5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Research Monitor
            </div>
            <h2 className="mt-1 text-lg font-bold font-display">分析状态</h2>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl bg-black/40 p-4 text-white backdrop-blur-md">
          <div className="text-xs text-neutral-500">当前标的</div>
          <div className="mt-1 text-2xl font-bold">{stockSymbol || "未设置"}</div>
          <div className="text-sm text-neutral-400">{stockName || "请填写股票名称"}</div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/[0.02] p-3">
              <div className="text-neutral-500">消息</div>
              <div className="mt-1 text-lg font-semibold font-mono">{messageCount}</div>
            </div>
            <div className="rounded-xl bg-white/[0.02] p-3">
              <div className="text-neutral-500">会话</div>
              <div className="mt-1 truncate text-sm font-semibold font-mono">
                {conversationId ? `${conversationId.slice(0, 8)}...` : "新会话"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-5">
        <section>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-300">
            <Activity className="h-4 w-4 text-indigo-400" />
            当前模式
          </div>
          {currentMode && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
              <div className="font-semibold text-indigo-300">{currentMode.name}</div>
              <div className="mt-1 text-sm text-indigo-400">{currentMode.desc}</div>
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between text-sm font-semibold text-neutral-300">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-400" />
              Agent 投票
            </span>
            <span className="rounded-full bg-white/[0.02] px-2 py-0.5 text-xs text-neutral-500 font-mono">
              {agentEntries.length}
            </span>
          </div>
          {agentEntries.length > 0 ? (
            <div className="space-y-2">
              {agentEntries.map(([key, agent]) => (
                <div key={key} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 backdrop-blur-md">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-neutral-200">{key}</span>
                    <div className="flex items-center gap-1 rounded-full bg-white/[0.02] px-2 py-1 text-xs">
                      <SignalIcon signal={agent.signal} />
                      <span className="font-mono">{agent.confidence}%</span>
                    </div>
                  </div>
                  {agent.reason && <p className="mt-2 line-clamp-2 text-xs text-neutral-500">{agent.reason}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/5 bg-white/[0.02] p-4 text-sm text-neutral-500">
              发送分析请求后，这里会展示各 Agent 的观点、置信度和分歧。
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between text-sm font-semibold text-neutral-300">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-400" />
              证据链
            </span>
            <span className="rounded-full bg-white/[0.02] px-2 py-0.5 text-xs text-neutral-500 font-mono">
              {evidence?.length ?? 0}
            </span>
          </div>
          {evidence && evidence.length > 0 ? (
            <div className="space-y-2">
              {evidence.map((ev, i) => (
                <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs backdrop-blur-md">
                  {ev.type && (
                    <span className="mb-2 inline-block rounded-full bg-indigo-500/10 px-2 py-0.5 font-medium text-indigo-400">
                      {ev.type}
                    </span>
                  )}
                  <p className="text-neutral-300">{ev.claim}</p>
                  {ev.source && <p className="mt-2 text-neutral-500">来源：{ev.source}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/5 bg-white/[0.02] p-4 text-sm text-neutral-500">
              可追溯证据会在分析完成后显示。
            </div>
          )}
        </section>

        <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            风险提示
          </div>
          <p className="text-xs leading-5 text-amber-300/80">
            {complianceNote ||
              "本系统输出仅用于研究和信息整理，不构成投资建议。市场有风险，决策需结合自身风险承受能力。"}
          </p>
        </section>
      </div>
    </aside>
  );
}
