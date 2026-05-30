export type TabID = 'workbench' | 'dashboard' | 'news' | 'detailed' | 'agents' | 'saved' | 'experts' | 'tasks' | 'market' | 'fund_dca' | 'chart' | 'settings';

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'critic';
  agentName?: string;
  content: string;
  timestamp: string;
}

export interface AgentModule {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'analyzing' | 'completed' | 'offline';
  description: string;
  department: 'san-sheng' | 'liu-bu'; // 三省(Decision) or 六部(Functional)
}

export interface BacktestResult {
  id: string;
  strategyName: string;
  returnRate: number;
  maxDrawdown: number;
  winRate: number;
  sharpeRatio: number;
  dateRange: string;
}

// --- Backend Data Source Tracing Types ---

export interface FallbackAttempt {
  provider: string;
  endpoint: string;
  status: string;
  latency_ms: number;
  items_count: number;
  error: string;
  fallback_to: string;
}

export interface ProviderTrace {
  data_type: string;
  provider_trace_id: string;
  selected_provider: string;
  source_chain: string[];
  fallback_attempts: FallbackAttempt[];
  field_fill_map: Record<string, string>;
  errors: any[];
  degraded: boolean;
  items_count: number;
}

export interface SourceAppendixItem {
  data_type: string;
  selected_provider: string;
  source_chain: string[];
  degraded: boolean;
  items_count: number;
  field_fill_map: Record<string, string>;
  last_error: string;
  provider_trace_id: string;
}

export interface ProviderEvidence {
  id: string;
  ref_id: string;
  type: string;
  title: string;
  claim: string;
  source: string;
  retrieved_at: string;
  raw_value: any;
  derivation: string;
  source_call: string;
  provider_trace_id: string;
  confidence: number;
}

export interface AgentOpinion {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reason: string;
  risk_points?: string[];
  evidence_refs?: string[];
}

export interface AnalysisResult {
  summary?: string;
  agents: Record<string, AgentOpinion>;
  critic?: string;
  chairman_summary?: string;
  evidence: ProviderEvidence[];
  provider_traces: ProviderTrace[];
  source_appendix: SourceAppendixItem[];
  degraded: boolean;
  source_errors: any[];
}

export interface AnalysisTask {
  id: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  input_json: string;
  output_json: string;
  error: string;
  created_at: number;
}

export interface ProviderHealthItem {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  consecutive_failures: number;
  avg_latency_ms: number;
  last_error: string;
  last_success?: string | number;
  empty_count: number;
  recent_calls?: number;
  stability: 'stable' | 'fragile';
  risk_note: string;
  data_types: string[];
  markets: string[];
}
