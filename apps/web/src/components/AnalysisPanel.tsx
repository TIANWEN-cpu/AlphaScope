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
    return <TrendingUp className="h-4 w-4 text-emerald-600" />;
  }
  if (s.includes("卖") || s.includes("sell")) {
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  }
  return <Minus className="h-4 w-4 text-amber-600" />;
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
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white/95 text-slate-950 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="border-b border-slate-200 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Research Monitor
            </div>
            <h2 className="mt-1 text-lg font-bold">分析状态</h2>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-3xl bg-slate-950 p-4 text-white">
          <div className="text-xs text-slate-400">当前标的</div>
          <div className="mt-1 text-2xl font-bold">{stockSymbol || "未设置"}</div>
          <div className="text-sm text-slate-300">{stockName || "请填写股票名称"}</div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-2xl bg-white/10 p-3">
              <div className="text-slate-400">消息</div>
              <div className="mt-1 text-lg font-semibold">{messageCount}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <div className="text-slate-400">会话</div>
              <div className="mt-1 truncate text-sm font-semibold">
                {conversationId ? `${conversationId.slice(0, 8)}...` : "新会话"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-5">
        <section>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Activity className="h-4 w-4 text-blue-600" />
            当前模式
          </div>
          {currentMode && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="font-semibold text-blue-950">{currentMode.name}</div>
              <div className="mt-1 text-sm text-blue-700">{currentMode.desc}</div>
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-700">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-600" />
              Agent 投票
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {agentEntries.length}
            </span>
          </div>
          {agentEntries.length > 0 ? (
            <div className="space-y-2">
              {agentEntries.map(([key, agent]) => (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-800">{key}</span>
                    <div className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-xs">
                      <SignalIcon signal={agent.signal} />
                      <span>{agent.confidence}%</span>
                    </div>
                  </div>
                  {agent.reason && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{agent.reason}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              发送分析请求后，这里会展示各 Agent 的观点、置信度和分歧。
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-700">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan-600" />
              证据链
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {evidence?.length ?? 0}
            </span>
          </div>
          {evidence && evidence.length > 0 ? (
            <div className="space-y-2">
              {evidence.map((ev, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
                  {ev.type && (
                    <span className="mb-2 inline-block rounded-full bg-cyan-50 px-2 py-0.5 font-medium text-cyan-700">
                      {ev.type}
                    </span>
                  )}
                  <p className="text-slate-700">{ev.claim}</p>
                  {ev.source && <p className="mt-2 text-slate-400">来源：{ev.source}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              可追溯证据会在分析完成后显示。
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            风险提示
          </div>
          <p className="text-xs leading-5 text-amber-800">
            {complianceNote ||
              "本系统输出仅用于研究和信息整理，不构成投资建议。市场有风险，决策需结合自身风险承受能力。"}
          </p>
        </section>
      </div>
    </aside>
  );
}
