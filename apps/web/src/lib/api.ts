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

// K-line / Price
export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// News
export interface NewsItem {
  id?: string;
  title: string;
  summary?: string;
  datetime?: string;
  published_at?: string;
  url?: string;
  source?: string;
  event_type?: string;
  sentiment?: number;
  importance?: number;
}

// Fundamentals
export interface FinancialPeriod {
  period: string;
  revenue_yi: number;
  net_profit_yi: number;
  gross_margin_pct: number;
  roe_pct: number;
  debt_ratio_pct: number;
  yoy_revenue_pct: number;
  yoy_net_profit_pct: number;
}

export interface FundamentalsData {
  symbol: string;
  financial_periods: FinancialPeriod[];
  valuation: Record<string, number>;
  earnings_quality: Record<string, unknown>;
  cashflow: Record<string, unknown>;
  balance_sheet: Record<string, unknown>;
  fundamental_score: number;
}

// Fund Flow
export interface FundFlowRecord {
  date: string;
  close: number;
  change_pct: number;
  main_net_yi: number;
  main_net_pct: number;
  super_net_yi: number;
  large_net_yi: number;
  medium_net_yi: number;
  small_net_yi: number;
}

export interface FundFlowData {
  symbol: string;
  summary: Record<string, number>;
  records: FundFlowRecord[];
}

// Factors
export interface FactorReport {
  symbol: string;
  stock_name: string;
  computed_at: string;
  factors: {
    news_sentiment: number;
    event_signal: number;
    analyst_rating: number;
    fund_flow: number;
    momentum: number;
    composite: number;
  };
  sample_counts: { news: number; events: number; reports: number };
  signals: Array<Record<string, unknown>>;
}

// Archive
export interface ArchiveReport {
  timestamp: string;
  date: string;
  type: string;
  stock_name: string;
  symbol: string;
  decision: string;
  avg_confidence: number;
  path: string;
}

// Provider Health
export interface ProviderInfo {
  name: string;
  status: string;
  consecutive_failures: number;
  avg_latency_ms: number;
  last_error: string | null;
  data_types: string[];
  markets: string[];
}

