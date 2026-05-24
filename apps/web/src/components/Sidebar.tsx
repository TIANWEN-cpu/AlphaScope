"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Brain,
  GraduationCap,
  MessageSquare,
  MessageSquarePlus,
  Microscope,
  Search,
  Settings,
  Trash2,
  Zap,
} from "lucide-react";
import { listConversations, deleteConversation, type Conversation } from "@/lib/api";
import { cn } from "@/lib/utils";

export const MODES = [
  { id: "free", name: "自由问答", icon: Search, desc: "快速解释概念、指标和报告" },
  { id: "standard", name: "标准分析", icon: Zap, desc: "3 Agent 快速筛选" },
  { id: "deep", name: "深度分析", icon: Microscope, desc: "5 Agent + Critic + 主席" },
  { id: "expert", name: "专家团", icon: GraduationCap, desc: "10 位专家圆桌复盘" },
  { id: "vision", name: "K线分析", icon: BarChart3, desc: "上传图表识别趋势" },
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
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("删除对话失败:", err);
    }
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-hidden rounded-[2rem] border border-white/5 bg-white/[0.02] text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="border-b border-white/5 p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/30">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold tracking-tight">AI Finance</h1>
            <p className="font-mono text-xs text-neutral-300">Local Research Workbench</p>
          </div>
        </div>
        <button
          onClick={onClear}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-indigo-500/10"
        >
          <MessageSquarePlus className="h-4 w-4" />
          新建研究会话
        </button>
      </div>

      <div className="space-y-5 border-b border-white/5 p-5">
        <div>
          <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            研究标的
          </div>
          <div className="space-y-3 rounded-3xl border border-white/5 bg-white/[0.02] p-3">
            <label className="block">
              <span className="font-mono text-xs text-neutral-300">股票代码</span>
              <input
                type="text"
                value={stockSymbol}
                onChange={(e) => onStockSymbolChange(e.target.value)}
                placeholder="600519"
                className="mt-1 w-full rounded-2xl border border-white/10 bg-neutral-950/50 px-3 py-2 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-indigo-400"
              />
            </label>
            <label className="block">
              <span className="font-mono text-xs text-neutral-300">股票名称</span>
              <input
                type="text"
                value={stockName}
                onChange={(e) => onStockNameChange(e.target.value)}
                placeholder="贵州茅台"
                className="mt-1 w-full rounded-2xl border border-white/10 bg-neutral-950/50 px-3 py-2 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-indigo-400"
              />
            </label>
          </div>
        </div>

        <div>
          <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            分析模式
          </div>
          <div className="space-y-2">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onModeChange(m.id)}
                  className={cn(
                    "w-full rounded-2xl border p-3 text-left transition",
                    active
                      ? "border-indigo-500/50 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                      : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-xl",
                        active
                          ? "bg-indigo-500 text-white"
                          : "bg-white/10 text-neutral-300"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{m.name}</div>
                      <div className="font-mono text-xs text-neutral-300">{m.desc}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            历史会话
          </div>
          <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-xs text-neutral-300">
            {conversations.length}
          </span>
        </div>
        {loading && conversations.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-sm text-neutral-300">
            加载中...
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-sm text-neutral-300">
            暂无历史。发送第一条研究问题后会自动保存。
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onConversationSelect(conv)}
                className={cn(
                  "group flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition",
                  conversationId === conv.id
                    ? "border-indigo-500/50 bg-indigo-500/10"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                )}
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-neutral-300" />
                <span className="min-w-0 flex-1 truncate">{conv.title || "未命名会话"}</span>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="rounded-lg p-1 text-neutral-400 opacity-0 transition hover:bg-rose-500/20 hover:text-rose-300 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/5 p-4 font-mono text-xs text-neutral-400">
        <div className="flex items-center justify-between rounded-2xl bg-white/[0.02] px-3 py-2">
          <span className="flex items-center gap-2">
            <Settings className="h-3 w-3" />
            本地正式版
          </span>
          <span>v1.0.1</span>
        </div>
      </div>
    </aside>
  );
}
