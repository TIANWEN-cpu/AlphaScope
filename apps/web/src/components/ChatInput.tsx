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
    <div className="border-t bg-white p-4">
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入你的问题... (Shift+Enter 换行)"
          rows={1}
          className="flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          disabled={loading}
          style={{ minHeight: "44px", maxHeight: "120px" }}
        />
        {loading ? (
          <button
            onClick={onCancel}
            className="px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 flex items-center gap-2"
          >
            <Square className="w-4 h-4" />
            停止
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            发送
          </button>
        )}
      </div>
    </div>
  );
}
