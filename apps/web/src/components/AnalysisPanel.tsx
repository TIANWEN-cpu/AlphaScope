"use client";

import {
  Activity,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  AlertTriangle,
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
  if (s.includes("买") || s.includes("buy"))
    return <TrendingUp className="w-4 h-4 text-green-600" />;
  if (s.includes("卖") || s.includes("sell"))
    return <TrendingDown className="w-4 h-4 text-red-600" />;
  return <Minus className="w-4 h-4 text-yellow-600" />;
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

  return (
    <div className="w-72 bg-gray-50 border-l flex flex-col h-full overflow-y-auto">
      {/* Context */}
      <div className="p-4 border-b bg-white">
        <div className="text-xs font-medium text-gray-500 mb-2">当前上下文</div>
        <div className="space-y-1.5 text-sm">
          {currentMode && (
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>{currentMode.name}</span>
            </div>
          )}
          {stockSymbol && (
            <div className="text-gray-700">
              {stockSymbol} {stockName}
            </div>
          )}
          <div className="text-gray-500 text-xs">{messageCount} 条消息</div>
          {conversationId && (
            <div className="text-gray-400 text-xs font-mono">
              {conversationId.slice(0, 12)}...
            </div>
          )}
        </div>
      </div>

      {/* Agent Voting */}
      {agents && Object.keys(agents).length > 0 && (
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
            <Shield className="w-4 h-4" />
            Agent 投票
          </div>
          <div className="space-y-2">
            {Object.entries(agents).map(([key, agent]) => (
              <div key={key} className="bg-white rounded-lg p-2 border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{key}</span>
                  <div className="flex items-center gap-1">
                    <SignalIcon signal={agent.signal} />
                    <span className="text-xs text-gray-500">{agent.confidence}%</span>
                  </div>
                </div>
                {agent.reason && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{agent.reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Chain */}
      {evidence && evidence.length > 0 && (
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
            <FileText className="w-4 h-4" />
            证据链
          </div>
          <div className="space-y-2">
            {evidence.map((ev, i) => (
              <div key={i} className="bg-white rounded-lg p-2 border text-xs">
                {ev.type && (
                  <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs mb-1">
                    {ev.type}
                  </span>
                )}
                <p className="text-gray-700">{ev.claim}</p>
                {ev.source && (
                  <p className="text-gray-400 mt-1">来源: {ev.source}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Note */}
      {complianceNote && (
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
            <AlertTriangle className="w-4 h-4" />
            风险提示
          </div>
          <p className="text-xs text-gray-600 bg-yellow-50 p-2 rounded border border-yellow-200">
            {complianceNote}
          </p>
        </div>
      )}

      {/* Empty state */}
      {(!agents || Object.keys(agents).length === 0) &&
        (!evidence || evidence.length === 0) && (
          <div className="p-4 text-center text-xs text-gray-400">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>发送消息后</p>
            <p>Agent 状态和证据链将在此显示</p>
          </div>
        )}
    </div>
  );
}
