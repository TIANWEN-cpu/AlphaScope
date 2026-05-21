"use client";

import ReactMarkdown from "react-markdown";
import { MODES } from "./Sidebar";
import { TrendingUp, TrendingDown, Minus, Link, Shield, Clock } from "lucide-react";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  mode?: string;
  agents?: Record<string, { signal: string; confidence: number; reason: string }>;
  evidence?: Array<{ type: string; claim: string }>;
  compliance_note?: string;
  timestamp: string;
}

function SignalIcon({ signal }: { signal: string }) {
  const s = signal.toLowerCase();
  if (s.includes("买") || s.includes("buy"))
    return <TrendingUp className="w-3 h-3 text-green-600 inline" />;
  if (s.includes("卖") || s.includes("sell"))
    return <TrendingDown className="w-3 h-3 text-red-600 inline" />;
  return <Minus className="w-3 h-3 text-yellow-600 inline" />;
}

export function MessageBubble({
  role,
  content,
  mode,
  agents,
  evidence,
  compliance_note,
  timestamp,
}: MessageBubbleProps) {
  const modeInfo = MODES.find((m) => m.id === mode);

  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-3xl rounded-2xl px-4 py-3 ${
          role === "user" ? "bg-blue-600 text-white" : "bg-white border shadow-sm"
        }`}
      >
        {role === "assistant" && modeInfo && (
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
            {modeInfo.icon && <modeInfo.icon className="w-3 h-3" />}
            {modeInfo.name}
          </div>
        )}

        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>

        {/* Agent Voting */}
        {agents && Object.keys(agents).length > 0 && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-gray-500 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Agent 投票详情
            </summary>
            <div className="mt-1 space-y-1">
              {Object.entries(agents).map(([key, agent]) => (
                <div key={key} className="flex justify-between gap-2">
                  <span className="font-medium">{key}</span>
                  <span>
                    <SignalIcon signal={agent.signal} />{" "}
                    <span
                      className={
                        agent.signal === "买入"
                          ? "text-green-600"
                          : agent.signal === "卖出"
                          ? "text-red-600"
                          : "text-yellow-600"
                      }
                    >
                      {agent.signal}
                    </span>{" "}
                    ({agent.confidence}%)
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Evidence Chain */}
        {evidence && evidence.length > 0 && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-gray-500 flex items-center gap-1">
              <Link className="w-3 h-3" /> 证据链 ({evidence.length} 条)
            </summary>
            <div className="mt-1 space-y-1">
              {evidence.map((ev, j) => (
                <div key={j}>
                  <span className="text-gray-400">[{ev.type}]</span> {ev.claim}
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Compliance Note */}
        {compliance_note && (
          <div className="mt-2 text-xs text-gray-400 italic border-t pt-1">
            {compliance_note}
          </div>
        )}

        {timestamp && (
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
            <Clock className="w-3 h-3" />
            {timestamp}
          </div>
        )}
      </div>
    </div>
  );
}
