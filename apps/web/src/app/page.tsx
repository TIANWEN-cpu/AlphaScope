"use client";

import { useRef, useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { MessageBubble } from "@/components/MessageBubble";
import { ChatInput } from "@/components/ChatInput";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { useChat } from "@/hooks/useChat";
import type { Conversation } from "@/lib/api";

export default function ChatPage() {
  const {
    messages,
    loading,
    conversationId,
    streamingContent,
    sendMessage,
    cancel,
    clearMessages,
    loadConversation,
  } = useChat();

  const [mode, setMode] = useState("free");
  const [stockSymbol, setStockSymbol] = useState("");
  const [stockName, setStockName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = (content: string) => {
    sendMessage(content, mode, stockSymbol, stockName);
  };

  const handleClear = () => {
    clearMessages();
    setRefreshKey((k) => k + 1);
  };

  const handleConversationSelect = (conv: Conversation) => {
    loadConversation(conv.id);
  };

  // Get latest agent/evidence data from messages
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        stockSymbol={stockSymbol}
        stockName={stockName}
        mode={mode}
        conversationId={conversationId}
        onStockSymbolChange={setStockSymbol}
        onStockNameChange={setStockName}
        onModeChange={setMode}
        onClear={handleClear}
        onConversationSelect={handleConversationSelect}
        refreshKey={refreshKey}
      />

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="text-center text-gray-400 mt-20">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-xl mb-2">AI 智能助手</p>
              <p>选择分析模式，输入问题开始对话</p>
              <p className="text-sm mt-1">
                支持自由问答 · 标准分析 · 深度分析 · 专家团 · K线图分析
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              mode={msg.mode}
              agents={msg.agents}
              evidence={msg.evidence}
              compliance_note={msg.compliance_note}
              timestamp={msg.timestamp}
            />
          ))}

          {/* Streaming content */}
          {loading && streamingContent && (
            <MessageBubble role="assistant" content={streamingContent} timestamp="" />
          )}

          {/* Loading indicator */}
          {loading && !streamingContent && (
            <div className="flex justify-start">
              <div className="bg-white border rounded-2xl px-4 py-3">
                <div className="animate-pulse text-gray-400">分析中...</div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <ChatInput onSend={handleSend} loading={loading} onCancel={cancel} />
      </div>

      <AnalysisPanel
        mode={mode}
        stockSymbol={stockSymbol}
        stockName={stockName}
        messageCount={messages.length}
        conversationId={conversationId}
        agents={lastAssistant?.agents}
        evidence={lastAssistant?.evidence}
        complianceNote={lastAssistant?.compliance_note}
      />
    </div>
  );
}
