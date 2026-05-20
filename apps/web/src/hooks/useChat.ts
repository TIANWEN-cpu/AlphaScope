"use client";

import { useState, useCallback, useRef } from "react";
import {
  streamChat,
  createConversation,
  type ChatResult,
  type SseEvent,
} from "@/lib/api";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: string;
  evidence?: Array<{ type: string; claim: string }>;
  agents?: Record<string, { signal: string; confidence: number; reason: string }>;
  compliance_note?: string;
  detected_intent?: string;
  timestamp: string;
}

export interface ChatState {
  messages: Message[];
  loading: boolean;
  conversationId: string | null;
  streamingContent: string;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (
      content: string,
      mode: string,
      stockSymbol: string,
      stockName: string
    ) => {
      if (!content.trim() || loading) return;

      // Add user message
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setStreamingContent("");

      // Ensure conversation exists
      let convId = conversationId;
      if (!convId) {
        try {
          const conv = await createConversation({
            title: content.slice(0, 30),
            stock_symbol: stockSymbol || undefined,
            stock_name: stockName || undefined,
            mode,
          });
          convId = conv.id;
          setConversationId(convId);
        } catch {
          // Continue without conversation persistence
        }
      }

      // Stream response
      abortRef.current = streamChat(
        {
          conversation_id: convId || undefined,
          message: content,
          mode,
          stock_symbol: stockSymbol || undefined,
          stock_name: stockName || undefined,
        },
        // onEvent
        (event: SseEvent) => {
          if (event.type === "content" && event.chunk) {
            setStreamingContent((prev) => prev + event.chunk);
          }
        },
        // onDone
        (fullContent: string) => {
          const assistantMsg: Message = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: fullContent || streamingContent || "未获取到回复",
            timestamp: new Date().toLocaleTimeString(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setStreamingContent("");
          setLoading(false);
        },
        // onError
        (error: string) => {
          const errorMsg: Message = {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `请求失败: ${error}`,
            timestamp: new Date().toLocaleTimeString(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          setStreamingContent("");
          setLoading(false);
        }
      );
    },
    [loading, conversationId, streamingContent]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setStreamingContent("");
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setStreamingContent("");
  }, []);

  return {
    messages,
    loading,
    conversationId,
    streamingContent,
    sendMessage,
    cancel,
    clearMessages,
  };
}
