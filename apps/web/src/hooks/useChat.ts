"use client";

import { useState, useCallback, useRef } from "react";
import {
  streamChat,
  createConversation,
  getConversation,
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

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef("");
  const loadingRef = useRef(false);

  const loadConversation = useCallback(async (convId: string) => {
    try {
      const resp = await getConversation(convId);
      if (resp && resp.messages) {
        const loaded: Message[] = resp.messages.map(
          (m: { role: string; content: string }, i: number) => ({
            id: `loaded-${i}`,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: "",
          })
        );
        setMessages(loaded);
        setConversationId(convId);
      }
    } catch {
      // Failed to load conversation
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string, mode: string, stockSymbol: string, stockName: string) => {
      if (!content.trim() || loadingRef.current) return;

      const userMsg: Message = {
        id: `user-${crypto.randomUUID()}`,
        role: "user",
        content,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      loadingRef.current = true;
      setStreamingContent("");
      streamingRef.current = "";

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

      abortRef.current = streamChat(
        {
          conversation_id: convId || undefined,
          message: content,
          mode,
          stock_symbol: stockSymbol || undefined,
          stock_name: stockName || undefined,
        },
        (event: SseEvent) => {
          if (event.type === "content" && event.chunk) {
            streamingRef.current += event.chunk;
            setStreamingContent(streamingRef.current);
          }
        },
        (fullContent: string) => {
          const assistantMsg: Message = {
            id: `assistant-${crypto.randomUUID()}`,
            role: "assistant",
            content: fullContent || streamingRef.current || "未获取到回复",
            timestamp: new Date().toLocaleTimeString(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setStreamingContent("");
          streamingRef.current = "";
          setLoading(false);
          loadingRef.current = false;
        },
        (error: string) => {
          const errorMsg: Message = {
            id: `error-${crypto.randomUUID()}`,
            role: "assistant",
            content: `请求失败: ${error}`,
            timestamp: new Date().toLocaleTimeString(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          setStreamingContent("");
          streamingRef.current = "";
          setLoading(false);
          loadingRef.current = false;
        }
      );
    },
    [conversationId]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    loadingRef.current = false;
    setStreamingContent("");
    streamingRef.current = "";
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setStreamingContent("");
    streamingRef.current = "";
  }, []);

  return {
    messages,
    loading,
    conversationId,
    streamingContent,
    sendMessage,
    cancel,
    clearMessages,
    loadConversation,
  };
}