export interface ProvidersHealthData {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  providers: ProviderInfo[];
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

// ============== Health ==============

export async function getHealth(): Promise<{ status: string; version: string }> {
  return apiFetch("/health");
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
  const res = await fetch(`${API_BASE}/api/conversations/${conversation_id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.detail || `HTTP ${res.status}`);
  }
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
        const body = await res.json();
        const content = body.content || body.data?.content || "";
        onDone(content);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      onError(err instanceof Error ? err.message : String(err));
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

// ============== Prices / K-line ==============

export async function getPrices(
  symbol: string,
  frequency = "1d",
  limit = 250
): Promise<{ symbol: string; bars: PriceBar[]; total: number }> {
  return apiFetch(`/api/prices/${symbol}?frequency=${frequency}&limit=${limit}`);
}

export async function getLatestPrice(
  symbol: string
): Promise<PriceBar | null> {
  try {
    return await apiFetch(`/api/prices/${symbol}/latest`);
  } catch {
    return null;
  }
}

export async function fetchPrices(
  symbol: string,
  days = 30
): Promise<{ symbol: string; fetched: number }> {
  return apiFetch(`/api/prices/${symbol}/fetch?days=${days}`, {
    method: "POST",
  });
}

// ============== News ==============

export async function listNews(params?: {
  symbol?: string;
  event_type?: string;
  limit?: number;
}): Promise<{ news: NewsItem[]; total: number }> {
  const sp = new URLSearchParams();
  if (params?.symbol) sp.set("symbol", params.symbol);
  if (params?.event_type) sp.set("event_type", params.event_type);
  if (params?.limit) sp.set("limit", String(params.limit));
  return apiFetch(`/api/news?${sp}`);
}

export async function listAnnouncements(params?: {
  symbol?: string;
  category?: string;
  limit?: number;
}): Promise<{ announcements: NewsItem[]; total: number }> {
  const sp = new URLSearchParams();
  if (params?.symbol) sp.set("symbol", params.symbol);
  if (params?.category) sp.set("category", params.category);
  if (params?.limit) sp.set("limit", String(params.limit));
  return apiFetch(`/api/news/announcements?${sp}`);
}

export async function searchNews(
  query: string,
  limit = 20
): Promise<{ results: NewsItem[]; total: number }> {
  return apiFetch("/api/news/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit }),
  });
}

// ============== Fundamentals ==============

export async function getFundamentals(
  symbol: string
): Promise<FundamentalsData> {
  return apiFetch(`/api/fundamentals/${symbol}`);
}

export async function getPeers(
  symbol: string
): Promise<{ industry: string; peers: Record<string, unknown>[] }> {
  return apiFetch(`/api/fundamentals/${symbol}/peers`);
}

export async function getShareholders(
  symbol: string
): Promise<{
  top_holders: Record<string, unknown>[];
  circulate_holders: Record<string, unknown>[];
  institutional_changes: Record<string, unknown>[];
}> {
  return apiFetch(`/api/fundamentals/${symbol}/shareholders`);
}

// ============== Fund Flow ==============

export async function getFundFlow(
  symbol: string,
  days = 30
): Promise<FundFlowData> {
  return apiFetch(`/api/fund-flow/${symbol}?days=${days}`);
}

export async function getMarketFundFlow(
  days = 30
): Promise<{ summary: Record<string, number>; records: Record<string, unknown>[] }> {
  return apiFetch(`/api/fund-flow/market/overview?days=${days}`);
}

// ============== Factors ==============

export async function getFactors(
  symbol: string,
  stockName = "",
  days = 30
): Promise<FactorReport> {
  const params = new URLSearchParams();
  if (stockName) params.set("stock_name", stockName);
  params.set("days", String(days));
  return apiFetch(`/api/factors/${symbol}?${params}`);
}

// ============== Technical ==============

export async function getTechnicalIndicators(
  symbol: string,
  limit = 250
): Promise<Record<string, unknown>> {
  return apiFetch(`/api/technical/${symbol}?limit=${limit}`);
}

// ============== Archive ==============

export async function listArchiveReports(params?: {
  stock_filter?: string;
  decision_filter?: string;
  type_filter?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<{ reports: ArchiveReport[]; total: number }> {
  const sp = new URLSearchParams();
  if (params?.stock_filter) sp.set("stock", params.stock_filter);
  if (params?.decision_filter) sp.set("decision", params.decision_filter);
  if (params?.type_filter) sp.set("type", params.type_filter);
  if (params?.date_from) sp.set("date_from", params.date_from);
  if (params?.date_to) sp.set("date_to", params.date_to);
  if (params?.limit) sp.set("limit", String(params.limit));
  return apiFetch(`/api/archive?${sp}`);
}

export async function getArchiveStats(): Promise<Record<string, unknown>> {
  return apiFetch("/api/archive/stats");
}

export async function getArchiveComboStats(): Promise<{
  combos: Record<string, unknown>[];
}> {
  return apiFetch("/api/archive/combo-stats");
}

export async function loadArchiveReport(
  path: string
): Promise<{ content: string }> {
  return apiFetch(`/api/archive/report/${path}`);
}

export async function deleteArchiveReport(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/archive/report/${path}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.detail || `HTTP ${res.status}`);
  }
}

// ============== Config ==============

export async function listAgents(): Promise<{ agents: Record<string, unknown>[] }> {
  return apiFetch("/api/agents");
}

export async function listAgentModels(): Promise<{ agents: Record<string, unknown>[] }> {
  return apiFetch("/api/agents/models");
}

export async function listTeams(): Promise<{ teams: string[] }> {
  return apiFetch("/api/teams");
}

export async function getTeam(
  teamId: string
): Promise<Record<string, unknown>> {
  return apiFetch(`/api/teams/${teamId}`);
}

export async function listProviders(): Promise<{
  providers: Record<string, unknown>[];
}> {
  return apiFetch("/api/models/providers");
}

export async function listModes(): Promise<{ modes: Record<string, unknown>[] }> {
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

export async function getProvidersHealth(): Promise<ProvidersHealthData> {
  return apiFetch("/api/providers/health");
}

export async function uploadFile(
  file: File
): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch("/api/files/upload", {
    method: "POST",
    body: formData,
  });
}

// ============== Templates ==============

export async function listTemplates(): Promise<{
  templates: Record<string, unknown>[];
}> {
  return apiFetch("/api/templates");
}
