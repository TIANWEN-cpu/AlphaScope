"use client";

import { MODES } from "./Sidebar";

interface AnalysisPanelProps {
  mode: string;
  stockSymbol: string;
  stockName: string;
  messageCount: number;
  conversationId: string | null;
}

export function AnalysisPanel({
  mode,
  stockSymbol,
  stockName,
  messageCount,
  conversationId,
}: AnalysisPanelProps) {
  const modeInfo = MODES.find((m) => m.id === mode);

  return (
    <div className="w-72 bg-white border-l p-4 overflow-y-auto">
      <h3 className="font-medium mb-3">📊 分析面板</h3>

      <div className="text-sm text-gray-600 space-y-1">
        <p>
          模式: {modeInfo?.icon} {modeInfo?.name}
        </p>
        {stockSymbol && (
          <p>
            标的: {stockName}({stockSymbol})
          </p>
        )}
        <p>消息数: {messageCount}</p>
        {conversationId && (
          <p className="text-xs text-gray-400">
            会话: {conversationId.slice(0, 8)}...
          </p>
        )}
      </div>

      <div className="mt-4 pt-4 border-t">
        <h4 className="text-sm font-medium mb-2">模式说明</h4>
        {MODES.map((m) => (
          <div key={m.id} className="text-xs text-gray-500 mb-1">
            {m.icon} <strong>{m.name}</strong>: {m.desc}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t">
        <h4 className="text-sm font-medium mb-2">数据源</h4>
        <div className="text-xs text-gray-500 space-y-0.5">
          <p>AkShare · Tushare · CNInfo</p>
          <p>SEC · HKEX · Finnhub</p>
          <p>CLS · 东财 · 财联社</p>
          <p>20+ Provider 自动发现</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t">
        <h4 className="text-sm font-medium mb-2">API 端点</h4>
        <div className="text-xs text-gray-500 space-y-0.5">
          <p>27 个 REST 端点</p>
          <p>SSE 流式聊天</p>
          <p>Pydantic Schema 验证</p>
          <p>统一错误处理</p>
        </div>
      </div>
    </div>
  );
}
