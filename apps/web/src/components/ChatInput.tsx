"use client";

import { useState } from "react";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  loading: boolean;
  onCancel: () => void;
}

export function ChatInput({ onSend, loading, onCancel }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim() || loading) return;
    onSend(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
      <div className="mx-auto max-w-4xl rounded-[1.5rem] border border-slate-200 bg-slate-50 p-2 shadow-sm">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入研究问题，例如：分析 600519 的基本面、消息面和风险..."
            rows={1}
            className="min-h-12 flex-1 resize-none rounded-2xl border-0 bg-transparent px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            disabled={loading}
            style={{ maxHeight: "120px" }}
          />
          {loading ? (
            <button
              onClick={onCancel}
              className="flex items-center gap-2 rounded-2xl bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-600"
            >
              <Square className="h-4 w-4" />
              停止
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              发送
            </button>
          )}
        </div>
        <div className="flex items-center justify-between px-4 pb-1 text-xs text-slate-400">
          <span>Enter 发送 · Shift + Enter 换行</span>
          <span>输出包含风险提示，不构成投资建议</span>
        </div>
      </div>
    </div>
  );
}
