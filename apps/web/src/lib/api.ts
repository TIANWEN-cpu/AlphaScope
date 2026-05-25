export interface ApiResponse<T> {
  success: boolean;
  data?: T | null;
  error?: string | null;
  message?: string | null;
}

export interface PriceBar {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount?: number;
  turnover?: number;
  change_pct?: number;
  frequency?: string;
  source?: string;
}

export interface NewsRecord {
  id: string;
  title: string;
  summary?: string;
  source?: string;
  source_url?: string;
  published_at?: string;
  symbols?: string[];
  event_type?: string;
  sentiment?: number;
  importance?: number;
  confidence?: number;
}

export interface AnnouncementRecord {
  id: string;
  symbol: string;
  company_name?: string;
  title: string;
  category?: string;
  published_at?: string;
  source?: string;
  source_url?: string;
  importance?: number;
  confidence?: number;
}

export interface ProviderRecord {
  id?: string;
  name?: string;
  type?: string;
  base_url?: string;
  enabled?: boolean;
  api_key?: string;
  api_key_masked?: string;
  has_api_key?: boolean;
  models?: string[];
  config_json?: string;
  [key: string]: unknown;
}

export interface ProviderSavePayload {
  id: string;
  name: string;
  base_url: string;
  api_key?: string;
  enabled?: boolean;
}

export interface ProviderTestResult {
  success: boolean;
  models?: string[];
  message?: string;
  error?: string;
}

export interface ProviderModelsResult {
  models: Array<{ id: string; owned_by?: string }>;
}

export interface AgentRecord {
  key?: string;
  id?: string;
  name?: string;
  role?: string;
  model?: string;
  provider?: string;
  enabled?: boolean;
  description?: string;
  system_prompt?: string;
  tools?: string[];
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

export interface AgentSavePayload {
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
}

export interface ChatStreamRequest {
  conversation_id?: string;
  message: string;
  mode?: string;
  stock_symbol?: string;
  stock_name?: string;
  expert_team_id?: string;
}

export interface ChatStreamEvent {
  type: "status" | "content" | "evidence" | "agents" | "done" | string;
  chunk?: string;
  data?: unknown;
  mode?: string;
}

export interface TechnicalSnapshot {
  symbol?: string;
  ma?: Record<string, unknown>[] | Record<string, unknown>;
  macd?: Record<string, unknown>[] | Record<string, unknown>;
  rsi?: Record<string, unknown>[] | number;
  kdj?: Record<string, unknown>[] | Record<string, unknown>;
  support?: number;
  resistance?: number;
  support_levels?: number[];
  resistance_levels?: number[];
  [key: string]: unknown;
}

export interface EvidenceRecord {
  id: string;
  evidence_type?: string;
  title: string;
  source?: string;
  claim?: string;
  content_summary?: string;
  symbols?: string[];
  confidence?: number;
  source_url?: string;
  data_date?: string;
  relevance?: number;
  created_at?: string;
  [key: string]: unknown;
}

export interface QuantStrategyParam {
  name: string;
  type?: string;
  default?: unknown;
  min?: number | null;
  max?: number | null;
  description?: string;
}

export interface QuantStrategy {
  id?: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  status?: string;
  params?: QuantStrategyParam[];
  version?: string;
  [key: string]: unknown;
}

export interface QuantRun {
  id?: string;
  run_id?: string;
  strategy_id?: string;
  symbol?: string;
  status?: string;
  total_return?: number;
  result?: Record<string, unknown>;
  created_at?: string;
  [key: string]: unknown;
}

export interface FundRecord {
  code?: string;
  fund_code?: string;
  name?: string;
  fund_name?: string;
  type?: string;
  fund_type?: string;
  [key: string]: unknown;
}

export interface FundPortfolioHolding {
  fund_code: string;
  fund_name?: string;
  weight: number;
  current_value?: number | null;
  actual_weight?: number | null;
}

export interface FundPortfolio {
  id: string;
  name: string;
  description?: string;
  holdings: FundPortfolioHolding[];
  total_value?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FundPortfolioCreatePayload {
  name: string;
  description?: string;
  holdings?: FundPortfolioHolding[];
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined | null>) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  params?: Record<string, string | number | boolean | undefined | null>,
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(buildUrl(path, params), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok) {
      return {
        success: false,
        error: payload.error || payload.message || `HTTP ${response.status}`,
        data: payload.data,
      };
    }
    return payload;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "API request failed",
      data: null,
    };
  }
}

