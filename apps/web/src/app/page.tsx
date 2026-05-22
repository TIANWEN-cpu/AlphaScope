"use client";

import { useRef, useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Brain,
  Database,
  FileText,
  LineChart,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { MessageBubble } from "@/components/MessageBubble";
import { ChatInput } from "@/components/ChatInput";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { useChat } from "@/hooks/useChat";
import type { Conversation } from "@/lib/api";

const QUICK_PROMPTS = [
  {
    label: "贵州茅台标准分析",
    prompt: "用标准模式分析 600519 贵州茅台，给出风险提示",
    stockSymbol: "600519",
    stockName: "贵州茅台",
  },
  {
    label: "宁德时代多维对比",
    prompt: "对比宁德时代最近消息面、资金面和技术面",
    stockSymbol: "300750",
    stockName: "宁德时代",
  },
  {
    label: "报告大纲生成",
    prompt: "生成一份适合导出的投研报告大纲",
  },
  {
    label: "专家团机制说明",
    prompt: "解释专家团、审稿员和主席总结分别做什么",
  },
];

const CAPABILITIES = [
  { label: "10 位专家", value: "圆桌协作", icon: Brain },
  { label: "证据链", value: "来源可追溯", icon: FileText },
  { label: "K线视觉", value: "图片上传分析", icon: Upload },
  { label: "本地存储", value: "SQLite + 报告", icon: Database },
];

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

  const [mode, setMode] = useState("standard");
  const [stockSymbol, setStockSymbol] = useState("600519");
  const [stockName, setStockName] = useState("贵州茅台");
  const [refreshKey, setRefreshKey] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = (content: string) => {
    sendMessage(content, mode, stockSymbol, stockName);
  };

  const handleQuickPrompt = (item: (typeof QUICK_PROMPTS)[number]) => {
    if (item.stockSymbol) {
      setStockSymbol(item.stockSymbol);
    }
    if (item.stockName) {
      setStockName(item.stockName);
    }
    sendMessage(item.prompt, mode, item.stockSymbol ?? stockSymbol, item.stockName ?? stockName);
  };

  const handleClear = () => {
    clearMessages();
    setRefreshKey((k) => k + 1);
  };

  const handleConversationSelect = (conv: Conversation) => {
    loadConversation(conv.id);
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.24),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.16),_transparent_28%),linear-gradient(135deg,_#020617_0%,_#0f172a_52%,_#111827_100%)]" />
      <div className="relative flex h-screen p-4 gap-4">
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

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white/95 text-slate-950 shadow-2xl shadow-black/30 backdrop-blur">
          <header className="border-b border-slate-200 bg-white/90 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                  <Sparkles className="h-4 w-4" />
                  AI-FINANCE Local v1.0.1
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                  多 Agent 金融分析工作台
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  异构模型协作 · 证据链校验 · 风险提示 · 本地报告归档
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
                  <Activity className="mx-auto mb-1 h-4 w-4" />
                  API 在线
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700">
                  <ShieldCheck className="mx-auto mb-1 h-4 w-4" />
                  风险合规
                </div>
                <div className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2 text-violet-700">
                  <LineChart className="mx-auto mb-1 h-4 w-4" />
                  A股研究
                </div>
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col bg-slate-100/70">
            <div className="flex-1 overflow-y-auto p-6">
              {messages.length === 0 && !loading && (
                <div className="mx-auto max-w-5xl space-y-6">
                  <div className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl">
                    <div className="grid gap-8 p-8 lg:grid-cols-[1.25fr_0.75fr]">
                      <div>
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-blue-100">
                          <Brain className="h-4 w-4" />
                          面向本地投资研究的 AI 工作台
                        </div>
                        <h2 className="text-4xl font-bold leading-tight">
                          从行情、消息、专家观点到可导出的研究结论
                        </h2>
                        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                          输入股票代码或研究问题，选择标准、深度、专家团或 K 线模式。系统会组织多 Agent 分析，并在回答中展示证据、分歧和风险提示。
                        </p>
                        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                          {CAPABILITIES.map((item) => {
                            const Icon = item.icon;
                            return (
                              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 p-3">
                                <Icon className="mb-2 h-5 w-5 text-blue-300" />
                                <div className="text-sm font-semibold">{item.label}</div>
                                <div className="text-xs text-slate-300">{item.value}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-blue-100">
                          <BarChart3 className="h-4 w-4" />
                          当前研究对象
                        </div>
                        <div className="rounded-2xl bg-white p-5 text-slate-950">
                          <div className="text-sm text-slate-500">股票代码</div>
                          <div className="mt-1 text-3xl font-bold">{stockSymbol || "未设置"}</div>
                          <div className="mt-2 text-slate-600">{stockName || "请在左侧填写股票名称"}</div>
                          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-xl bg-blue-50 p-3 text-blue-700">模式：{mode}</div>
                            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">报告：本地归档</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {QUICK_PROMPTS.map((item) => (
                      <button
                        key={item.prompt}
                        onClick={() => handleQuickPrompt(item)}
                        className="rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                      >
                        <div className="mb-2 flex items-center gap-2 font-semibold text-slate-950">
                          <Sparkles className="h-4 w-4 text-blue-600" />
                          {item.label}
                        </div>
                        {item.prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.length > 0 && (
                <div className="mx-auto max-w-4xl space-y-4">
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

                  {loading && streamingContent && (
                    <MessageBubble role="assistant" content={streamingContent} timestamp="" />
                  )}

                  {loading && !streamingContent && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm">
                        <div className="animate-pulse text-sm text-blue-600">多 Agent 正在分析...</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <ChatInput onSend={handleSend} loading={loading} onCancel={cancel} />
          </div>
        </section>

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
    </main>
  );
}
