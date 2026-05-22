"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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

  // Context injection when stock changes
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
    <div className="flex flex-col h-full bg-[#0d0d0f] relative font-sans">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800/80 px-4 flex items-center justify-between bg-[#18181b] z-20 flex-shrink-0 relative">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-blue-600/20 text-blue-500 border border-blue-500/30">
            <BrainCircuit size={14} />
          </div>
          <span className="font-semibold text-zinc-100 text-sm tracking-wide">
            AI 分析引擎
          </span>
        </div>

        <div className="flex gap-2">
          {/* Mode Switcher */}
          <div
            className="relative"
            onMouseLeave={() => setShowModeDropdown(false)}
          >
            <div
              onClick={() => setShowModeDropdown(!showModeDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#09090b] border border-zinc-800 cursor-pointer hover:bg-zinc-800/80 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              <span className="text-xs text-zinc-300">
                {currentMode?.name || mode}
              </span>
              <ChevronDown size={14} className="text-zinc-500" />
            </div>
            {showModeDropdown && (
              <div className="absolute top-full right-0 mt-1 w-40 bg-[#18181b] border border-zinc-700 shadow-xl rounded-md py-1 z-50 animate-fade-in">
                {MODES.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      setMode(m.id);
                      setShowModeDropdown(false);
                    }}
                    className={`px-3 py-2 text-xs cursor-pointer transition-colors flex items-center gap-2 ${
                      mode === m.id
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    }`}
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
            className="p-1.5 rounded-md text-zinc-400 hover:bg-[#09090b] hover:text-zinc-200 transition-colors border border-transparent hover:border-zinc-800 focus:outline-none"
          >
            <RefreshCw size={14} />
          </button>
          <div className="w-px h-4 bg-zinc-800 mx-1" />
          <button
            onClick={onClose}
            title="收起面板"
            className="p-1.5 rounded-md text-zinc-400 hover:bg-[#09090b] hover:text-red-400 transition-colors border border-transparent hover:border-zinc-800 focus:outline-none"
          >
            <PanelRightClose size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm font-mono flex-col gap-2">
            <Bot size={32} className="opacity-20" />
            流已清空，请发起提问
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col animate-fade-in ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            {msg.role === "system" && (
              <div className="w-full text-center py-1">
                <span className="text-[10px] text-zinc-500 font-mono tracking-wider bg-zinc-800/30 px-3 py-1 rounded-full border border-zinc-800/50">
                  {msg.content}
                </span>
              </div>
            )}

            {msg.role === "user" && (
              <div className="max-w-[85%] bg-blue-600/15 border border-blue-500/30 text-blue-100 px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
                {msg.content}
              </div>
            )}

            {msg.role === "agent" && (
              <div className="w-full">
                {msg.process && (
                  <div className="mb-2 font-mono bg-[#09090b]/50 p-3 rounded-lg border border-zinc-800/50">
                    <div className="flex items-center gap-2 text-xs mb-2">
                      {msg.process.status === "analyzing" ? (
                        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                      )}
                      <span className="text-blue-400 font-medium tracking-wide">
                        {msg.process.status === "analyzing"
                          ? "ANALYZING..."
                          : "COMPLETED"}
                      </span>
                    </div>

                    {msg.process.logs.length > 0 && (
                      <div className="border-l-2 border-zinc-800 ml-1.5 pl-3 space-y-2 py-1">
                        {msg.process.logs.map((log, i) => (
                          <div key={i} className="text-xs animate-fade-in">
                            <div className="absolute -left-[17px] top-[5px] w-1.5 h-1.5 rounded-full bg-zinc-600" />
                            <span className="text-zinc-600 mr-2">
                              [{log.time}]
                            </span>
                            <span className="text-emerald-500 font-medium mr-2">
                              {log.name}:
                            </span>
                            <span className="text-zinc-400">{log.task}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(msg.content || (msg.id === messages[messages.length - 1]?.id && streamingContent)) && (
                  <div className="max-w-[95%] bg-[#18181b] border border-zinc-800 shadow-xl rounded-xl rounded-tl-sm overflow-hidden animate-fade-in">
                    <div className="p-4 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                      {msg.content || streamingContent}
                      {isProcessing &&
                        msg.id === messages[messages.length - 1]?.id &&
                        !msg.content && (
                          <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-0.5" />
                        )}
                    </div>

                    {msg.process?.evidence && (
                      <div className="px-4 py-3 bg-zinc-900/50 border-t border-zinc-800/80 flex flex-wrap gap-2">
                        {msg.process.evidence.map((evi, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 text-[10px] text-zinc-400 bg-[#09090b] border border-zinc-800 px-2 py-1 rounded cursor-pointer hover:text-blue-400 hover:border-blue-500/30 transition-colors"
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
      <div className="p-4 bg-gradient-to-t from-[#0d0d0f] to-transparent z-10 flex-shrink-0">
        <div className="relative bg-[#18181b] border border-zinc-700/80 hover:border-zinc-600 focus-within:border-blue-500/50 rounded-xl overflow-hidden transition-colors shadow-2xl">
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
            className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 resize-none h-16 px-4 py-3 focus:outline-none disabled:opacity-50 font-sans"
            spellCheck="false"
          />
          <div className="flex justify-between items-center px-3 pb-2 pt-1 bg-[#18181b]">
            <div className="flex gap-1.5">
              <button
                className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                title="快速提示词"
              >
                <Layers size={14} />
              </button>
            </div>
            <button
              onClick={isProcessing ? handleCancel : handleSend}
              disabled={!isProcessing && !inputValue.trim()}
              className={`${
                isProcessing
                  ? "bg-red-600 hover:bg-red-500"
                  : "bg-blue-600 hover:bg-blue-500"
              } disabled:bg-zinc-800 disabled:text-zinc-600 text-white shadow-lg rounded-lg px-4 py-1.5 text-sm font-medium flex items-center gap-2 transition-all focus:outline-none`}
            >
              {isProcessing ? "停止" : "发送"} <Send size={14} />
            </button>
          </div>
        </div>
        <div className="text-center mt-2 text-[10px] text-zinc-600 font-mono">
          ENTER 发送 · SHIFT+ENTER 换行
        </div>
      </div>
    </div>
  );
}
