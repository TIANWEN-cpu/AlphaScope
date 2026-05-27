export type TabID = 'workbench' | 'dashboard' | 'news' | 'fundamentals' | 'history' | 'detailed' | 'agents' | 'saved' | 'experts' | 'tasks' | 'market' | 'fund_dca';

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

export interface StockSelection {
  symbol: string;
  name: string;
  exchange?: string;
  market?: string;
  resolved?: boolean;
  source?: string;
}