export async function streamChat(
  payload: ChatStreamRequest,
  onEvent: (event: ChatStreamEvent) => void,
) {
  const response = await fetch(buildUrl("/api/chat/stream"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    let errorMessage = `Chat stream failed: HTTP ${response.status}`;
    try {
      const text = await response.text();
      if (text) {
        try {
          const payload = JSON.parse(text) as {
            error?: string;
            message?: string;
            detail?: string | { msg?: string } | Array<{ msg?: string }>;
          };
          if (payload.error || payload.message) {
            errorMessage = payload.error || payload.message || errorMessage;
          } else if (typeof payload.detail === "string") {
            errorMessage = payload.detail;
          } else if (Array.isArray(payload.detail) && payload.detail[0]?.msg) {
            errorMessage = payload.detail[0].msg;
          } else if (payload.detail && typeof payload.detail === "object" && "msg" in payload.detail) {
            errorMessage = String(payload.detail.msg);
          }
        } catch {
          errorMessage = text;
        }
      }
    } catch {
      // Keep HTTP fallback.
    }
    throw new Error(errorMessage);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const rawEvent of events) {
      const dataLine = rawEvent
        .split("\n")
        .find((line) => line.startsWith("data:"));
      if (!dataLine) continue;

      const jsonText = dataLine.replace(/^data:\s*/, "");
      try {
        onEvent(JSON.parse(jsonText) as ChatStreamEvent);
      } catch {
        onEvent({ type: "content", chunk: jsonText });
      }
    }

    if (done) break;
  }
}

