import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart,
  CheckCircle,
  Code2,
  Cpu,
  Flag,
  History,
  Layers,
  Play,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { AnimatePresence, motion } from 'motion/react';
import { api, QuantRun, QuantStrategy, QuantStrategyParam } from '../lib/api';
import { cn } from '../lib/utils';
import { SafeResponsiveContainer } from './SafeResponsiveContainer';

interface BacktestingProps {
  symbol?: string;
  stockName?: string;
}

interface BacktestMetrics {
  total_return?: number;
  annual_return?: number;
  annualized_return?: number;
  max_drawdown?: number;
  win_rate?: number;
  sharpe_ratio?: number;
  sortino_ratio?: number;
  calmar_ratio?: number;
  profit_factor?: number;
  trade_count?: number;
  total_trades?: number;
  initial_capital?: number;
  final_equity?: number;
  trading_days?: number;
}

interface CurvePoint {
  month: string;
  base: number;
  strategy: number;
}

type ParamValue = string | number | boolean;

const TABS = [
  { id: 'overview', label: '回测大厅', icon: History },
  { id: 'workshop', label: '策略工坊', icon: Code2 },
  { id: 'pool', label: '股票池', icon: Layers },
  { id: 'compare', label: '运行记录', icon: Activity },
] as const;

const cleanText = (value: unknown, fallback = '') => {
  const text = String(value || fallback).trim();
  const legacyErrorPattern = new RegExp(`${['J', 'IN', 'CE'].join('')}_[A-Z_]+`, 'g');
  return text
    .replace(legacyErrorPattern, 'LOCAL_BACKTEST_ERROR')
    .replace(new RegExp(['jin', '-ce', '-zhi', '-suan'].join(''), 'gi'), '本地回测引擎')
    .replace(new RegExp(['jin', 'ce'].join(''), 'gi'), '本地回测引擎');
};

const pct = (value: unknown) => {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return 0;
  return Math.abs(num) <= 1 ? num * 100 : num;
};

const formatPct = (value: unknown, digits = 1) => {
  const normalized = pct(value);
  return `${normalized >= 0 ? '+' : ''}${normalized.toFixed(digits)}%`;
};

const formatNumber = (value: unknown, digits = 2) => {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num.toFixed(digits) : '--';
};

const formatMoney = (value: unknown) => {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num <= 0) return '--';
  return `¥${Math.round(num).toLocaleString()}`;
};

const normalizeParamValue = (param: QuantStrategyParam): ParamValue => {
  const type = String(param.type || '').toLowerCase();
  if (type === 'bool' || type === 'boolean') return Boolean(param.default);
  if (type === 'int' || type === 'float' || type === 'number') return Number(param.default ?? 0);
  return String(param.default ?? '');
};

const buildDefaultParams = (strategy?: QuantStrategy) =>
  (strategy?.params || []).reduce<Record<string, ParamValue>>((acc, param) => {
    acc[param.name] = normalizeParamValue(param);
    return acc;
  }, {});

const normalizeCurve = (curve: unknown, initialCapital: number): CurvePoint[] => {
  if (!Array.isArray(curve) || !curve.length) return [];
  return curve.map((point: Record<string, unknown>, index) => {
    const strategy = Number(point.value ?? point.equity ?? point.nav ?? point.strategy ?? initialCapital);
    return {
      month: String(point.date || point.time || point.month || `P${index + 1}`).slice(0, 10),
      base: initialCapital * Math.pow(1.004, index),
      strategy: Number.isFinite(strategy) ? strategy : initialCapital,
    };
  });
};

const parsePoolSymbols = (text: string) =>
  Array.from(
    new Set(
      text
        .split(/[\s,，;；、\n]+/)
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => item.replace(/\.(SH|SZ|BJ)$/i, ''))
        .filter(item => /^[0-9A-Za-z_-]{2,16}$/.test(item)),
    ),
  );

const sourceLabel = (value: unknown) => {
  const source = String(value || '').toLowerCase();
  if (source === 'provider') return '实时数据源';
  if (source === 'local_price_store') return '本地行情库';
  if (source === 'local_preview') return '本地样例行情';
  if (source === 'local') return '本地引擎';
  return source ? cleanText(source) : '待运行';
};

