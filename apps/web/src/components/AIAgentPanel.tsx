"use client";

import { useState, useRef, useEffect } from "react";
import {
  BrainCircuit,
  Send,
  RefreshCw,
  PanelRightClose,
  ChevronDown,
  FileText,
  Bot,
  Layers,
  Zap,
  Microscope,
  GraduationCap,
  BarChart3,
  Search,
} from "lucide-react";
import { streamChat, type SseEvent } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AIAgentPanelProps {
  symbol: string;
  stockName: string;
  onClose: () => void;
}

const MODES = [
  { id: "free", name: "自由问答", icon: <Search size={14} /> },
  { id: "standard", name: "标准分析", icon: <Zap size={14} /> },
  { id: "deep", name: "深度研报", icon: <Microscope size={14} /> },
  { id: "expert", name: "十人专家团", icon: <GraduationCap size={14} /> },
  { id: "vision", name: "K线分析", icon: <BarChart3 size={14} /> },
];

interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  content?: string;
  process?: {
    status: "analyzing" | "done";
    logs: { time: string; name: string; task: string }[];
    evidence?: string[];
    agents?: Record<string, { signal: string; confidence: number; reason: string }>;
  };
}

export function AIAgentPanel({ symbol, stockName, onClose }: AIAgentPanelProps) {
  const [mode, setMode] = useState("standard");
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "intro",
      role: "agent",
      content: `欢迎使用 AI-Finance 多 Agent 分析工作台。当前标的: **${stockName}** (${symbol})。请选择分析模式并输入问题。`,
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing, streamingContent]);

  useEffect(() => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "system",
        content: `[系统] 已切换至 ${stockName} (${symbol})`,
      },
    ]);
    setConversationId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const clearChat = () => {
    setMessages([]);
    setConversationId(null);
    setStreamingContent("");
  };

  const handleSend = () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMsg = inputValue;
    setInputValue("");
    setIsProcessing(true);
    setStreamingContent("");

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: userMsg },
    ]);

    const processId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: processId,
        role: "agent",
        process: { status: "analyzing", logs: [] },
      },
    ]);

    const controller = streamChat(
      {
        conversation_id: conversationId || undefined,
        message: userMsg,
        mode,
        stock_symbol: symbol,
        stock_name: stockName,
      },
      (event: SseEvent) => {
        if (event.type === "content" && event.chunk) {
          setStreamingContent((prev) => prev + event.chunk);
        }
        if (event.type === "status" && event.mode) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === processId && msg.process) {
                return {
                  ...msg,
                  process: {
                    ...msg.process,
                    logs: [
                      ...msg.process.logs,
                      {
                        time: "00:00",
                        name: "System",
                        task: `模式: ${event.mode} | 分析启动`,
                      },
                    ],
                  },
                };
              }
              return msg;
            })
          );
        }
      },
      (fullContent: string) => {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === processId && msg.process) {
              return {
                ...msg,
                content: fullContent || streamingContent,
                process: { ...msg.process, status: "done" },
              };
            }
            return msg;
          })
        );
        setStreamingContent("");
        setIsProcessing(false);
      },
      (error: string) => {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === processId && msg.process) {
              return {
                ...msg,
                content: `请求失败: ${error}`,
                process: { ...msg.process, status: "done" },
              };
            }
            return msg;
          })
        );
        setStreamingContent("");
        setIsProcessing(false);
      }
    );

    abortRef.current = controller;
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setIsProcessing(false);
    setStreamingContent("");
  };

  const currentMode = MODES.find((m) => m.id === mode);

  return (
    <div className="flex flex-col h-full relative font-sans">
      {/* Header */}
      <div className="h-14 border-b border-white/5 px-4 flex items-center justify-between bg-black/40 z-20 flex-shrink-0 relative backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <BrainCircuit size={14} />
          </div>
          <span className="font-semibold text-white text-sm tracking-wide font-display">
            AI 分析引擎
          </span>
        </div>

        <div className="flex gap-2">
          <div
            className="relative"
            onMouseLeave={() => setShowModeDropdown(false)}
          >
            <div
              onClick={() => setShowModeDropdown(!showModeDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/20 border border-white/5 cursor-pointer hover:bg-white/[0.03] transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
              <span className="text-xs text-neutral-300">
                {currentMode?.name || mode}
              </span>
              <ChevronDown size={14} className="text-neutral-500" />
            </div>
            {showModeDropdown && (
              <div className="absolute top-full right-0 mt-1 w-40 bg-[#0a0a0f] border border-white/10 shadow-xl rounded-lg py-1 z-50 animate-fade-in backdrop-blur-md">
                {MODES.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      setMode(m.id);
                      setShowModeDropdown(false);
                    }}
                    className={cn(
                      "px-3 py-2 text-xs cursor-pointer transition-colors flex items-center gap-2",
                      mode === m.id
                        ? "text-indigo-400 bg-indigo-500/10"
                        : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.02]"
                    )}
                  >
                    {m.icon}
                    {m.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={clearChat}
            title="清空对话"
            className="p-1.5 rounded-lg text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200 transition-colors border border-transparent hover:border-white/5 focus:outline-none"
          >
            <RefreshCw size={14} />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button
            onClick={onClose}
            title="收起面板"
            className="p-1.5 rounded-lg text-neutral-400 hover:bg-white/[0.03] hover:text-rose-400 transition-colors border border-transparent hover:border-white/5 focus:outline-none"
          >
            <PanelRightClose size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-neutral-600 text-sm font-mono flex-col gap-2">
            <Bot size={32} className="opacity-20" />
            流已清空，请发起提问
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex flex-col animate-fade-in",
              msg.role === "user" ? "items-end" : "items-start"
            )}
          >
            {msg.role === "system" && (
              <div className="w-full text-center py-1">
                <span className="text-[10px] text-neutral-500 font-mono tracking-wider bg-white/[0.02] px-3 py-1 rounded-full border border-white/5">
                  {msg.content}
                </span>
              </div>
            )}

            {msg.role === "user" && (
              <div className="max-w-[85%] bg-indigo-600/15 border border-indigo-500/30 text-indigo-100 px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
                {msg.content}
              </div>
            )}

            {msg.role === "agent" && (
              <div className="w-full">
                {msg.process && (
                  <div className="mb-2 font-mono bg-black/20 p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 text-xs mb-2">
                      {msg.process.status === "analyzing" ? (
                        <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-indigo-500" />
                      )}
                      <span className="text-indigo-400 font-medium tracking-wide">
                        {msg.process.status === "analyzing"
                          ? "ANALYZING..."
                          : "COMPLETED"}
                      </span>
                    </div>

                    {msg.process.logs.length > 0 && (
                      <div className="border-l-2 border-white/5 ml-1.5 pl-3 space-y-2 py-1">
                        {msg.process.logs.map((log, i) => (
                          <div key={i} className="text-xs animate-fade-in">
                            <span className="text-neutral-600 mr-2">[{log.time}]</span>
                            <span className="text-emerald-400 font-medium mr-2">{log.name}:</span>
                            <span className="text-neutral-400">{log.task}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(msg.content || (msg.id === messages[messages.length - 1]?.id && streamingContent)) && (
                  <div className="max-w-[95%] bg-white/[0.02] border border-white/5 shadow-xl rounded-xl rounded-tl-sm overflow-hidden animate-fade-in backdrop-blur-md">
                    <div className="p-4 text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                      {msg.content || streamingContent}
                      {isProcessing &&
                        msg.id === messages[messages.length - 1]?.id &&
                        !msg.content && (
                          <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-0.5" />
                        )}
                    </div>

                    {msg.process?.evidence && (
                      <div className="px-4 py-3 bg-black/20 border-t border-white/5 flex flex-wrap gap-2">
                        {msg.process.evidence.map((evi, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 text-[10px] text-neutral-400 bg-black/20 border border-white/5 px-2 py-1 rounded-lg cursor-pointer hover:text-indigo-400 hover:border-indigo-500/30 transition-colors"
                          >
                            <FileText size={10} />
                            {evi}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} className="h-2" />
      </div>

      {/* Input */}
      <div className="p-4 bg-gradient-to-t from-[#050505] to-transparent z-10 flex-shrink-0">
        <div className="relative bg-white/[0.02] border border-white/5 hover:border-white/10 focus-within:border-indigo-500/50 rounded-xl overflow-hidden transition-colors shadow-2xl backdrop-blur-md">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (isProcessing) {
                  handleCancel();
                } else {
                  handleSend();
                }
              }
            }}
            disabled={isProcessing}
            placeholder={
              isProcessing
                ? "分析中，按 Enter 停止..."
                : `对 ${stockName} 提出分析需求...`
            }
            className="w-full bg-transparent text-sm text-neutral-200 placeholder:text-neutral-600 resize-none h-16 px-4 py-3 focus:outline-none disabled:opacity-50 font-sans"
            spellCheck="false"
          />
          <div className="flex justify-between items-center px-3 pb-2 pt-1">
            <div className="flex gap-1.5">
              <button
                className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03] rounded-lg transition-colors"
                title="快速提示词"
              >
                <Layers size={14} />
              </button>
            </div>
            <button
              onClick={isProcessing ? handleCancel : handleSend}
              disabled={!isProcessing && !inputValue.trim()}
              className={cn(
                "disabled:bg-white/5 disabled:text-neutral-600 text-white shadow-lg rounded-lg px-4 py-1.5 text-sm font-medium flex items-center gap-2 transition-all focus:outline-none",
                isProcessing
                  ? "bg-rose-600 hover:bg-rose-500"
                  : "bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
              )}
            >
              {isProcessing ? "停止" : "发送"} <Send size={14} />
            </button>
          </div>
        </div>
        <div className="text-center mt-2 text-[10px] text-neutral-600 font-mono">
          ENTER 发送 · SHIFT+ENTER 换行
        </div>
      </div>
    </div>
  );
}
