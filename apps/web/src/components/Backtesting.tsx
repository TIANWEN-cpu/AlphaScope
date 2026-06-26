import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ComponentType } from 'react';
import {
  Activity,
  BarChart,
  CheckCircle2,
  Code2,
  Cpu,
  Download,
  Flag,
  History,
  Layers,
  Play,
  Settings2,
  ShieldAlert,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { findStockTarget, STOCK_UNIVERSE, StockTarget } from '../lib/stocks';
import { API_BASE_URL, LOCAL_API_TOKEN, fetchApi } from '../lib/api';
import { getPersistedStock, subscribeStockSelected } from '../lib/workspaceEvents';
import { getErrorMessage, stripSymbolSuffix, useAsync } from '../lib/dataFetch';
import { StableChartContainer } from './StableChartContainer';

type TabID = 'overview' | 'workshop' | 'pool' | 'compare';

const TABS: Array<{ id: TabID; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: '回测大厅', icon: History },
  { id: 'workshop', label: '策略工坊', icon: Code2 },
  { id: 'pool', label: '股票池解析', icon: Layers },
  { id: 'compare', label: '后验比对', icon: Activity },
];

const DEFAULT_POOL_TEXT = `600519 贵州茅台
300750 宁德时代
600036 招商银行
002594 比亚迪
300059 东方财富
601318 中国平安`;

// ---- Backend response contracts (backend/api/backtest_new.py + main.py) ----

interface PerformanceMetrics {
  total_return?: number;
  annual_return?: number;
  max_drawdown?: number;
  sharpe_ratio?: number;
  sortino_ratio?: number;
  calmar_ratio?: number;
  win_rate?: number;
  profit_factor?: number;
  trade_count?: number;
  initial_capital?: number;
  final_equity?: number;
  trading_days?: number;
  volatility?: number;
  // v1.9.4 基准相关指标(有基准时存在)
  has_benchmark?: boolean;
  benchmark_name?: string;
  excess_return?: number;
  information_ratio?: number;
  beta?: number;
  alpha?: number;
}

interface TradeRecord {
  symbol?: string;
  side?: string;
  shares?: number;
  price?: number;
  commission?: number;
  pnl?: number;
  timestamp?: string;
}

interface RiskViolation {
  rule?: string;
  reason?: string;
  date?: string;
}

/** Backtest engine friction assumptions (T+1 / stamp duty / slippage / etc.).
 * Mirrors backend/quant/engine.py BacktestEngine._assumptions(). */
interface BacktestAssumptions {
  commission_rate?: number;
  commission_min?: number;
  stamp_duty_rate?: number;
  slippage_rate?: number;
  t_plus_1?: boolean;
  price_limit_filter?: boolean;
  price_limit_band?: number;
  execution_price?: string;
  note?: string;
}

interface BacktestEquityPoint {
  date?: string;
  equity?: number;
  value?: number;
}

interface BacktestSummary {
  data_source?: string;
  data_source_label?: string;
  bar_count?: number;
  trade_count?: number;
  risk_violation_count?: number;
  start_date?: string;
  end_date?: string;
}

interface BacktestResultData {
  run_id?: string;
  strategy_id?: string;
  symbol?: string;
  equity_curve?: BacktestEquityPoint[];
  trades?: TradeRecord[];
  metrics?: PerformanceMetrics;
  risk_violations?: RiskViolation[];
  summary?: BacktestSummary;
  assumptions?: BacktestAssumptions;
  message?: string;
}

interface StrategyInfo {
  id: string;
  name: string;
  description?: string;
  default_params?: Record<string, unknown>;
}

interface FactorResponse {
  symbol: string;
  stock_name?: string;
  computed_at?: string;
  factors?: Record<string, number>;
  sample_counts?: Record<string, number>;
  degraded_inputs?: string[];
  missing_dimensions?: string[];
  signals?: Array<Record<string, number | string | boolean>>;
}

interface FactorRow {
  stock: StockTarget;
  composite?: number;
  momentum?: number;
  fund_flow?: number;
  quality: number;
  computed_at?: string;
  error?: string;
}

interface BacktestStats {
  total?: number;
  evaluated?: number;
  message?: string;
  buy_signals?: { count?: number; accuracy_5d?: number };
  sell_signals?: { count?: number };
  hold_signals?: { count?: number };
}

interface PendingEval {
  decision_id?: string;
  symbol?: string;
  signal?: string;
  price?: number;
  days_elapsed?: number;
}