export const api = {
  baseUrl: API_BASE_URL,
  health: () => request<{ status: string; version: string }>("/health"),
  prices: (symbol: string, limit = 80, frequency = "1d") =>
    request<{ symbol: string; bars: PriceBar[]; total: number }>(
      `/api/prices/${encodeURIComponent(symbol)}`,
      {},
      { limit, frequency },
    ),
  latestPrice: (symbol: string) =>
    request<PriceBar>(`/api/prices/${encodeURIComponent(symbol)}/latest`),
  fundamentals: (symbol: string) =>
    request<Record<string, unknown>>(`/api/fundamentals/${encodeURIComponent(symbol)}`),
  news: (symbol?: string, limit = 20) =>
    request<{ news: NewsRecord[]; total: number }>("/api/news", {}, { symbol, limit }),
  announcements: (symbol?: string, limit = 10) =>
    request<{ announcements: AnnouncementRecord[]; total: number }>(
      "/api/news/announcements",
      {},
      { symbol, limit },
    ),
  fundFlow: (symbol: string, days = 30) =>
    request<Record<string, unknown>>(`/api/fund-flow/${encodeURIComponent(symbol)}`, {}, { days }),
  agents: () => request<{ agents: AgentRecord[] }>("/api/agents"),
  manageAgents: () => request<{ agents: AgentRecord[] }>("/api/manage/agents"),
  manageAgentSave: (payload: AgentSavePayload) =>
    request<AgentRecord>("/api/manage/agents", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  teams: () => request<{ teams: unknown[] }>("/api/teams"),
  providers: () => request<{ providers: ProviderRecord[] }>("/api/settings/providers"),
  providerSave: (payload: ProviderSavePayload) =>
    request<ProviderRecord>("/api/settings/providers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  providerDelete: (id: string) =>
    request<{ deleted: string }>(`/api/settings/providers/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  providerTest: (id: string) =>
    request<ProviderTestResult>(`/api/settings/providers/${encodeURIComponent(id)}/test`, {
      method: "POST",
    }),
  providerModels: (id: string) =>
    request<ProviderModelsResult>(`/api/settings/providers/${encodeURIComponent(id)}/models`),
  modelProviders: () => request<{ providers: ProviderRecord[] }>("/api/models/providers"),
  tasks: () => request<Record<string, unknown>>("/api/tasks"),
  normalizeSymbol: (symbol: string) =>
    request<{ original: string; normalized: string; market: string }>(
      `/api/prices/normalize/${encodeURIComponent(symbol)}`,
    ),
  priceFetch: (symbol: string, days = 120) =>
    request<{ symbol: string; fetched: number }>(
      `/api/prices/${encodeURIComponent(symbol)}/fetch`,
      { method: "POST" },
      { days },
    ),
  technical: (symbol: string, limit = 250) =>
    request<TechnicalSnapshot>(`/api/technical/${encodeURIComponent(symbol)}`, {}, { limit }),
  technicalSupportResistance: (symbol: string, lookback = 20) =>
    request<TechnicalSnapshot>(
      `/api/technical/${encodeURIComponent(symbol)}/support-resistance`,
      {},
      { lookback },
    ),
  factors: (symbol: string, stockName = "", days = 30) =>
    request<Record<string, unknown>>(
      `/api/factors/${encodeURIComponent(symbol)}`,
      {},
      { stock_name: stockName, days },
    ),
  newsSearch: (query: string, limit = 20) =>
    request<{ query: string; results: NewsRecord[]; total: number }>("/api/news/search", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    }),
  newsDetail: (id: string) => request<NewsRecord>(`/api/news/${encodeURIComponent(id)}`),
  newsEvents: (symbol: string, days = 30) =>
    request<Record<string, unknown>>(`/api/news/events/${encodeURIComponent(symbol)}`, {}, { days }),
  newsImpact: (symbol: string, days = 30, window = 5) =>
    request<Record<string, unknown>>(
      `/api/news/impact/${encodeURIComponent(symbol)}`,
      {},
      { days, window },
    ),
  evidenceList: (symbol?: string, limit = 50) =>
    request<{ evidence: EvidenceRecord[]; total: number }>("/api/evidence", {}, { symbol, limit }),
  evidenceCreate: (payload: Partial<EvidenceRecord>) =>
    request<EvidenceRecord>("/api/evidence", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  evidenceDelete: (id: string) =>
    request<{ deleted: string }>(`/api/evidence/${encodeURIComponent(id)}`, { method: "DELETE" }),
  evidenceChain: (evidence: EvidenceRecord[], agentSignals: Record<string, unknown>[] = []) =>
    request<Record<string, unknown>>("/api/evidence/chain", {
      method: "POST",
      body: JSON.stringify({ evidence, agent_signals: agentSignals }),
    }),
  archiveList: (stock?: string, limit = 50) =>
    request<{ reports: Record<string, unknown>[]; total: number }>("/api/archive", {}, { stock, limit }),
  archiveReport: (path: string) =>
    request<{ path: string; content: string }>(`/api/archive/report/${encodeURIComponent(path)}`),
  quantStatus: () => request<Record<string, unknown>>("/api/quant/status"),
  quantStrategies: async () => {
    const result = await request<QuantStrategy[] | { strategies: QuantStrategy[] }>("/api/quant/strategies");
    const raw = result.data;
    const strategies = Array.isArray(raw) ? raw : raw?.strategies || [];
    return { ...result, data: { strategies } };
  },
  quantRuns: () => request<{ runs: QuantRun[] }>("/api/quant/runs"),
  quantReloadStrategies: () =>
    request<Record<string, unknown>>("/api/quant/strategies/reload", { method: "POST" }),
  quantBacktest: (payload: {
    strategy_id: string;
    symbol: string;
    start_date: string;
    end_date: string;
    initial_capital?: number;
    params?: Record<string, unknown>;
  }) =>
    request<Record<string, unknown>>("/api/quant/backtest", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  fundSearch: (keyword: string) =>
    request<{ funds: FundRecord[]; total: number }>("/api/funds/search", {}, { keyword }),
  fundInfo: (code: string) => request<FundRecord>(`/api/funds/${encodeURIComponent(code)}`),
  fundNav: (code: string, startDate = "", endDate = "") =>
    request<{ code: string; navs: Record<string, unknown>[]; total: number }>(
      `/api/funds/${encodeURIComponent(code)}/nav`,
      {},
      { start_date: startDate, end_date: endDate },
    ),
  fundMetrics: (code: string) =>
    request<Record<string, unknown>>(`/api/funds/${encodeURIComponent(code)}/metrics`),
  fundDcaSimulate: (payload: {
    fund_code: string;
    amount: number;
    frequency: string;
    start_date: string;
    end_date: string;
  }) =>
    request<Record<string, unknown>>("/api/fund-dca/simulate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  fundPortfolios: () =>
    request<{ portfolios: FundPortfolio[]; total: number }>("/api/fund-portfolio"),
  fundPortfolioCreate: (payload: FundPortfolioCreatePayload) =>
    request<FundPortfolio>("/api/fund-portfolio", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  fundReportGenerate: (payload: {
    fund_code: string;
    include_metrics?: boolean;
    include_dca?: boolean;
  }) =>
    request<{ fund_code: string; content: string; metrics: Record<string, unknown> }>(
      "/api/fund-reports/generate",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  visionAnalyze: (payload: {
    image_base64: string;
    mime_type?: string;
    user_context?: string;
    vendor?: string;
    model?: string;
    ticker?: string;
  }) =>
    request<Record<string, unknown>>("/api/vision/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  visionReport: (payload: {
    image_base64: string;
    mime_type?: string;
    user_context?: string;
    vendor?: string;
    model?: string;
    ticker?: string;
  }) =>
    request<{ report: string; ticker: string; is_chart: boolean }>("/api/vision/report", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  streamChat,
};
