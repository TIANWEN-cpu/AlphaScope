/**
 * AI-Finance API Client
 *
 * Connects to the FastAPI backend for chat, analysis, vision, and config.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AnalysisResult {
  mode: string;
  content: string;
  agents?: Record<string, AgentResult>;
  evidence?: Evidence[];
  summary?: VotingSummary;
  compliance_note?: string;
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

// ============== API Functions ==============

export async function createConversation(data: {
  title?: string;
  stock_symbol?: string;
  stock_name?: string;
  mode?: string;
}): Promise<{ conversation_id: string }> {
  const res = await fetch(`${API_BASE}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function listConversations(
  stock_symbol?: string,
  limit = 20
): Promise<{ conversations: Conversation[] }> {
  const params = new URLSearchParams();
  if (stock_symbol) params.set('stock_symbol', stock_symbol);
  params.set('limit', String(limit));
  const res = await fetch(`${API_BASE}/api/conversations?${params}`);
  return res.json();
}

export async function getConversation(
  conversation_id: string
): Promise<{ conversation: Conversation; messages: ChatMessage[] }> {
  const res = await fetch(`${API_BASE}/api/conversations/${conversation_id}`);
  return res.json();
}

export async function deleteConversation(conversation_id: string): Promise<void> {
  await fetch(`${API_BASE}/api/conversations/${conversation_id}`, {
    method: 'DELETE',
  });
}

export async function sendMessage(data: {
  conversation_id?: string;
  message: string;
  mode?: string;
  stock_symbol?: string;
  stock_name?: string;
  expert_team_id?: string;
}): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function runAnalysis(data: {
  stock_symbol: string;
  stock_name?: string;
  mode?: string;
}): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/api/analysis/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function analyzeVision(data: {
  image_base64: string;
  mime_type?: string;
  user_context?: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/api/vision/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function listAgents(): Promise<{ agents: Record<string, unknown>[] }> {
  const res = await fetch(`${API_BASE}/api/agents`);
  return res.json();
}

export async function listTeams(): Promise<{ teams: Record<string, unknown>[] }> {
  const res = await fetch(`${API_BASE}/api/teams`);
  return res.json();
}

export async function listProviders(): Promise<{ providers: Record<string, unknown>[] }> {
  const res = await fetch(`${API_BASE}/api/models/providers`);
  return res.json();
}

export async function listModes(): Promise<{ modes: Record<string, unknown>[] }> {
  const res = await fetch(`${API_BASE}/api/modes`);
  return res.json();
}

export async function getCosts(mode?: string): Promise<Record<string, unknown>> {
  const params = mode ? `?mode=${mode}` : '';
  const res = await fetch(`${API_BASE}/api/costs${params}`);
  return res.json();
}

export async function getBacktestStats(mode?: string): Promise<Record<string, unknown>> {
  const params = mode ? `?mode=${mode}` : '';
  const res = await fetch(`${API_BASE}/api/backtest/stats${params}`);
  return res.json();
}