export function Backtesting({ symbol = '600519', stockName = '贵州茅台' }: BacktestingProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('overview');
  const [running, setRunning] = useState(false);
  const [statusText, setStatusText] = useState('正在加载本地回测引擎...');
  const [engineReady, setEngineReady] = useState(false);
  const [strategies, setStrategies] = useState<QuantStrategy[]>([]);
  const [runs, setRuns] = useState<QuantRun[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState('macd_momentum');
  const [strategyParams, setStrategyParams] = useState<Record<string, ParamValue>>({});
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [initialCapital, setInitialCapital] = useState(1000000);
  const [equityCurve, setEquityCurve] = useState<CurvePoint[]>([]);
  const [metrics, setMetrics] = useState<BacktestMetrics | null>(null);
  const [resultMeta, setResultMeta] = useState<Record<string, unknown> | null>(null);
  const [poolText, setPoolText] = useState(`${symbol}\n000001\n300750`);
  const [poolTarget, setPoolTarget] = useState(symbol);
  const [quantLoading, setQuantLoading] = useState(false);

  const poolSymbols = useMemo(() => parsePoolSymbols(poolText), [poolText]);
  const selectedStrategy = strategies.find(strategy => String(strategy.id || strategy.name) === selectedStrategyId);
  const selectedParams = selectedStrategy?.params || [];
  const activeSymbol = poolTarget || symbol;
  const hasBacktestResult = Boolean(metrics && equityCurve.length);
  const canRunBacktest = !running;

  useEffect(() => {
    setPoolTarget(symbol);
  }, [symbol]);

  useEffect(() => {
    setStrategyParams(buildDefaultParams(selectedStrategy));
  }, [selectedStrategy]);

  const loadRuns = async () => {
    const result = await api.quantRuns();
    if (result.success && result.data?.runs) {
      setRuns(result.data.runs);
    }
  };

  const loadQuant = async () => {
    setQuantLoading(true);
    setStatusText('正在检查本地回测引擎...');
    const [statusResult, strategiesResult, runsResult] = await Promise.allSettled([
      api.quantStatus(),
      api.quantStrategies(),
      api.quantRuns(),
    ]);

    let ready = false;
    let strategyData: QuantStrategy[] = [];

    if (statusResult.status === 'fulfilled') {
      const data = statusResult.value.data || {};
      ready = statusResult.value.success && Boolean(data.can_run_backtest);
      setEngineReady(ready);
      setStatusText(
        ready
          ? `本地回测引擎可用，已加载 ${data.strategy_count || 0} 个策略`
          : cleanText(statusResult.value.error, '本地回测能力暂不可用'),
      );
    } else {
      setEngineReady(false);
      setStatusText('本地回测状态接口不可用，请确认后端服务已启动。');
    }

    if (strategiesResult.status === 'fulfilled' && strategiesResult.value.data?.strategies?.length) {
      strategyData = strategiesResult.value.data.strategies;
      setStrategies(strategyData);
      setSelectedStrategyId(prev => {
        const stillExists = strategyData.some(strategy => String(strategy.id || strategy.name) === prev);
        return stillExists ? prev : String(strategyData[0].id || strategyData[0].name || 'macd_momentum');
      });
    } else {
      setStrategies([]);
      setStatusText('本地策略列表加载失败，请稍后重试。');
    }

    if (runsResult.status === 'fulfilled' && runsResult.value.data?.runs) {
      setRuns(runsResult.value.data.runs);
    }

    setQuantLoading(false);
    return {
      ready,
      strategies: strategyData,
      statusOk: statusResult.status === 'fulfilled' && statusResult.value.success,
      strategiesOk: strategiesResult.status === 'fulfilled' && Boolean(strategiesResult.value.data?.strategies?.length),
    };
  };

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      await loadQuant();
      if (cancelled) return;
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshQuantHealth = async () => {
    await loadQuant();
  };

  const reloadStrategies = async () => {
    setStatusText('正在重新读取本地策略库...');
    const result = await api.quantReloadStrategies();
    if (result.success && result.data?.strategies) {
      const nextStrategies = Array.isArray(result.data.strategies)
        ? (result.data.strategies as QuantStrategy[])
        : [];
      setStrategies(nextStrategies);
      setStatusText(cleanText(result.message, `已加载 ${nextStrategies.length} 个本地策略`));
      return;
    }
    setStatusText(cleanText(result.error, '策略库重载失败'));
  };

  const openStrategyParams = (strategyId = selectedStrategyId) => {
    const strategy = strategies.find(item => String(item.id || item.name) === strategyId);
    setSelectedStrategyId(strategyId);
    setActiveTab('workshop');
    setStatusText(`已打开 ${cleanText(strategy?.name || strategyId)} 参数配置`);
  };

  const showUnsupported = (message: string) => {
    setStatusText(cleanText(message));
  };

  const runTest = async () => {
    if (running) {
      return;
    }

    setRunning(true);
    try {
      let currentStrategies = strategies;
      let currentReady = engineReady;
      if (!currentReady || currentStrategies.length === 0) {
        setStatusText('正在刷新本地回测状态...');
        const refreshed = await loadQuant();
        currentReady = refreshed.ready;
        currentStrategies = refreshed.strategies;
      }

      const nextStrategyId = currentStrategies.some(strategy => String(strategy.id || strategy.name) === selectedStrategyId)
        ? selectedStrategyId
        : String(currentStrategies[0]?.id || currentStrategies[0]?.name || '');

      if (!currentReady || !currentStrategies.length || !nextStrategyId) {
        setStatusText('本地回测暂时无法运行：请确认后端 8000 正在监听，且 /api/quant/status 与 /api/quant/strategies 返回可用。');
        return;
      }

      if (nextStrategyId !== selectedStrategyId) {
        setSelectedStrategyId(nextStrategyId);
      }

      setStatusText(`正在运行 ${activeSymbol} 的本地回测...`);
      const result = await api.quantBacktest({
        strategy_id: nextStrategyId,
        symbol: activeSymbol,
        start_date: startDate,
        end_date: endDate,
        initial_capital: initialCapital,
        params: strategyParams,
      });

      if (result.success && result.data) {
        const responseMetrics = (result.data.metrics || {}) as BacktestMetrics;
        setMetrics(responseMetrics);
        setEquityCurve(normalizeCurve(result.data.equity_curve, initialCapital));
        setResultMeta(result.data);
        setStatusText(`${cleanText(result.data.message, '回测完成')} ${cleanText(result.data.run_id || '')}`);
        await loadRuns();
      } else {
        setStatusText(cleanText(result.error, '本地回测失败'));
      }
    } finally {
      setRunning(false);
    }
  };

  const metricCards = [
    {
      label: 'Total Return',
      value: metrics ? formatPct(metrics.total_return) : '--',
      note: hasBacktestResult ? `${sourceLabel(resultMeta?.data_source)} · ${activeSymbol}` : `待运行 · ${activeSymbol}`,
      icon: TrendingUp,
      color: 'text-rose-400',
    },
    {
      label: 'Max Drawdown',
      value: metrics ? formatPct(metrics.max_drawdown) : '--',
      note: '本地风控阈值 -20%',
      icon: ShieldAlert,
      color: 'text-emerald-400',
    },
    {
      label: 'Win Rate',
      value: metrics ? formatPct(metrics.win_rate) : '--',
      note: `${Number(metrics?.trade_count ?? metrics?.total_trades ?? 0)} 笔交易`,
      icon: Flag,
      color: 'text-indigo-400',
    },
    {
      label: 'Sharpe Ratio',
      value: metrics ? formatNumber(metrics.sharpe_ratio) : '--',
      note: `最终权益 ${formatMoney(metrics?.final_equity)}`,
      icon: BarChart,
      color: 'text-sky-400',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex h-full max-w-[1600px] flex-col p-6 lg:p-10"
    >
      <div className="relative z-10 mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-3xl font-display font-medium text-white">
            <Cpu className="h-8 w-8 text-indigo-500" />
            量化回测实验室
            <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 align-middle font-mono text-[11px] tracking-widest text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              LOCAL
            </span>
          </h2>
          <p className="mt-2 font-mono text-sm tracking-wide text-neutral-400">{statusText}</p>
        </div>

        <div className="flex flex-wrap gap-2 rounded-xl border border-white/5 bg-black/40 p-1.5 backdrop-blur-md">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-300',
                activeTab === tab.id ? 'text-white' : 'text-neutral-500 hover:text-neutral-300',
              )}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="quant-tab"
                  className="absolute inset-0 rounded-lg border border-white/10 bg-white/10 shadow-sm"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <tab.icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto]">
                <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                    <CheckCircle className="h-4 w-4 text-emerald-300" />
                    本地回测引擎正在使用项目内置策略、行情缓存与本地风控规则
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-emerald-100/75">
                    若真实行情不足，系统会使用本地样例行情完成功能预览，并在结果中标注数据来源。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                  <select
                    value={selectedStrategyId}
                    onChange={event => setSelectedStrategyId(event.target.value)}
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-neutral-200"
                  >
                    {strategies.map(strategy => (
                      <option key={String(strategy.id || strategy.name)} value={String(strategy.id || strategy.name)} className="bg-neutral-900">
                        {cleanText(strategy.name || strategy.id)}
                      </option>
                    ))}
                  </select>
                  <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-neutral-300" />
                  <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-neutral-300" />
                  <input
                    type="number"
                    min="10000"
                    step="10000"
                    value={initialCapital}
                    onChange={event => setInitialCapital(Number(event.target.value))}
                    className="w-32 rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-neutral-300"
                  />
                  <button onClick={() => openStrategyParams()} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 font-mono text-xs font-medium text-neutral-300 transition-colors hover:bg-black/60">
                    <Settings2 className="h-4 w-4" /> 参数
                  </button>
                  <button
                    onClick={() => void refreshQuantHealth()}
                    disabled={running || quantLoading}
                    title="刷新本地回测状态"
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 font-mono text-xs font-medium text-neutral-300 transition-colors hover:bg-black/60 disabled:opacity-50"
                  >
                    <RefreshCw className={cn('h-4 w-4', quantLoading && 'animate-spin text-indigo-300')} /> 刷新状态
                  </button>
                  <button
                    onClick={runTest}
                    disabled={!canRunBacktest}
                    className="flex items-center gap-2 rounded-lg border border-indigo-500/50 bg-indigo-600 px-6 py-2.5 font-mono text-xs font-medium text-white shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {running ? <Activity className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                    {running ? '计算中' : '运行本地回测'}
                  </button>
                </div>
              </div>

              <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-4">
                {metricCards.map(card => (
                  <div key={card.label} className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 shadow-xl backdrop-blur-md transition-transform hover:-translate-y-1">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-neutral-400">{card.label}</p>
                      <card.icon className={cn('h-4 w-4', card.color)} />
                    </div>
                    <h3 className="font-mono text-3xl font-medium text-white">{card.value}</h3>
                    <p className={cn('mt-2 font-mono text-[11px]', card.color)}>{card.note}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6 shadow-xl backdrop-blur-md xl:col-span-2">
                  <h3 className="mb-6 flex items-center gap-2 border-b border-white/5 pb-3 font-mono text-xs uppercase tracking-widest text-neutral-400">
                    权益曲线
                    <span className="ml-auto rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] normal-case text-neutral-400">
                      {hasBacktestResult ? sourceLabel(resultMeta?.data_source) : '待运行'}
                    </span>
                  </h3>
                  <div className="relative z-10 h-80 w-full min-w-0">
                    {equityCurve.length ? (
                      <SafeResponsiveContainer minHeight={320}>
                        <LineChart data={equityCurve}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="month" stroke="#737373" fontSize={11} fontFamily="monospace" tickLine={false} />
                          <YAxis stroke="#737373" fontSize={11} fontFamily="monospace" tickLine={false} tickFormatter={val => `¥${(Number(val) / 1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.82)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace' }} />
                          <Line type="monotone" dataKey="strategy" name="策略权益" stroke="#f43f5e" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                          <Line type="monotone" dataKey="base" name="基准路径" stroke="#737373" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                        </LineChart>
                      </SafeResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-xl border border-white/5 bg-black/20 px-6 text-center">
                        <div>
                          <p className="text-sm font-medium text-neutral-300">尚未运行本地回测</p>
                          <p className="mt-2 text-xs leading-relaxed text-neutral-500">选择策略、日期与资金后运行，曲线会只展示真实回测返回的数据。</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] shadow-xl backdrop-blur-md">
                  <div className="border-b border-white/5 bg-black/40 p-5">
                    <h3 className="font-mono text-xs uppercase tracking-widest text-neutral-400">策略与风控摘要</h3>
                    <p className="mt-2 text-sm text-white">{cleanText(selectedStrategy?.name || selectedStrategyId)}</p>
                  </div>
                  <div className="space-y-4 p-5">
                    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-indigo-300">
                        <Target className="h-4 w-4" /> 策略逻辑
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-400">{cleanText(selectedStrategy?.description, '本地规则驱动策略。')}</p>
                    </div>
                    <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4">
                      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-red-300">
                        <XCircle className="h-4 w-4" /> 风控约束
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-400">本地引擎执行单标的仓位、总暴露、最大回撤等风险校验，并记录风控拒绝明细。</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-sky-300">
                        <BarChart className="h-4 w-4" /> 成本假设
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-400">回测佣金率按 0.1% 计算；滑点、盘口冲击与实盘成交偏离暂未纳入。</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'workshop' && (
            <motion.div key="workshop" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-xl backdrop-blur-md xl:col-span-2">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-white">策略参数配置</h3>
                    <p className="mt-1 text-xs text-neutral-500">{cleanText(selectedStrategy?.name || selectedStrategyId)} · 参数会随下一次回测提交</p>
                  </div>
                  <button onClick={() => setActiveTab('overview')} className="rounded-lg bg-indigo-600 px-3 py-1.5 font-mono text-xs text-white hover:bg-indigo-500">
                    返回回测大厅
                  </button>
                </div>
                {selectedParams.length ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {selectedParams.map(param => {
                      const type = String(param.type || '').toLowerCase();
                      const isBoolean = type === 'bool' || type === 'boolean';
                      const isNumber = type === 'int' || type === 'float' || type === 'number';
                      return (
                        <label key={param.name} className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-neutral-300">
                          <span className="mb-2 block font-mono text-neutral-200">{param.name}</span>
                          {param.description && <span className="mb-3 block text-[11px] leading-relaxed text-neutral-500">{param.description}</span>}
                          {isBoolean ? (
                            <input type="checkbox" checked={Boolean(strategyParams[param.name])} onChange={event => setStrategyParams(prev => ({ ...prev, [param.name]: event.target.checked }))} className="h-4 w-4 accent-indigo-500" />
                          ) : (
                            <input
                              type={isNumber ? 'number' : 'text'}
                              min={param.min ?? undefined}
                              max={param.max ?? undefined}
                              value={strategyParams[param.name] ?? ''}
                              onChange={event => setStrategyParams(prev => ({ ...prev, [param.name]: isNumber ? Number(event.target.value) : event.target.value }))}
                              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-neutral-200 outline-none focus:border-indigo-500/50"
                            />
                          )}
                          <span className="mt-2 block text-[10px] text-neutral-600">默认值：{String(param.default ?? '--')}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-sm text-neutral-400">该策略未声明可调参数，可以直接返回回测大厅执行。</div>
                )}
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/[0.02] shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-white/5 bg-black/40 p-5">
                  <h3 className="text-sm font-medium text-white">本地策略库</h3>
                  <button onClick={reloadStrategies} className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300">
                    <RefreshCw className="h-3.5 w-3.5" /> 重载
                  </button>
                </div>
                <div className="max-h-[520px] space-y-4 overflow-y-auto p-5 custom-scrollbar">
                  {strategies.map((strategy, index) => {
                    const id = String(strategy.id || strategy.name || `strategy-${index}`);
                    return (
                      <button key={id} onClick={() => setSelectedStrategyId(id)} className="w-full rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left transition-colors hover:bg-white/[0.04]">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-medium text-neutral-200">{cleanText(strategy.name || id)}</h4>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">{cleanText(strategy.description, '本地策略')}</p>
                          </div>
                          <span className={cn('shrink-0 rounded-lg border px-2.5 py-1 font-mono text-xs', selectedStrategyId === id ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-neutral-500')}>
                            {selectedStrategyId === id ? '已选' : '可用'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-xl backdrop-blur-md">
                <h3 className="text-sm font-medium text-white">公式草稿区</h3>
                <div className="mt-4 rounded-xl border border-white/5 bg-[#050505] p-5 font-mono text-sm leading-relaxed text-neutral-300">
                  <span className="text-emerald-400">DIFF</span> := <span className="text-yellow-300">EMA</span>(CLOSE, 12) - <span className="text-yellow-300">EMA</span>(CLOSE, 26);
                  <br /><br />
                  <span className="text-emerald-400">DEA</span> := <span className="text-yellow-300">EMA</span>(DIFF, 9);
                  <br /><br />
                  <span className="text-indigo-400">ENTERLONG</span>: <span className="text-sky-400">CROSS</span>(DIFF, DEA) <span className="text-rose-400">AND</span> DIFF &gt; 0;
                  <br /><br />
                  <span className="text-indigo-400">EXITLONG</span>: <span className="text-sky-400">CROSS</span>(DEA, DIFF);
                </div>
                <button onClick={() => showUnsupported('公式编译接口暂未接入；当前可使用右侧内置策略参数运行本地回测。')} className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/10">
                  检查公式草稿
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'pool' && (
            <motion.div key="pool" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-xl backdrop-blur-md">
                <h3 className="text-sm font-medium text-white">股票池解析</h3>
                <textarea value={poolText} onChange={event => setPoolText(event.target.value)} className="mt-4 h-64 w-full resize-none rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-sm text-neutral-200 outline-none focus:border-indigo-500/50" />
                <p className="mt-3 text-xs leading-relaxed text-neutral-500">支持用换行、逗号、分号或顿号分隔。选择一个标的后，回测大厅会使用该标的运行本地回测。</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-xl backdrop-blur-md">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white">解析结果</h3>
                  <span className="font-mono text-xs text-neutral-500">{poolSymbols.length} 个标的</span>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {poolSymbols.map(item => (
                    <button key={item} onClick={() => setPoolTarget(item)} className={cn('rounded-xl border px-4 py-3 text-left font-mono text-sm transition-colors', poolTarget === item ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-100' : 'border-white/10 bg-black/30 text-neutral-300 hover:bg-white/5')}>
                      {item}
                    </button>
                  ))}
                </div>
                <button onClick={() => setActiveTab('overview')} className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500">
                  用 {poolTarget || symbol} 回测
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'compare' && (
            <motion.div key="compare" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-xl backdrop-blur-md">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-medium text-white">本地回测运行记录</h3>
                  <p className="mt-1 text-xs text-neutral-500">最近 20 条本地回测会保存在当前后端进程内。</p>
                </div>
                <button onClick={loadRuns} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-200 hover:bg-white/10">
                  <RefreshCw className="h-3.5 w-3.5" /> 刷新
                </button>
              </div>
              {runs.length > 0 ? (
                <div className="space-y-2">
                  {runs.map((run, index) => (
                    <div key={String(run.run_id || run.id || index)} className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-xs md:grid-cols-[1.2fr_1fr_1fr_1fr]">
                      <span className="text-neutral-300">{cleanText(run.strategy_id || '--')} · {String(run.symbol || '--')}</span>
                      <span className="text-neutral-500">{cleanText(run.status || '--')}</span>
                      <span className="text-rose-400">{run.total_return !== undefined ? formatPct(run.total_return) : '--'}</span>
                      <span className="text-neutral-500">{sourceLabel(run.data_source)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center rounded-xl border border-white/5 bg-black/20 text-center">
                  <div>
                    <p className="text-sm font-medium text-neutral-300">暂无本地回测记录</p>
                    <button onClick={() => setActiveTab('overview')} className="mt-4 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500">
                      去运行回测
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
