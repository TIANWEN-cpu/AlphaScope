"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  MessageSquarePlus,
  Trash2,
  MessageSquare,
  Search,
  Zap,
  Microscope,
  GraduationCap,
  BarChart3,
  Settings,
} from "lucide-react";
import { listConversations, deleteConversation, type Conversation } from "@/lib/api";

export const MODES = [
  { id: "free", name: "自由问答", icon: Search, desc: "快速问答" },
  { id: "standard", name: "标准分析", icon: Zap, desc: "3 Agent 快速" },
  { id: "deep", name: "深度分析", icon: Microscope, desc: "5 Agent + Critic" },
  { id: "expert", name: "专家团", icon: GraduationCap, desc: "多专家圆桌" },
  { id: "vision", name: "K线分析", icon: BarChart3, desc: "上传图表分析" },
];

interface SidebarProps {
  stockSymbol: string;
  stockName: string;
  mode: string;
  conversationId: string | null;
  onStockSymbolChange: (v: string) => void;
  onStockNameChange: (v: string) => void;
  onModeChange: (v: string) => void;
  onClear: () => void;
  onConversationSelect: (conv: Conversation) => void;
  refreshKey: number;
}

export function Sidebar({
  stockSymbol,
  stockName,
  mode,
  conversationId,
  onStockSymbolChange,
  onStockNameChange,
  onModeChange,
  onClear,
  onConversationSelect,
  refreshKey,
}: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listConversations(undefined, 50)
      .then((data) => setConversations(data?.conversations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conversationId, refreshKey]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="w-64 bg-gray-50 border-r flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold">AI Finance</h1>
        </div>
        <button
          onClick={onClear}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <MessageSquarePlus className="w-4 h-4" />
          新建会话
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <div className="text-xs font-medium text-gray-500 px-2 py-1">历史会话</div>
          {loading && conversations.length === 0 ? (
            <div className="text-xs text-gray-400 px-2 py-2">加载中...</div>
          ) : conversations.length === 0 ? (
            <div className="text-xs text-gray-400 px-2 py-2">暂无会话</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onConversationSelect(conv)}
                className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm ${
                  conversationId === conv.id
                    ? "bg-blue-100 text-blue-700"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1">{conv.title || "未命名会话"}</span>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Stock Inputs */}
      <div className="p-3 border-t bg-white space-y-2">
        <div>
          <label className="text-xs font-medium text-gray-500">股票代码</label>
          <input
            type="text"
            value={stockSymbol}
            onChange={(e) => onStockSymbolChange(e.target.value)}
            placeholder="600519"
            className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">股票名称</label>
          <input
            type="text"
            value={stockName}
            onChange={(e) => onStockNameChange(e.target.value)}
            placeholder="贵州茅台"
            className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
          />
        </div>
      </div>

      {/* Mode Selector */}
      <div className="p-3 border-t">
        <div className="text-xs font-medium text-gray-500 mb-2">分析模式</div>
        <div className="space-y-1">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                  mode === m.id
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
              >
                <Icon className="w-4 h-4" />
                {m.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t bg-white flex items-center gap-2 text-xs text-gray-400">
        <Settings className="w-3 h-3" />
        v0.46 · 5 模式 · 43 API
      </div>
    </div>
  );
}