interface AgentAccuracy {
  agents?: Record<string, { accuracy?: number; total_decisions?: number; avg_return?: number }>;
}

function parsePoolText(value: string): StockTarget[] {
  const tokens = value
    .split(/[\n,，;\t ]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  return tokens.reduce<StockTarget[]>((acc, token) => {
    const stock = findStockTarget(token);
    if (stock && !seen.has(stock.symbol)) {
      seen.add(stock.symbol);
      acc.push(stock);
    }
    return acc;
  }, []);
}

function formatFactor(value?: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '--';
  return value.toFixed(2);
}

function formatPercent(value?: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '--';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone?: 'rose' | 'emerald' | 'indigo' | 'neutral' | 'amber';
}) {
  const color = {
    rose: 'text-rose-400',
    emerald: 'text-emerald-400',
    indigo: 'text-indigo-300',
    neutral: 'text-neutral-300',
    amber: 'text-amber-300',
  }[tone];

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">{label}</p>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <h3 className="text-3xl font-mono font-medium text-white">{value}</h3>
      <p className={cn('mt-2 text-[11px] font-mono', color)}>{hint}</p>
    </div>
  );
}

/** Render the backtest engine's friction assumptions so users can see exactly
 * what costs/limits were modelled (transparency / auditability). */
function AssumptionsCard({ assumptions }: { assumptions?: BacktestAssumptions }) {
  if (!assumptions) return null;
  const pct = (v?: number) => (typeof v === 'number' ? `${(v * 100).toFixed(2)}%` : '--');
  const rows: Array<{ label: string; value: string; on?: boolean }> = [
    { label: 'T+1 结算', value: assumptions.t_plus_1 ? '启用' : '关闭', on: assumptions.t_plus_1 },
    { label: '涨跌停封板过滤', value: assumptions.price_limit_filter ? `启用 · ±${((assumptions.price_limit_band ?? 0.1) * 100).toFixed(0)}%` : '关闭', on: assumptions.price_limit_filter },
    { label: '佣金（双边）', value: pct(assumptions.commission_rate) + (assumptions.commission_min ? ` · 最低 ¥${assumptions.commission_min}` : '') },
    { label: '印花税（卖出）', value: pct(assumptions.stamp_duty_rate) },
    { label: '滑点', value: pct(assumptions.slippage_rate) },
    { label: '成交价口径', value: assumptions.execution_price === 'open' ? '次日开盘（防未来函数）' : (assumptions.execution_price || '--') },
  ];
  return (
    <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-5 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-200/80">
          <ShieldAlert className="h-4 w-4" />
          本次回测假设
        </h3>
        <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-300">真实摩擦成本</span>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-white/5 bg-black/25 px-3 py-2">
            <p className="text-[10px] text-neutral-500">{row.label}</p>
            <p className={cn('mt-0.5 text-xs font-mono', row.on === false ? 'text-neutral-600' : 'text-neutral-200')}>{row.value}</p>
          </div>
        ))}
      </div>
      {assumptions.note && (
        <p className="mt-3 text-[10px] leading-relaxed text-neutral-500">{assumptions.note}</p>
      )}
    </div>
  );
}

