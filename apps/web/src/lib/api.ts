/**
 * AI-Finance API Client (v1.0.1)
 *
 * Connects to the FastAPI backend for chat, analysis, vision, and config.
 * Handles SSE streaming for chat responses.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ============== Types ==============

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AgentResult {
  key: string;
  name: string;
  signal: string;
  confidence: number;
  reason: string;
  evidence?: Evidence[];
  vendor?: string;
  model?: string;
}

export interface Evidence {
  type: string;
  claim: string;
  data_date?: string;
  source?: string;
}

export interface VotingSummary {
  final: string;
  buy: number;
  sell: number;
  hold: number;
  avg_confidence: number;
}

export interface Conversation {
  id: string;
  title: string;
  stock_symbol?: string;
  stock_name?: string;
  mode: string;
  message_count: number;
  updated_at: string;
}

export interface SseEvent {
  type: "status" | "content" | "evidence" | "agents" | "done";
  mode?: string;
  chunk?: string;
  data?: unknown;
}

export interface ChatResult {
  conversation_id: string;
  mode: string;
  content: string;
  agents?: Record<string, AgentResult>;
  evidence?: Evidence[];
  summary?: VotingSummary;
  compliance_note?: string;
  detected_intent?: string;
  auto_routed?: boolean;
}

// ============== Helper ==============

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.detail || `HTTP ${res.status}`);
  }
  const body = await res.json();
  if (body.success === false) {
    throw new Error(body.error || "请求失败");
  }
  return body.data ?? body;
}

// ============== Conversations ==============

export async function createConversation(data: {
  title?: string;
  stock_symbol?: string;
  stock_name?: string;
  mode?: string;
}): Promise<{ id: string }> {
  return apiFetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function listConversations(
  stock_symbol?: string,
  limit = 20
): Promise<{ conversations: Conversation[] }> {
  const params = new URLSearchParams();
  if (stock_symbol) params.set("stock_symbol", stock_symbol);
  params.set("limit", String(limit));
  return apiFetch(`/api/conversations?${params}`);
}

export async function getConversation(
  conversation_id: string
): Promise<{ conversation: Conversation; messages: ChatMessage[] }> {
  return apiFetch(`/api/conversations/${conversation_id}`);
}

export async function deleteConversation(
  conversation_id: string
): Promise<void> {
  await fetch(`${API_BASE}/api/conversations/${conversation_id}`, {
    method: "DELETE",
  });
}

// ============== Chat (SSE Streaming) ==============

export function streamChat(
  data: {
    conversation_id?: string;
    message: string;
    mode?: string;
    stock_symbol?: string;
    stock_name?: string;
    expert_team_id?: string;
  },
  onEvent: (event: SseEvent) => void,
  onDone: (fullContent: string) => void,
  onError: (error: string) => void
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        onError(body.error || body.detail || `HTTP ${res.status}`);
        return;
      }

      const contentType = res.headers.get("content-type") || "";

      // SSE stream
      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event: SseEvent = JSON.parse(line.slice(6));
              onEvent(event);
              if (event.type === "content" && event.chunk) {
                fullContent += event.chunk;
              }
            } catch {
              // skip malformed events
            }
          }
        }
        onDone(fullContent);
      } else {
        // Fallback: plain JSON response
        const body = await res.json();
        const content = body.content || body.data?.content || "";
        onDone(content);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      onError(String(err));
    }
  })();

  return controller;
}

// ============== Analysis ==============

export async function runAnalysis(data: {
  stock_symbol: string;
  stock_name?: string;
  mode?: string;
}): Promise<Record<string, unknown>> {
  return apiFetch("/api/analysis/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ============== Vision ==============

export async function analyzeVision(data: {
  image_base64: string;
  mime_type?: string;
  user_context?: string;
  ticker?: string;
}): Promise<Record<string, unknown>> {
  return apiFetch("/api/vision/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ============== Config ==============

export async function listAgents(): Promise<Record<string, unknown>[]> {
  return apiFetch("/api/agents");
}

export async function listTeams(): Promise<Record<string, unknown>[]> {
  return apiFetch("/api/teams");
}

export async function listProviders(): Promise<Record<string, unknown>[]> {
  return apiFetch("/api/models/providers");
}

export async function listModes(): Promise<Record<string, unknown>[]> {
  return apiFetch("/api/modes");
}

export async function getCosts(
  mode?: string
): Promise<Record<string, unknown>> {
  const params = mode ? `?mode=${mode}` : "";
  return apiFetch(`/api/costs${params}`);
}

export async function getBacktestStats(
  mode?: string
): Promise<Record<string, unknown>> {
  const params = mode ? `?mode=${mode}` : "";
  return apiFetch(`/api/backtest/stats${params}`);
}

export async function getProvidersHealth(): Promise<Record<string, unknown>> {
  return apiFetch("/api/providers/health");
}

export async function uploadFile(
  file: File
): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", file.name);
  return apiFetch("/api/files/upload", {
    method: "POST",
    body: formData,
  });
}
