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
  error_code?: string;
  trace_id?: string;
  source?: string;
  tool_call_id?: string;
  evidence_ids?: string[];
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

// Settings Providers (CRUD)
export interface SettingsProvider {
  id: string;
  name: string;
  base_url: string;
  api_key_masked?: string;
  enabled: boolean;
}

// Agent Management (CRUD)
export interface ManageAgent {
  id: string;
  name: string;
  description?: string;
  system_prompt?: string;
  provider: string;
  model: string;
  tools?: string[];
  temperature?: number;
  max_tokens?: number;
  enabled: boolean;
}

export interface ManageTeam {
  id: string;
  name: string;
  description?: string;
  member_ids: string[];
}

// Tasks
export interface TaskItem {
  id: string;
  conversation_id?: string;
  task_type: string;
  status: string;
  error?: string;
  started_at?: number;
  completed_at?: number;
  created_at: number;
  input_json?: string;
  output_json?: string;
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

// ============== Settings Providers (CRUD) ==============

export async function listSettingsProviders(): Promise<{ providers: SettingsProvider[] }> {
  return apiFetch("/api/settings/providers");
}

export async function saveSettingsProvider(data: {
  id: string;
  name: string;
  base_url: string;
  api_key?: string;
  enabled?: boolean;
}): Promise<SettingsProvider> {
  return apiFetch("/api/settings/providers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteSettingsProvider(providerId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/settings/providers/${providerId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.detail || `HTTP ${res.status}`);
  }
}

export async function testSettingsProvider(
  providerId: string
): Promise<{ success: boolean; message?: string; models?: string[] }> {
  return apiFetch(`/api/settings/providers/${providerId}/test`, {
    method: "POST",
  });
}

export async function listSettingsModels(
  providerId: string
): Promise<{ models: Array<{ id: string; owned_by: string }> }> {
  return apiFetch(`/api/settings/providers/${providerId}/models`);
}

export async function exportSettings(): Promise<Record<string, unknown>> {
  return apiFetch("/api/settings/export");
}

export async function importSettings(data: {
  version?: string;
  providers: Record<string, unknown>[];
}): Promise<Record<string, unknown>> {
  return apiFetch("/api/settings/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ============== Agent & Team Management (CRUD) ==============

export async function listManageAgents(): Promise<{ agents: ManageAgent[] }> {
  return apiFetch("/api/manage/agents");
}

export async function saveManageAgent(data: {
  id: string;
  name: string;
  description?: string;
  system_prompt?: string;
  provider?: string;
  model?: string;
  tools?: string[];
  temperature?: number;
  max_tokens?: number;
  enabled?: boolean;
}): Promise<ManageAgent> {
  return apiFetch("/api/manage/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteManageAgent(agentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/manage/agents/${agentId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.detail || `HTTP ${res.status}`);
  }
}

export async function listManageTeams(): Promise<{ teams: ManageTeam[] }> {
  return apiFetch("/api/manage/teams");
}

export async function saveManageTeam(data: {
  id: string;
  name: string;
  description?: string;
  member_ids?: string[];
}): Promise<ManageTeam> {
  return apiFetch("/api/manage/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteManageTeam(teamId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/manage/teams/${teamId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.detail || `HTTP ${res.status}`);
  }
}

// ============== Task Management ==============

export async function listTasks(
  status?: string,
  limit = 50
): Promise<{ tasks: TaskItem[]; total: number }> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  params.set("limit", String(limit));
  return apiFetch(`/api/tasks?${params}`);
}

export async function getTask(taskId: string): Promise<TaskItem> {
  return apiFetch(`/api/tasks/${taskId}`);
}

export async function cancelTask(
  taskId: string
): Promise<{ cancelled: string }> {
  return apiFetch(`/api/tasks/${taskId}/cancel`, { method: "POST" });
}

export async function runAnalysisAsync(data: {
  stock_symbol: string;
  stock_name?: string;
  mode?: string;
  conversation_id?: string;
}): Promise<{ task_id: string; status: string }> {
  return apiFetch("/api/analysis/async", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ============== Quant / Jince ==============

export interface JinceStatus {
  connected: boolean;
  version?: string;
  strategy_count: number;
  active_runs: number;
  error?: string;
}

export interface StrategyInfo {
  id: string;
  name: string;
  description: string;
  status: string;
  params: { name: string; type: string; default?: unknown; description: string }[];
}

export interface BacktestResult {
  run_id: string;
  strategy_id: string;
  symbol: string;
  status: string;
  metrics?: {
    total_return: number;
    annual_return: number;
    sharpe_ratio: number;
    max_drawdown: number;
    win_rate: number;
    trade_count: number;
  };
  equity_curve: { date: string; equity: number }[];
  error?: string;
}

export async function getQuantStatus(): Promise<JinceStatus> {
  const res = await apiFetch<{ success: boolean; data: JinceStatus }>(
    "/api/quant/status"
  );
  return res.data;
}

export async function listQuantStrategies(): Promise<StrategyInfo[]> {
  const res = await apiFetch<{
    success: boolean;
    data: { strategies: StrategyInfo[] };
  }>("/api/quant/strategies");
  return res.data?.strategies || [];
}

export async function runBacktest(data: {
  strategy_id: string;
  symbol: string;
  start_date: string;
  end_date: string;
  initial_capital?: number;
}): Promise<BacktestResult> {
  const res = await apiFetch<{ success: boolean; data: BacktestResult }>(
    "/api/quant/backtest",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  return res.data;
}

export async function listQuantRuns(): Promise<
  { run_id: string; strategy_id: string; symbol: string; status: string; total_return?: number }[]
> {
  const res = await apiFetch<{
    success: boolean;
    data: { runs: { run_id: string; strategy_id: string; symbol: string; status: string; total_return?: number }[] };
  }>("/api/quant/runs");
  return res.data?.runs || [];
}

// ============== Funds ==============

export interface FundInfo {
  code: string;
  name: string;
  fund_type?: string;
  manager?: string;
  company?: string;
  nav?: number;
}

export async function searchFunds(keyword: string): Promise<FundInfo[]> {
  const res = await apiFetch<{
    success: boolean;
    data: { funds: FundInfo[] };
  }>(`/api/funds/search?keyword=${encodeURIComponent(keyword)}`);
  return res.data?.funds || [];
}

export async function getFundInfo(code: string): Promise<FundInfo> {
  const res = await apiFetch<{ success: boolean; data: FundInfo }>(
    `/api/funds/${code}`
  );
  return res.data;
}

export async function getFundMetrics(code: string): Promise<Record<string, number>> {
  const res = await apiFetch<{ success: boolean; data: Record<string, number> }>(
    `/api/funds/${code}/metrics`
  );
  return res.data;
}

export async function simulateDca(data: {
  fund_code: string;
  amount: number;
  frequency?: string;
  start_date: string;
  end_date: string;
}): Promise<Record<string, unknown>> {
  const res = await apiFetch<{ success: boolean; data: Record<string, unknown> }>(
    "/api/fund-dca/simulate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  return res.data;
}

export interface DCAPlan {
  id: string;
  fund_code: string;
  fund_name: string;
  amount: number;
  frequency: string;
  start_date: string;
  status: string;
}

export async function listDcaPlans(): Promise<DCAPlan[]> {
  const res = await apiFetch<{
    success: boolean;
    data: { plans: DCAPlan[] };
  }>("/api/fund-dca/plans");
  return res.data?.plans || [];
}

export async function createDcaPlan(data: {
  fund_code: string;
  fund_name?: string;
  amount: number;
  frequency?: string;
  start_date: string;
}): Promise<DCAPlan> {
  const res = await apiFetch<{ success: boolean; data: DCAPlan }>(
    "/api/fund-dca/plans",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  return res.data;
}

// ============== Portfolio ==============

export interface FundPortfolio {
  id: string;
  name: string;
  description: string;
  holdings: { fund_code: string; fund_name?: string; weight: number }[];
  total_value?: number;
}

export async function listPortfolios(): Promise<FundPortfolio[]> {
  const res = await apiFetch<{
    success: boolean;
    data: { portfolios: FundPortfolio[] };
  }>("/api/fund-portfolio");
  return res.data?.portfolios || [];
}

export async function createPortfolio(data: {
  name: string;
  description?: string;
  holdings?: { fund_code: string; weight: number }[];
}): Promise<FundPortfolio> {
  const res = await apiFetch<{ success: boolean; data: FundPortfolio }>(
    "/api/fund-portfolio",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  return res.data;
}

export async function deletePortfolio(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/fund-portfolio/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
}

export async function rebalancePortfolio(
  portfolioId: string,
  targetWeights: Record<string, number>
): Promise<{ trades: { fund_code: string; action: string; weight_change: number }[] }> {
  const res = await apiFetch<{
    success: boolean;
    data: { trades: { fund_code: string; action: string; weight_change: number }[] };
  }>("/api/fund-portfolio/rebalance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      portfolio_id: portfolioId,
      target_weights: targetWeights,
    }),
  });
  return res.data;
}