/** Trade blotter — renders the `trades` field that was typed but never shown. */
function TradeTable({ trades }: { trades?: TradeRecord[] }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-5 shadow-xl">
        <h3 className="mb-3 text-xs font-mono uppercase tracking-widest text-neutral-400">交易明细</h3>
        <p className="text-xs text-neutral-500">本次回测无成交记录。</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-5 shadow-xl">
      <h3 className="mb-3 text-xs font-mono uppercase tracking-widest text-neutral-400">交易明细 · 共 {trades.length} 笔</h3>
      <div className="max-h-72 overflow-auto custom-scrollbar">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-black/40 text-[10px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-2 py-2 font-medium">时间</th>
              <th className="px-2 py-2 font-medium">方向</th>
              <th className="px-2 py-2 text-right font-medium">数量</th>
              <th className="px-2 py-2 text-right font-medium">成交价</th>
              <th className="px-2 py-2 text-right font-medium">佣金</th>
              <th className="px-2 py-2 text-right font-medium">盈亏</th>
            </tr>
          </thead>
          <tbody className="font-mono text-neutral-300">
            {trades.map((t, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="px-2 py-1.5 text-neutral-500">{t.timestamp || '--'}</td>
                <td className="px-2 py-1.5">
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px]', t.side === 'buy' ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300')}>
                    {t.side === 'buy' ? '买入' : '卖出'}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right">{t.shares ?? '--'}</td>
                <td className="px-2 py-1.5 text-right">{t.price != null ? t.price.toFixed(2) : '--'}</td>
                <td className="px-2 py-1.5 text-right text-neutral-500">{t.commission != null ? t.commission.toFixed(2) : '--'}</td>
                <td className={cn('px-2 py-1.5 text-right', (t.pnl ?? 0) >= 0 ? 'text-rose-300' : 'text-emerald-300')}>
                  {t.pnl != null ? (t.pnl >= 0 ? '+' : '') + t.pnl.toFixed(2) : '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Backtesting() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const persisted = getPersistedStock();
  const [activeTab, setActiveTab] = useState<TabID>('overview');
  const [poolText, setPoolText] = useState(DEFAULT_POOL_TEXT);
  const [actionMessage, setActionMessage] = useState('回测引擎待命，选择策略与标的后可启动真实回测。');

  // Backtest run state
  const persistedStock = useMemo(() => persisted ?? STOCK_UNIVERSE[0], [persisted]);
  const [selectedSymbol, setSelectedSymbol] = useState(persistedStock.symbol);
  const [selectedStockName, setSelectedStockName] = useState(persistedStock.name);
  const [days, setDays] = useState(180);
  const [initialCapital, setInitialCapital] = useState(1000000);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResultData | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Strategy catalogue (real)
  const strategiesAsync = useAsync<StrategyInfo[]>(
    () => fetchApi<{ strategies?: StrategyInfo[] } | StrategyInfo[]>('/api/quant/strategies').then((r) => {
      const list = Array.isArray(r) ? r : r?.strategies || [];
      return list;
    }),
    [],
  );
  const strategies = strategiesAsync.data ?? [];
  const [selectedStrategy, setSelectedStrategy] = useState<string>('');

  useEffect(() => {
    if (!selectedStrategy && strategies.length) {
      setSelectedStrategy(strategies[0].id || strategies[0].name);
    }
  }, [strategies, selectedStrategy]);

  // Stock sync with workspace
  useEffect(() => subscribeStockSelected(({ stock }) => {
    setSelectedSymbol(stock.symbol);
    setSelectedStockName(stock.name);
  }), []);

  // Stock pool factor screening (real /api/factors per stock)
  const poolStocks = useMemo(() => parsePoolText(poolText), [poolText]);
  const [poolRows, setPoolRows] = useState<FactorRow[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolSource, setPoolSource] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!poolStocks.length) {
      setPoolRows([]);
      setPoolSource('');
      return;
    }
    setPoolLoading(true);
    setPoolSource('正在计算真实截面因子...');
    Promise.allSettled(
      poolStocks.map((stock) =>
        fetchApi<FactorResponse>(
          `/api/factors/${encodeURIComponent(stripSymbolSuffix(stock.symbol))}?stock_name=${encodeURIComponent(stock.name)}&days=30`,
        ).then((payload) => ({ stock, payload })),
      ),
    ).then((results) => {
      if (cancelled) return;
      const rows: FactorRow[] = results.map((res, index) => {
        const stock = poolStocks[index];
        if (res.status === 'fulfilled') {
          const factors = res.value.payload.factors || {};
          const missing = res.value.payload.missing_dimensions || [];
          const degraded = res.value.payload.degraded_inputs || [];
          const quality = Math.max(0, 100 - missing.length * 20 - degraded.length * 10);
          return {
            stock,
            composite: factors.composite,
            momentum: factors.momentum,
            fund_flow: factors.fund_flow,
            quality,
            computed_at: res.value.payload.computed_at,
          };
        }
        return {
          stock,
          quality: 0,
          error: getErrorMessage(res.reason),
        };
      });
      setPoolRows(rows);
      setPoolLoading(false);
      const latest = rows.find((row) => row.computed_at)?.computed_at?.slice(0, 19).replace('T', ' ');
      setPoolSource(latest ? `真实截面因子 · 计算于 ${latest}` : '真实截面因子 · 已计算');
    });
    return () => {
      cancelled = true;
    };
  }, [poolStocks]);

  // Post-mortem compare data (real /api/backtest/*)
  const [stats, setStats] = useState<BacktestStats | null>(null);
  const [pending, setPending] = useState<PendingEval[]>([]);
  const [agentAccuracy, setAgentAccuracy] = useState<AgentAccuracy | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'compare') return;
    let cancelled = false;
    setCompareLoading(true);
    setCompareError(null);
    Promise.allSettled([
      fetchApi<BacktestStats>('/api/backtest/stats'),
      fetchApi<{ pending?: PendingEval[] }>('/api/backtest/pending').then((r) => r.pending || []),
      fetchApi<{ agents?: AgentAccuracy['agents'] }>('/api/backtest/agent-accuracy'),
    ]).then((results) => {
      if (cancelled) return;
      setCompareLoading(false);
      if (results[0].status === 'fulfilled') setStats(results[0].value);
      else setCompareError(getErrorMessage(results[0].reason));
      if (results[1].status === 'fulfilled') setPending(results[1].value);
      if (results[2].status === 'fulfilled') setAgentAccuracy({ agents: results[2].value.agents });
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const runTest = async () => {
    if (!selectedStrategy) {
      setActionMessage('请先在策略工坊选择一个策略。');
      return;
    }
    setRunning(true);
    setRunError(null);
    setResult(null);
    setActionMessage(`正在运行「${selectedStrategy}」对 ${selectedStockName}(${stripSymbolSuffix(selectedSymbol)}) 的真实回测...`);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const res = await fetchApi<BacktestResultData>('/api/quant/backtest', {
        method: 'POST',
        body: JSON.stringify({
          strategy_id: selectedStrategy,
          symbol: stripSymbolSuffix(selectedSymbol),
          start_date: fmt(startDate),
          end_date: fmt(endDate),
          initial_capital: initialCapital,
          params: {},
        }),
      });
      setResult(res);
      const perf = res.metrics || {};
      const tradeCount = perf.trade_count ?? 0;
      if (tradeCount === 0) {
        setActionMessage(
          `回测完成但 0 笔交易：策略未触发买卖信号，或当前本金（¥${initialCapital.toLocaleString()}）按 A 股 100 股整手买不进该标的。可尝试提高本金或更换标的。${res.summary?.data_source_label ? ' 数据来源：' + res.summary.data_source_label : ''}`,
        );
      } else {
        setActionMessage(
          `回测完成：${tradeCount} 笔交易，累计收益 ${formatPercent(perf.total_return)}，最大回撤 ${formatPercent(perf.max_drawdown)}。${res.summary?.data_source_label ? '数据来源：' + res.summary.data_source_label : ''}`,
        );
      }
    } catch (err) {
      const msg = getErrorMessage(err);
      setRunError(msg);
      setActionMessage(`回测失败：${msg}`);
    } finally {
      setRunning(false);
    }
  };

  const handlePoolImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setPoolText(text || DEFAULT_POOL_TEXT);
      setActionMessage(`已导入股票池文件「${file.name}」，真实因子结果会自动刷新。`);
    };
    reader.readAsText(file, 'utf-8');
    event.target.value = '';
  };

  const exportPool = async () => {
    let csvText = 'symbol,name,sector,composite,momentum,fund_flow,quality\n';
    csvText += poolRows
      .map((row) => `${row.stock.symbol},${row.stock.name},${row.stock.sector},${formatFactor(row.composite)},${formatFactor(row.momentum)},${formatFactor(row.fund_flow)},${row.quality}`)
      .join('\n');
    try {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      if (LOCAL_API_TOKEN) {
        headers.set('X-AlphaScope-Local-Token', LOCAL_API_TOKEN);
      }
      const response = await fetch(`${API_BASE_URL}/api/quant/stock-pool/export`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: poolText }),
      });
      if (response.ok && response.headers.get('content-type')?.includes('text/csv')) {
        csvText = await response.text();
      }
    } catch {
      // Keep local CSV export usable when the API is unavailable.
    }
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'alphascope-stock-pool.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    setActionMessage('已导出股票池 CSV（含真实截面因子），可用于复盘或导入其他量化工具。');
  };

  const equityData = useMemo(() => {
    if (!result?.equity_curve?.length) return [];
    return result.equity_curve.map((point, index) => ({
      index: index + 1,
      date: point.date || `D${index + 1}`,
      equity: point.equity ?? point.value ?? 0,
    }));
  }, [result]);

  const perf = result?.metrics;
  const sortedPoolRows = useMemo(
    () => [...poolRows].sort((a, b) => (b.composite ?? -Infinity) - (a.composite ?? -Infinity)),
    [poolRows],
  );

  const stockOptions = useMemo(
    () => [persistedStock, ...STOCK_UNIVERSE].filter((stock, index, list) => (
      list.findIndex((item) => item.symbol === stock.symbol) === index
    )),
    [persistedStock],
  );

  const agentAccuracyEntries = Object.entries(agentAccuracy?.agents || {});

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex h-full max-w-[1600px] flex-col p-6 lg:p-10"
    >
      <div className="relative z-10 mb-8 flex shrink-0 flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-3xl font-display font-medium text-white">
            <Cpu className="h-8 w-8 text-indigo-500" />
            量化策略引擎
            <span className="flex items-center gap-1.5 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 align-middle font-mono text-[11px] tracking-widest text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
              真实回测
            </span>
          </h2>
          <p className="mt-2 text-sm font-mono tracking-wide text-neutral-400">调用后端 BacktestEngine 运行策略、股票池真实因子筛查与决策后验</p>
        </div>

        <div className="flex rounded-xl border border-white/5 bg-black/60 p-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                data-testid={`backtest-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn('relative flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all', activeTab === tab.id ? 'text-white' : 'text-neutral-500 hover:text-neutral-300')}
              >
                {activeTab === tab.id && (
                  <motion.div layoutId="backtest-tab" className="absolute inset-0 rounded-lg border border-white/10 bg-white/10" />
                )}
                <Icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
        <div className="mb-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-2 text-[11px] leading-relaxed text-rose-200/80">
          <ShieldAlert className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
          本页所有回测结果<strong className="font-medium text-rose-100"> 仅用于历史研究与策略逻辑验证，不代表未来收益，不构成任何投资建议</strong>。回测已计入佣金、印花税（卖方）、滑点等真实摩擦成本，详见下方「本次回测假设」。
        </div>
        <div className="mb-5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-xs text-indigo-100/80">
          {actionMessage}
        </div>
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="mb-6 flex flex-wrap items-end gap-3">
                <div className="rounded-xl border border-white/5 bg-black/40 px-4 py-2.5">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">回测标的</p>
                  <select
                    value={selectedSymbol}
                    onChange={(e) => {
                      const stock = stockOptions.find((item) => item.symbol === e.target.value);
                      if (stock) {
                        setSelectedSymbol(stock.symbol);
                        setSelectedStockName(stock.name);
                      }
                    }}
                    className="mt-1 bg-transparent text-sm text-indigo-300 outline-none"
                  >
                    {stockOptions.map((stock) => (
                      <option key={stock.symbol} value={stock.symbol} className="bg-[#0f0f15] text-neutral-200">
                        {stock.name} ({stock.symbol})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/40 px-4 py-2.5">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">策略</p>
                  <select
                    value={selectedStrategy}
                    onChange={(e) => setSelectedStrategy(e.target.value)}
                    className="mt-1 max-w-[180px] bg-transparent text-sm text-emerald-300 outline-none"
                  >
                    {strategies.length === 0 && <option value="">{strategiesAsync.loading ? '加载策略...' : '暂无策略'}</option>}
                    {strategies.map((strategy) => (
                      <option key={strategy.id || strategy.name} value={strategy.id || strategy.name} className="bg-[#0f0f15] text-neutral-200">
                        {strategy.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/40 px-4 py-2.5">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">回测天数</p>
                  <input
                    type="number"
                    min={30}
                    max={1000}
                    value={days}
                    onChange={(e) => setDays(Math.max(30, Math.min(1000, Number(e.target.value) || 120)))}
                    className="mt-1 w-20 bg-transparent text-sm text-neutral-200 outline-none"
                  />
                </div>
                <div className="rounded-xl border border-white/5 bg-black/40 px-4 py-2.5">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">初始资金</p>
                  <input
                    type="number"
                    min={10000}
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(Math.max(10000, Number(e.target.value) || 1000000))}
                    className="mt-1 w-28 bg-transparent text-sm text-neutral-200 outline-none"
                  />
                </div>
                <button
                  onClick={runTest}
                  disabled={running || !selectedStrategy}
                  className="flex items-center gap-2 rounded-lg border border-indigo-500/50 bg-indigo-600 px-8 py-2.5 text-xs font-medium text-white shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all hover:bg-indigo-500 disabled:opacity-50"
                >
                  {running ? <Activity className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                  {running ? '引擎计算中...' : '启动真实回测'}
                </button>
              </div>

              {runError && (
                <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                  回测失败：{runError}（请确认该标的有足够行情数据，至少 30 条）
                </div>
              )}

              <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-4">
                <MetricCard label="累计收益" value={perf ? formatPercent(perf.total_return) : '--'} hint={perf ? `年化 ${formatPercent(perf.annual_return)}` : '运行回测后显示'} icon={TrendingUp} tone="rose" />
                <MetricCard label="最大回撤" value={perf ? formatPercent(perf.max_drawdown) : '--'} hint={perf ? `Calmar ${formatFactor(perf.calmar_ratio)}` : '运行回测后显示'} icon={ShieldAlert} tone="emerald" />
                <MetricCard label="胜率" value={perf ? `${formatFactor(perf.win_rate)}%` : '--'} hint={perf ? `共 ${perf.trade_count ?? 0} 笔交易` : '运行回测后显示'} icon={Flag} tone="indigo" />
                <MetricCard label="夏普比率" value={perf ? formatFactor(perf.sharpe_ratio) : '--'} hint={perf ? `Sortino ${formatFactor(perf.sortino_ratio)}` : '运行回测后显示'} icon={BarChart} />
              </div>

              {perf?.has_benchmark && (
                <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-4">
                  <MetricCard
                    label={`超额收益(${perf.benchmark_name || '基准'})`}
                    value={formatPercent(perf.excess_return)}
                    hint="策略总收益 − 基准总收益"
                    icon={TrendingUp}
                    tone={Number(perf.excess_return) >= 0 ? 'rose' : 'emerald'}
                  />
                  <MetricCard
                    label="信息比率"
                    value={formatFactor(perf.information_ratio)}
                    hint="年化超额 / 跟踪误差"
                    icon={BarChart}
                  />
                  <MetricCard label="Beta" value={formatFactor(perf.beta)} hint="相对基准的波动敏感度" icon={Activity} />
                  <MetricCard label="Alpha" value={formatFactor(perf.alpha)} hint="Jensen's alpha(年化)" icon={CheckCircle2} tone="indigo" />
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-6 shadow-xl xl:col-span-2">
                  <h3 className="mb-6 border-b border-white/5 pb-3 text-xs font-mono uppercase tracking-widest text-neutral-400">
                    净值曲线 {result ? `· ${result.strategy_id} / ${result.symbol}${result.summary?.data_source_label ? ' · ' + result.summary.data_source_label : ''}` : '· 待运行'}
                  </h3>
                  <div className="h-80 w-full">
                    {equityData.length ? (
                      <StableChartContainer>
                        <LineChart data={equityData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="date" stroke="#737373" fontSize={11} tickLine={false} />
                          <YAxis stroke="#737373" fontSize={11} tickFormatter={(val) => `${(Number(val) / 1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.82)', borderColor: 'rgba(255,255,255,0.12)', borderRadius: '12px', fontSize: '12px' }} />
                          <ReferenceLine y={initialCapital} stroke="#737373" strokeDasharray="4 4" />
                          <Line type="monotone" dataKey="equity" name="策略净值" stroke="#f43f5e" strokeWidth={2.5} dot={false} animationDuration={800} animationEasing="ease-out" />
                        </LineChart>
                      </StableChartContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-neutral-500">选择标的与策略后点击「启动真实回测」生成净值曲线</div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-5 shadow-xl">
                  <h3 className="mb-4 text-xs font-mono uppercase tracking-widest text-neutral-400">风控违规</h3>
                  {result?.risk_violations?.length ? (
                    result.risk_violations.map((viol, index) => (
                      <div key={index} className="mb-3 rounded-xl border border-rose-500/15 bg-rose-500/5 p-4">
                        <div className="mb-1 flex items-center gap-2 text-sm font-medium text-rose-200">
                          <ShieldAlert className="h-4 w-4" />
                          {viol.rule || `违规 ${index + 1}`}
                        </div>
                        <p className="text-xs leading-relaxed text-neutral-400">{viol.reason}{viol.date ? ` · ${viol.date}` : ''}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4 text-xs text-emerald-300">
                      <CheckCircle2 className="mb-1 h-4 w-4" />
                      {result ? '本次回测未触发风控违规。' : '运行回测后展示风控引擎违规记录。'}
                    </div>
                  )}
                </div>
              </div>

              {result && (
                <>
                  <div className="mb-6">
                    <AssumptionsCard assumptions={result.assumptions} />
                  </div>
                  <div>
                    <TradeTable trades={result.trades} />
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'workshop' && (
            <motion.div key="workshop" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="min-h-[500px] overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] shadow-xl">
                <div className="flex items-center justify-between border-b border-white/5 bg-black/40 p-5">
                  <h3 className="text-sm font-medium text-white">TDX 公式编译（演示）</h3>
                  <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-mono text-amber-300">客户端演示</span>
                </div>
                <div className="min-h-[430px] bg-[#050505] p-6 font-mono text-sm leading-relaxed text-neutral-300">
                  <span className="text-emerald-400">DIFF</span> := <span className="text-yellow-300">EMA</span>(CLOSE, 12) - <span className="text-yellow-300">EMA</span>(CLOSE, 26);<br /><br />
                  <span className="text-emerald-400">DEA</span> := <span className="text-yellow-300">EMA</span>(DIFF, 9);<br /><br />
                  <span className="text-emerald-400">MACD</span> := 2 * (DIFF - DEA);<br /><br />
                  <span className="text-indigo-400">ENTERLONG</span>: <span className="text-sky-400">CROSS</span>(DIFF, DEA) <span className="text-rose-400">AND</span> MACD &gt; 0;<br /><br />
                  <span className="text-indigo-400">EXITLONG</span>: <span className="text-sky-400">CROSS</span>(DEA, DIFF);
                  <div className="mt-8 rounded-xl border border-neutral-500/20 bg-neutral-500/5 p-4 font-sans text-xs leading-relaxed text-neutral-400">
                    后端 tdx_compile 能力未启用，此处仅作公式语法演示。可改用下方内置策略直接回测。
                  </div>
                </div>
              </div>

              <div className="min-h-[500px] rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white">内置策略管理器</h3>
                  <button onClick={() => strategiesAsync.refresh()} className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
                    {strategiesAsync.loading ? '加载中...' : '刷新'}
                  </button>
                </div>
                {strategiesAsync.error && (
                  <p className="mb-3 text-xs text-rose-300">策略加载失败：{strategiesAsync.error}</p>
                )}
                {strategies.map((strategy) => (
                  <div
                    key={strategy.id || strategy.name}
                    onClick={() => setSelectedStrategy(strategy.id || strategy.name)}
                    className={cn(
                      'mb-3 flex cursor-pointer items-start justify-between rounded-xl border p-4 transition-colors',
                      selectedStrategy === strategy.name ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-white/5 bg-black/25 hover:border-white/15',
                    )}
                  >
                    <div>
                      <h4 className="text-sm font-medium text-neutral-200">{strategy.name}</h4>
                      <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{strategy.description || '内置量化策略'}</p>
                    </div>
                    <span className={cn('rounded-lg border px-2.5 py-1 text-xs', selectedStrategy === strategy.name ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'border-white/10 bg-black/30 text-neutral-500')}>
                      {selectedStrategy === strategy.name ? '已选用' : '可选'}
                    </span>
                  </div>
                ))}
                {strategies.length === 0 && !strategiesAsync.loading && (
                  <p className="text-xs text-neutral-500">暂无可用策略，请确认后端 /api/quant/strategies 可用。</p>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'pool' && (
            <motion.div key="pool" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">股票池解析</h3>
                    <p className="mt-1 text-xs text-neutral-500">支持粘贴 BLK / CSV / 代码列表，自动识别 A 股标的。</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".txt,.csv,.blk" onChange={handlePoolImport} className="hidden" />
                  <button data-testid="backtest-import-pool" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-neutral-300 hover:bg-white/[0.06]">
                    <Upload className="h-4 w-4" />
                    导入文件
                  </button>
                </div>
                <textarea
                  value={poolText}
                  onChange={(event) => setPoolText(event.target.value)}
                  className="h-64 w-full resize-none rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-xs leading-relaxed text-neutral-200 outline-none focus:border-indigo-500/50"
                />
                <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="rounded-xl bg-black/25 p-3">
                    <p className="text-[10px] text-neutral-500">识别标的</p>
                    <p className="mt-1 text-xl font-mono text-white">{poolStocks.length}</p>
                  </div>
                  <div className="rounded-xl bg-black/25 p-3">
                    <p className="text-[10px] text-neutral-500">最高综合因子</p>
                    <p className="mt-1 text-xl font-mono text-rose-400">{sortedPoolRows[0]?.composite != null ? formatFactor(sortedPoolRows[0].composite) : '--'}</p>
                  </div>
                  <div className="rounded-xl bg-black/25 p-3">
                    <p className="text-[10px] text-neutral-500">高完整度</p>
                    <p className="mt-1 text-xl font-mono text-emerald-400">{poolRows.filter((row) => row.quality >= 80).length}</p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] shadow-xl">
                <div className="flex items-center justify-between border-b border-white/5 bg-black/35 p-5">
                  <div>
                    <h3 className="text-sm font-semibold text-white">真实截面因子</h3>
                    <p className="mt-1 text-[11px] text-neutral-500">{poolSource || '逐标的调用 /api/factors 计算真实因子'}</p>
                  </div>
                  <button data-testid="backtest-export-pool" onClick={exportPool} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-neutral-300 hover:bg-white/[0.06]">
                    <Download className="h-4 w-4" />
                    导出股票池
                  </button>
                </div>
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="border-b border-white/5 bg-black/20 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                    <tr>
                      <th className="px-5 py-3">标的</th>
                      <th className="px-5 py-3">行业</th>
                      <th className="px-5 py-3 text-right">综合因子</th>
                      <th className="px-5 py-3 text-right">价格动量</th>
                      <th className="px-5 py-3 text-right">资金因子</th>
                      <th className="px-5 py-3 text-right">完整度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poolLoading && (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-xs text-neutral-500">正在计算真实截面因子...</td>
                      </tr>
                    )}
                    {!poolLoading && sortedPoolRows.map((row) => (
                      <tr key={row.stock.symbol} className="border-b border-white/5 hover:bg-white/[0.025]">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-neutral-200">{row.stock.name}</p>
                          <p className="mt-1 font-mono text-[10px] text-indigo-300">{row.stock.symbol}</p>
                        </td>
                        <td className="px-5 py-3.5 text-neutral-400">{row.stock.sector}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-rose-400">{row.error ? '--' : formatFactor(row.composite)}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-neutral-300">{row.error ? '--' : formatFactor(row.momentum)}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-neutral-300">{row.error ? '--' : formatFactor(row.fund_flow)}</td>
                        <td className={cn('px-5 py-3.5 text-right font-mono', row.quality >= 80 ? 'text-emerald-400' : 'text-amber-300')}>{row.error ? <span className="text-rose-400">失败</span> : row.quality}</td>
                      </tr>
                    ))}
                    {!poolLoading && sortedPoolRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-xs text-neutral-500">暂无识别标的，请在左侧填入股票代码。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'compare' && (
            <motion.div key="compare" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                <MetricCard label="已评估决策" value={stats ? `${stats.evaluated ?? 0}/${stats.total ?? 0}` : '--'} hint="后验验证统计" icon={CheckCircle2} tone="emerald" />
                <MetricCard label="买入准确率(5日)" value={stats?.buy_signals?.accuracy_5d != null ? `${formatFactor(stats.buy_signals.accuracy_5d)}%` : '--'} hint={stats?.buy_signals ? `${stats.buy_signals.count ?? 0} 个买入信号` : '尚无评估'} icon={TrendingUp} tone="indigo" />
                <MetricCard label="待评估" value={`${pending.length}`} hint="尚未到评估窗口的决策" icon={Activity} tone="amber" />
                <MetricCard label="参与 Agent" value={`${agentAccuracyEntries.length}`} hint="有后验准确率的 Agent 数" icon={BarChart} />
              </div>

              {compareError && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                  后验数据获取异常：{compareError}（若尚无已评估决策，属正常空状态）
                </div>
              )}

              <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] shadow-xl">
                <div className="border-b border-white/5 bg-black/35 p-5">
                  <h3 className="text-sm font-semibold text-white">待评估决策明细</h3>
                  <p className="mt-1 text-xs text-neutral-500">来自 /api/backtest/pending，用于跟踪信号兑现进度。</p>
                </div>
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="border-b border-white/5 bg-black/20 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                    <tr>
                      <th className="px-5 py-3">决策 ID</th>
                      <th className="px-5 py-3">标的</th>
                      <th className="px-5 py-3">信号</th>
                      <th className="px-5 py-3 text-right">价格</th>
                      <th className="px-5 py-3 text-right">已过天数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareLoading && (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-xs text-neutral-500">正在同步后验数据...</td></tr>
                    )}
                    {!compareLoading && pending.map((item) => (
                      <tr key={item.decision_id} className="border-b border-white/5 hover:bg-white/[0.025]">
                        <td className="px-5 py-3.5 font-mono text-neutral-500">{item.decision_id}</td>
                        <td className="px-5 py-3.5 font-mono text-indigo-300">{item.symbol}</td>
                        <td className="px-5 py-3.5 text-neutral-300">{item.signal}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-neutral-200">{item.price ?? '--'}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-neutral-400">{item.days_elapsed != null ? `${item.days_elapsed.toFixed(1)}` : '--'}</td>
                      </tr>
                    ))}
                    {!compareLoading && pending.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-xs text-neutral-500">暂无待评估决策。运行分析并积累决策后会出现后验记录。</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
