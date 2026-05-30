import { fetchApi, API_BASE_URL, API_KEY } from './api';
import { AgentOpinion, AnalysisResult } from '../types';
import { mockAnalysisResult } from './mockAnalysisData';
import { getEnabledAgentRuntimeConfigs } from './agentConfigs';

interface AnalysisRunData {
  stock_symbol?: string;
  stock_name?: string;
  mode?: string;
  result?: unknown;
}

interface AsyncAnalysisStartData {
  task_id: string;
  status: string;
}

interface TaskResultData {
  output_json?: string;
  [key: string]: unknown;
}

const SIGNAL_MAP: Record<string, AgentOpinion['signal']> = {
  BUY: 'BUY',
  LONG: 'BUY',
  BULLISH: 'BUY',
  买入: 'BUY',
  看多: 'BUY',
  增持: 'BUY',
  强烈推荐: 'BUY',
  SELL: 'SELL',
  SHORT: 'SELL',
  BEARISH: 'SELL',
  卖出: 'SELL',
  看空: 'SELL',
  减持: 'SELL',
  HOLD: 'HOLD',
  NEUTRAL: 'HOLD',
  WAIT: 'HOLD',
  观望: 'HOLD',
  中性: 'HOLD',
  持有: 'HOLD',
};

function normalizeSignal(value: unknown): AgentOpinion['signal'] {
  const raw = String(value ?? '').trim();
  if (!raw) return 'HOLD';
  return SIGNAL_MAP[raw] || SIGNAL_MAP[raw.toUpperCase()] || 'HOLD';
}

function normalizeConfidence(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
}

/**
 * Normalizes the raw backend response into a consistent frontend AnalysisResult.
 * This adapter layer protects UI components from backend schema drift.
 */
export function normalizeAnalysisResult(raw: any): AnalysisResult {
  // Extract fields with safe defaults
  const agents = raw?.agents || raw?.result?.agents || {};
  const evidence = raw?.evidence || raw?.result?.evidence || [];
  const provider_traces = raw?.provider_traces || raw?.result?.provider_traces || [];
  const source_appendix = raw?.source_appendix || raw?.result?.source_appendix || [];
  const degraded = raw?.degraded ?? raw?.result?.degraded ?? false;
  const source_errors = raw?.source_errors || raw?.result?.source_errors || [];
  const summary = raw?.summary || raw?.result?.summary || '';
  const critic = raw?.critic || raw?.result?.critic || '';
  const chairman_summary = raw?.chairman_summary || raw?.result?.chairman_summary || '';

  // Ensure agent references are mapped properly
  const normalizedAgents: Record<string, any> = {};
  for (const [key, agentData] of Object.entries<any>(agents)) {
    // Collect refs from agent's own data, deduplicate
    const refs = agentData.evidence_refs || [];
    const uniqueRefs = Array.from(new Set(refs));
    
    normalizedAgents[key] = {
      signal: normalizeSignal(agentData.signal),
      confidence: normalizeConfidence(agentData.confidence),
      reason: agentData.reason || '',
      risk_points: agentData.risk_points || [],
      evidence_refs: uniqueRefs,
    };
  }

  return {
    summary,
    critic,
    chairman_summary,
    agents: normalizedAgents,
    evidence,
    provider_traces,
    source_appendix,
    degraded,
    source_errors
  };
}

/**
 * Evaluates the actual integrity severity based on traces and evidence,
 * rather than relying solely on the binary `degraded` flag.
 */
export function deriveDataIntegritySeverity(result: AnalysisResult): 'green' | 'yellow' | 'red' {
  // If explicitly healthy, it's green
  if (!result.degraded && result.source_errors.length === 0) {
    return 'green';
  }

  // Check if critical data is entirely missing
  const quoteTrace = result.provider_traces.find(t => t.data_type === 'quote');
  const riskTrace = result.provider_traces.find(t => t.data_type === 'risk_events');
  
  const quoteMissing = !quoteTrace || quoteTrace.items_count === 0;
  const riskMissing = !riskTrace || riskTrace.items_count === 0;

  // If both critical traces are missing, or there are no traces at all but it claims degraded
  if (result.degraded && (quoteMissing || riskMissing || result.provider_traces.length === 0)) {
    return 'red';
  }

  // Otherwise, it's partially degraded (e.g. fallback successful or non-critical trace failed)
  return 'yellow';
}

/**
 * Runs analysis via real API. Mock data is only used when explicitly requested.
 */
export async function runAnalysisWithFallback(stockSymbol: string, stockName: string, mode: string = 'deep', useMockForcefully: boolean = false): Promise<AnalysisResult> {
  if (useMockForcefully) {
    console.log('[Adapter] Using forced mock data');
    // Simulate network delay
    await new Promise(r => setTimeout(r, 1500));
    return normalizeAnalysisResult(mockAnalysisResult);
  }

  try {
    const rawResult = await fetchApi<AnalysisRunData>('/api/analysis/run', {
      method: 'POST',
      body: JSON.stringify({
        stock_symbol: stockSymbol,
        stock_name: stockName,
        mode: mode,
        agent_configs: getEnabledAgentRuntimeConfigs()
      })
    });
    
    return normalizeAnalysisResult(rawResult);
  } catch (err) {
    console.warn(`[Adapter] Real API failed:`, err);
    if (import.meta.env.VITE_USE_MOCK_REPORT === 'true') {
      console.log('[Adapter] Falling back to mock data in development mode');
      return normalizeAnalysisResult(mockAnalysisResult);
    }
    throw err;
  }
}

/**
 * Starts an async analysis task. Returns the task ID.
 */
export async function startAsyncAnalysis(stockSymbol: string, stockName: string, mode: string = 'deep', useMockForcefully: boolean = false): Promise<string> {
  if (useMockForcefully) {
    return 'mock-task-123';
  }
  
  try {
    const rawResult = await fetchApi<AsyncAnalysisStartData>('/api/analysis/async', {
      method: 'POST',
      body: JSON.stringify({
        stock_symbol: stockSymbol,
        stock_name: stockName,
        mode: mode,
        conversation_id: '',
        agent_configs: getEnabledAgentRuntimeConfigs()
      })
    });
    return rawResult.task_id;
  } catch (err) {
    console.warn(`[Adapter] Async API failed:`, err);
    if (import.meta.env.VITE_USE_MOCK_REPORT === 'true') {
      return 'mock-task-123';
    }
    throw err;
  }
}

/**
 * Fetches the result of a completed task.
 */
export async function getTaskResult(taskId: string, useMockForcefully: boolean = false): Promise<AnalysisResult> {
  if (useMockForcefully || taskId === 'mock-task-123') {
    return normalizeAnalysisResult(mockAnalysisResult);
  }
  const rawResult = await fetchApi<TaskResultData>(`/api/tasks/${taskId}`);
  
  // The backend task returns { output_json: "{...}" }
  if (rawResult.output_json) {
    let parsed;
    try {
      parsed = JSON.parse(rawResult.output_json);
    } catch (e) {
      parsed = rawResult;
    }
    return normalizeAnalysisResult(parsed);
  }
  
  return normalizeAnalysisResult(rawResult);
}

/**
 * Returns the SSE endpoint URL for tasks
 */
export function getTaskEventsUrl(): string {
  const base = API_BASE_URL.replace(/\/+$/, '');
  const url = new URL(`${base}/api/tasks/events`);
  if (API_KEY) {
    url.searchParams.set('token', API_KEY);
  }
  return url.toString();
}
