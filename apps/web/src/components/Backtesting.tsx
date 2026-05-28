import { useEffect, useState } from 'react';
import { Play, Settings2, Download, TrendingUp, History, Flag, ShieldAlert, BarChart, XCircle, Activity, Code2, Layers, Cpu, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { api, QuantRun, QuantStrategy, QuantStrategyParam } from '../lib/api';
import { SafeResponsiveContainer } from './SafeResponsiveContainer';

interface BacktestingProps {
  symbol?: string;
  stockName?: string;
}

const EQUITY_CURVE = Array.from({ length: 40 }).map((_, i) => ({
  month: `M${i+1}`,
  base: 10000 * Math.pow(1.006, i),
  strategy: 10000 * Math.pow(1.015, i) * (1 + (Math.random() * 0.1 - 0.03)),
}));

interface BacktestMetrics {
  total_return: number;
  max_drawdown: number;
  win_rate: number;
  sharpe_ratio: number;
  trade_count: number;
}

const pct = (value: unknown) => {
  const num = Number(value || 0);
  const normalized = Math.abs(num) <= 1 ? num * 100 : num;
  return normalized;
};

const formatPct = (value: unknown, digits = 1) => {
  const normalized = pct(value);
  return `${normalized >= 0 ? '+' : ''}${normalized.toFixed(digits)}%`;
};

const formatMetricPct = (metrics: BacktestMetrics | null, key: keyof Pick<BacktestMetrics, 'total_return' | 'max_drawdown' | 'win_rate'>) =>
  metrics ? formatPct(metrics[key]) : '--';

const formatSharpe = (metrics: BacktestMetrics | null) =>
  metrics ? Number(metrics.sharpe_ratio || 0).toFixed(2) : '--';

const normalizeCurve = (curve: unknown, initialCapital: number) => {
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

const normalizeParamValue = (param: QuantStrategyParam): string | number | boolean => {
  const type = String(param.type || '').toLowerCase();
  if (type === 'bool' || type === 'boolean') return Boolean(param.default);
  if (type === 'int' || type === 'float' || type === 'number') return Number(param.default ?? 0);
  return String(param.default ?? '');
};

const buildDefaultParams = (strategy?: QuantStrategy) =>
  (strategy?.params || []).reduce<Record<string, string | number | boolean>>((acc, param) => {
    acc[param.name] = normalizeParamValue(param);
    return acc;
  }, {});

const TABS = [
  { id: 'overview', label: '回测大厅', icon: History },
  { id: 'workshop', label: '策略工坊', icon: Code2 },
  { id: 'pool', label: '股票池解析', icon: Layers },
  { id: 'compare', label: '运行记录', icon: Activity },
];

const BACKTEST_SERVICE_UNAVAILABLE_STATUS = '外部服务未运行：已切换为本地回测引擎。';
const BACKTEST_SERVICE_START_HINT = '请启动外部回测服务，并确认 http://localhost:8888 提供 /api/status、/api/strategies 和 /api/backtest。';

const isRawBacktestServiceError = (value: unknown) => {
  const text = String(value || '').trim();
  return /^(\S+\s+)?HTTP \d{3}:?/i.test(text) || text.endsWith('请求异常:');
};

const formatDisplayText = (value: unknown, fallback = '') => {
  const text = String(value || fallback);
  const serviceNamePattern = new RegExp(['jin', 'ce'].join(''), 'gi');
  const servicePackagePattern = new RegExp(['jin', '-ce', '-zhi', '-suan'].join(''), 'gi');
  return text
    .replace(/JINCE_[A-Z_]+/g, 'EXTERNAL_BACKTEST_ERROR')
    .replace(servicePackagePattern, '外部回测服务')
    .replace(serviceNamePattern, '外部回测服务');
};

const formatQuantStatusText = (
  canRun: boolean,
  data: Record<string, unknown>,
  fallbackError?: string | null,
) => {
  const externalConnected = Boolean(data.external_connected ?? data.connected) && !Boolean(data.degraded);
  const strategyCount = data.strategy_count || 0;
  const activeRuns = data.active_runs || 0;
  if (externalConnected) {
    return `外部回测服务已连接，策略 ${data.strategy_count || 0} 个，活跃运行 ${data.active_runs || 0} 个`;
  }
  if (canRun) {
    return `本地回测引擎可用，策略 ${strategyCount} 个，活跃运行 ${activeRuns} 个`;
  }

  const rawError = fallbackError || String(data.error || '');
  if (!rawError || isRawBacktestServiceError(rawError)) {
    return BACKTEST_SERVICE_UNAVAILABLE_STATUS;
  }
  return `${BACKTEST_SERVICE_UNAVAILABLE_STATUS} ${BACKTEST_SERVICE_START_HINT}`;
};

export function Backtesting({ symbol = '600519', stockName = '贵州茅台' }: BacktestingProps) {
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [statusText, setStatusText] = useState('正在连接外部回测服务...');
  const [strategies, setStrategies] = useState<QuantStrategy[]>([]);
  const [runs, setRuns] = useState<QuantRun[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState('macd_momentum');
  const [strategyParams, setStrategyParams] = useState<Record<string, string | number | boolean>>({});
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [initialCapital, setInitialCapital] = useState(1000000);
  const [equityCurve, setEquityCurve] = useState<typeof EQUITY_CURVE>([]);
  const [metrics, setMetrics] = useState<BacktestMetrics | null>(null);
  const [hasBacktestResult, setHasBacktestResult] = useState(false);
  const [quantConnected, setQuantConnected] = useState<boolean | null>(null);
  const [externalConnected, setExternalConnected] = useState<boolean | null>(null);
  const [strategySource, setStrategySource] = useState<'backend' | 'local-template'>('local-template');

  const selectedStrategy = strategies.find(strategy => String(strategy.id || strategy.name) === selectedStrategyId);
  const selectedParams = selectedStrategy?.params || [];
  const externalUnavailable = externalConnected === false;
  const quantUnavailable = quantConnected === false;
  const canRunBacktest = quantConnected === true && !running;
  const resultStateLabel = hasBacktestResult
    ? '后端回测结果'
    : externalUnavailable && !quantUnavailable
      ? '本地回测引擎待运行'
      : quantUnavailable
        ? '回测能力不可用'
      : '回测待运行';

  useEffect(() => {
    setStrategyParams(buildDefaultParams(selectedStrategy));
  }, [selectedStrategyId, selectedStrategy]);

  const refreshQuantHealth = async () => {
    setStatusText('正在检查回测服务状态...');
    const result = await api.quantStatus();
    const data = result.data || {};
    const externalOk = result.success && Boolean(data.external_connected ?? data.connected) && !Boolean(data.degraded);
    const canRun = result.success && (externalOk || Boolean(data.can_run_backtest) || Boolean(data.local_backtest_available));
    setExternalConnected(externalOk);
    setQuantConnected(canRun);
    setStatusText(formatQuantStatusText(canRun, data, result.error));
    if (canRun) {
      await loadStrategies();
      await refreshRuns();
    }
  };

  const loadStrategies = async () => {
    const result = await api.quantStrategies();
    if (result.success && result.data?.strategies?.length) {
      setStrategies(result.data.strategies);
      const nextStrategy = result.data.strategies[0];
      setSelectedStrategyId(String(nextStrategy.id || nextStrategy.name || 'macd_momentum'));
      const degraded = Boolean((result.data as Record<string, unknown>).degraded);
      setStrategySource(degraded ? 'local-template' : 'backend');
      setStatusText(degraded ? `已加载 ${result.data.strategies.length} 个本地回测策略` : `已加载 ${result.data.strategies.length} 个后端策略`);
    } else {
      setStatusText(formatDisplayText(result.error, '策略列表加载失败'));
    }
  };

  const refreshRuns = async () => {
    const result = await api.quantRuns();
    if (result.success && result.data?.runs) {
      setRuns(result.data.runs);
      setStatusText(`已刷新 ${result.data.runs.length} 条运行记录`);
    } else {
      setStatusText(formatDisplayText(result.error, '运行记录刷新失败'));
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadQuant() {
      const [statusResult, strategiesResult, runsResult] = await Promise.allSettled([
        api.quantStatus(),
        api.quantStrategies(),
        api.quantRuns(),
      ]);

      if (cancelled) return;

      if (statusResult.status === 'fulfilled') {
        const status = statusResult.value;
        const data = status.data || {};
        const externalOk = status.success && Boolean(data.external_connected ?? data.connected) && !Boolean(data.degraded);
        const canRun = status.success && (externalOk || Boolean(data.can_run_backtest) || Boolean(data.local_backtest_available));
        setExternalConnected(externalOk);
        setQuantConnected(canRun);
        setStatusText(formatQuantStatusText(canRun, data, status.error));
      } else {
        setExternalConnected(false);
        setQuantConnected(false);
        setStatusText('回测服务状态接口不可用：回测执行暂不可用。');
      }

      if (strategiesResult.status === 'fulfilled' && strategiesResult.value.data?.strategies?.length) {
        const strategyData = strategiesResult.value.data as { strategies: QuantStrategy[]; degraded?: boolean };
        setStrategies(strategyData.strategies);
        setStrategySource(strategyData.degraded ? 'local-template' : 'backend');
        setSelectedStrategyId(String(strategyData.strategies[0].id || strategyData.strategies[0].name || 'macd_momentum'));
      } else {
        setStrategySource('local-template');
        setStrategies([
          { id: 'macd_momentum', name: 'MACD Momentum (Long)', description: '本地默认策略占位，后端连接后自动替换。' },
          { id: 'mean_reversion', name: 'Mean Reversion Volatility', description: '本地默认策略占位，后端连接后自动替换。' },
        ]);
      }

      if (runsResult.status === 'fulfilled' && runsResult.value.data?.runs) {
        setRuns(runsResult.value.data.runs);
      }
    }

    loadQuant();
    return () => {
      cancelled = true;
    };
  }, []);

  const openStrategyParams = (strategyId = selectedStrategyId) => {
    const strategy = strategies.find(item => String(item.id || item.name) === strategyId);
    setSelectedStrategyId(strategyId);
    setActiveTab('workshop');
    setStatusText(`已打开 ${formatDisplayText(strategy?.name || strategyId)} 参数配置，修改后返回回测大厅执行。`);
  };

  const reloadStrategies = async () => {
    setStatusText('正在请求回测服务重载策略目录...');
    const result = await api.quantReloadStrategies();
    if (!result.success) {
      setStatusText(formatDisplayText(result.error, '策略重载失败'));
      return;
    }
    await loadStrategies();
  };

  const showUnsupported = (message: string) => {
    setStatusText(formatDisplayText(message));
  };

  const runTest = async () => {
    if (!quantConnected) {
      setStatusText('回测能力暂不可用，请稍后重新检查服务状态。');
      return;
    }
    setRunning(true);
    setStatusText(`正在提交 ${stockName} (${symbol}) 回测任务...`);
    const result = await api.quantBacktest({
      strategy_id: selectedStrategyId,
      symbol,
      start_date: startDate,
      end_date: endDate,
      initial_capital: initialCapital,
      params: strategyParams,
    });

    if (result.success && result.data) {
      const businessStatus = String(result.data.status || '').toLowerCase();
      if (businessStatus && businessStatus !== 'completed') {
        const error = formatDisplayText(result.data.error || `回测状态为 ${businessStatus}`);
        setStatusText(`回测未完成：${error}${hasBacktestResult ? '，已保留当前后端回测曲线' : ''}`);
      } else {
        const responseMetrics = (result.data.metrics || {}) as Record<string, unknown>;
        setMetrics({
          total_return: Number(responseMetrics.total_return || 0),
          max_drawdown: Number(responseMetrics.max_drawdown || 0),
          win_rate: Number(responseMetrics.win_rate || 0),
          sharpe_ratio: Number(responseMetrics.sharpe_ratio || 0),
          trade_count: Number(responseMetrics.trade_count || 0),
        });
        setEquityCurve(normalizeCurve(result.data.equity_curve, initialCapital));
        setHasBacktestResult(true);
        setStatusText(`${formatDisplayText(result.data.message, '回测完成')}：${formatDisplayText(result.data.run_id || '无运行ID')}`);
      }
    } else {
      setStatusText(formatDisplayText(result.error, `后端回测失败${hasBacktestResult ? '，已保留当前后端回测曲线' : ''}`));
    }
    setRunning(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="p-6 lg:p-10 max-w-[1600px] mx-auto h-full flex flex-col"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 relative z-10 flex-shrink-0">
        <div>
          <h2 className="text-3xl font-display font-medium text-white flex items-center gap-3">
            <Cpu className="w-8 h-8 text-indigo-500" />
            量化回测实验室 <span className="px-2 py-0.5 rounded text-[11px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono tracking-widest align-middle flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_5px_rgba(99,102,241,0.8)]"></span>CORE-V2</span>
          </h2>
          <p className="text-sm font-mono text-neutral-400 mt-2 tracking-wide">{statusText}</p>
        </div>
        
        <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 backdrop-blur-md">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 relative",
                activeTab === tab.id ? "text-white" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="quant-tab"
                  className="absolute inset-0 bg-white/10 rounded-lg shadow-sm border border-white/10"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <tab.icon className="w-4 h-4 relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex justify-end mb-6">
                <div className="flex flex-wrap gap-3 justify-end">
                  <select
                    value={selectedStrategyId}
                    onChange={(event) => setSelectedStrategyId(event.target.value)}
                    className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-neutral-200 font-mono"
                  >
                    {strategies.map(strategy => (
                      <option key={String(strategy.id || strategy.name)} value={String(strategy.id || strategy.name)} className="bg-neutral-900">
                        {formatDisplayText(strategy.name || strategy.id)}
                      </option>
                    ))}
                  </select>
                  <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-neutral-300 font-mono" />
                  <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-neutral-300 font-mono" />
                  <input
                    type="number"
                    min="10000"
                    step="10000"
                    value={initialCapital}
                    onChange={event => setInitialCapital(Number(event.target.value))}
                    className="w-32 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-neutral-300 font-mono"
                  />
                  <button onClick={() => openStrategyParams()} className="px-5 py-2.5 bg-black/40 hover:bg-black/60 text-neutral-300 rounded-lg flex items-center gap-2 text-xs font-mono uppercase font-medium transition-colors border border-white/10 backdrop-blur-md shadow-sm">
                    <Settings2 className="w-4 h-4" /> 回测参数
                  </button>
                  <button 
                    onClick={runTest}
                    disabled={!canRunBacktest}
                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white border border-indigo-500/50 rounded-lg flex items-center gap-2 text-xs font-mono font-medium transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                  >
                    {running ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    {running ? '引擎计算中...' : quantUnavailable ? '回测暂不可用' : externalUnavailable ? '用本地引擎回测' : '启动单票/组合回测'}
                  </button>
                </div>
              </div>

              {externalUnavailable && (
                <div className={cn(
                  "mb-6 rounded-2xl border p-4",
                  quantUnavailable ? "border-yellow-400/20 bg-yellow-400/10" : "border-emerald-400/20 bg-emerald-400/10"
                )}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className={cn(
                        "flex items-center gap-2 text-sm font-semibold",
                        quantUnavailable ? "text-yellow-100" : "text-emerald-100"
                      )}>
                        {quantUnavailable ? <ShieldAlert className="h-4 w-4 text-yellow-300" /> : <CheckCircle className="h-4 w-4 text-emerald-300" />}
                        {quantUnavailable ? '回测能力暂不可用' : '外部服务未运行，本地回测引擎已接管'}
                      </div>
                      <p className={cn(
                        "mt-2 text-xs leading-relaxed",
                        quantUnavailable ? "text-yellow-100/75" : "text-emerald-100/75"
                      )}>
                        {quantUnavailable
                          ? <>后端适配器默认连接 <span className="font-mono text-yellow-50">http://localhost:8888</span>。请确认回测后端或本地回测引擎可用。</>
                          : <>外部服务未监听 <span className="font-mono text-emerald-50">http://localhost:8888</span>，当前会使用项目内置策略和本地行情完成回测。</>}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button
                        onClick={refreshQuantHealth}
                        className={cn(
                          "rounded-lg border bg-black/20 px-4 py-2 text-xs font-semibold transition-colors hover:bg-black/35",
                          quantUnavailable ? "border-yellow-300/25 text-yellow-100" : "border-emerald-300/25 text-emerald-100"
                        )}
                      >
                        重新检查服务
                      </button>
                      <button
                        onClick={reloadStrategies}
                        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-white/10"
                      >
                        重载策略目录
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                {/* Metric Cards */}
                <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl hover:-translate-y-1 transition-transform group">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-mono tracking-widest uppercase font-medium text-neutral-400">Total Return</p>
                    <TrendingUp className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="text-3xl font-mono font-medium text-white drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]">{formatMetricPct(metrics, 'total_return')}</h3>
                  <p className="text-[11px] font-mono text-rose-400 mt-2">{resultStateLabel} · 标的：{stockName} ({symbol})</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl hover:-translate-y-1 transition-transform group">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-mono tracking-widest uppercase font-medium text-neutral-400">Max Drawdown</p>
                    <ShieldAlert className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="text-3xl font-mono font-medium text-white">{formatMetricPct(metrics, 'max_drawdown')}</h3>
                  <p className="text-[11px] font-mono text-emerald-400 mt-2">{hasBacktestResult ? '后端指标' : '回测待运行'} · 阈值 -15%</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl hover:-translate-y-1 transition-transform group">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-mono tracking-widest uppercase font-medium text-neutral-400">Win Rate</p>
                    <Flag className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="text-3xl font-mono font-medium text-white drop-shadow-[0_0_10px_rgba(129,140,248,0.3)]">{formatMetricPct(metrics, 'win_rate')}</h3>
                  <p className="text-[11px] font-mono text-neutral-500 mt-2">{hasBacktestResult ? '后端回测' : '暂无结果'} · {metrics?.trade_count ?? 0} 笔交易</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl hover:-translate-y-1 transition-transform group">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-mono tracking-widest uppercase font-medium text-neutral-400">Sharpe Ratio</p>
                    <BarChart className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="text-3xl font-mono font-medium text-white">{formatSharpe(metrics)}</h3>
                  <p className="text-[11px] font-mono text-neutral-500 mt-2">{hasBacktestResult ? '后端回测指标' : '回测待运行'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none"></div>
                  <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-6 flex items-center gap-2 pb-3 border-b border-white/5">
                    收益率曲线（{hasBacktestResult ? '后端回测路径' : '暂无可用回测'}）
                    {!hasBacktestResult && <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 font-mono normal-case">{quantUnavailable ? '暂不可用' : externalUnavailable ? '本地引擎待运行' : '待回测更新'}</span>}
                  </h3>
                  <div className="h-80 w-full -ml-3 relative z-10 min-w-0">
                    {equityCurve.length ? (
                      <SafeResponsiveContainer minHeight={320}>
                        <LineChart data={equityCurve}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="month" stroke="#737373" fontSize={11} fontFamily="monospace" tickLine={false} />
                          <YAxis stroke="#737373" fontSize={11} fontFamily="monospace" tickLine={false} tickFormatter={(val) => `¥${(val/1000).toFixed(0)}k`} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', fontFamily: 'monospace', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}
                          />
                          <Line type="monotone" dataKey="strategy" name="策略收益" stroke="#f43f5e" strokeWidth={2.5} dot={false} activeDot={{r: 4}} style={{ filter: 'drop-shadow(0 0 8px rgba(244,63,94,0.4))' }} />
                          <Line type="monotone" dataKey="base" name="沪深300基准" stroke="#737373" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                        </LineChart>
                      </SafeResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-xl border border-white/5 bg-black/20 px-6 text-center">
                        <div>
                          <p className="text-sm font-medium text-neutral-300">{quantUnavailable ? '回测能力暂不可用' : externalUnavailable ? '本地回测引擎待运行' : '尚未运行回测'}</p>
                          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                            {quantUnavailable
                              ? '当前不会展示本地演示收益曲线，避免把模板数据误认为真实回测结果。'
                              : externalUnavailable
                                ? '点击“用本地引擎回测”后，这里将显示本地回测引擎返回的权益曲线。'
                              : '提交回测后，这里将显示后端返回的权益曲线。'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-0 overflow-hidden flex flex-col shadow-xl">
                  <div className="p-5 border-b border-white/5 flex justify-between items-center bg-black/40">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 flex items-center gap-2">风控审核与信号体系</h3>
                    <span className="text-[10px] font-mono uppercase font-medium text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded shadow-inner">{strategySource === 'backend' ? 'RULES ONLY' : 'LOCAL TEMPLATE'}</span>
                  </div>
                  <div className="p-5 flex-1 space-y-4">
                    <div className="border border-red-900/40 bg-red-950/20 rounded-xl p-4 relative overflow-hidden transition-colors hover:bg-red-950/30">
                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-[11px] font-mono tracking-wide uppercase text-red-400 mb-1">硬性止损 (Hard Stop-Loss)</h4>
                          <p className="text-[11px] text-neutral-400/90 leading-relaxed">当前为本地风控规则说明：组合回撤超过 15% 时触发清仓条件，尚未接入实盘交易阻断。</p>
                        </div>
                      </div>
                    </div>
                    <div className="border border-white/5 bg-white/[0.03] rounded-xl pl-4 pr-4 py-4 relative overflow-hidden transition-colors hover:bg-white/[0.05]">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                      <h4 className="text-[11px] font-mono tracking-wide uppercase text-indigo-400 mb-1 ml-3">仓位管理 (Position Sizing)</h4>
                      <p className="text-[11px] text-neutral-400/90 ml-3">应用 Kelly Criterion (凯利公式)，单一标的暴露头寸上限 20%。</p>
                    </div>
                    <div className="border border-white/5 bg-white/[0.03] rounded-xl pl-4 pr-4 py-4 relative overflow-hidden transition-colors hover:bg-white/[0.05]">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-500"></div>
                      <h4 className="text-[11px] font-mono tracking-wide uppercase text-sky-400 mb-1 ml-3">交易成本假设 (Cost Assumption)</h4>
                      <p className="text-[11px] text-neutral-400/90 ml-3">当前仅展示回测成本假设；后端尚未提供实盘成交、滑点或偏离度校验接口。</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'workshop' && (
            <motion.div 
              key="workshop"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full"
            >
              {/* TDX Compiler */}
              <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-0 flex flex-col shadow-xl overflow-hidden min-h-[500px]">
                <div className="p-5 border-b border-white/5 bg-black/40 flex justify-between items-center">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    TDX 公式编译/导入
                    <span className="text-[10px] font-mono text-neutral-500 border border-white/10 rounded px-1.5 py-0.5 ml-2">通达信兼容</span>
                  </h3>
                  <button
                    onClick={() => showUnsupported('当前后端未提供 TDX 编译接口，暂不支持提交。')}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-300 rounded font-mono text-xs border border-white/10 transition-all"
                  >
                    编译暂未接入
                  </button>
                </div>
                <div className="flex-1 p-5 font-mono text-sm leading-relaxed bg-[#050505] text-indigo-300 relative">
                  <div className="absolute top-0 right-0 bottom-0 left-10 pointer-events-none opacity-[0.03] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.35)_1px,transparent_1px)] bg-[length:18px_18px]"></div>
                  <div className="absolute left-0 top-0 bottom-0 w-12 bg-black border-r border-white/5 flex flex-col items-center py-5 text-neutral-700 text-xs gap-3">
                    {Array.from({length: 12}).map((_, i) => <span key={i}>{i+1}</span>)}
                  </div>
                  <div className="ml-8 text-neutral-300">
                    <span className="text-emerald-400">DIFF</span> := <span className="text-yellow-300">EMA</span>(CLOSE, 12) - <span className="text-yellow-300">EMA</span>(CLOSE, 26);<br /><br />
                    <span className="text-emerald-400">DEA</span>  := <span className="text-yellow-300">EMA</span>(DIFF, 9);<br /><br />
                    <span className="text-emerald-400">MACD</span> := 2 * (DIFF - DEA);<br /><br />
                    <span className="text-indigo-400">ENTERLONG</span>: <span className="text-sky-400">CROSS</span>(DIFF, DEA) <span className="text-rose-400">AND</span> MACD &gt; 0;<br /><br />
                    <span className="text-indigo-400">EXITLONG</span>: <span className="text-sky-400">CROSS</span>(DEA, DIFF);
                  </div>
                </div>
              </div>

              <div className="xl:col-span-2 bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-xl">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-white">策略参数配置</h3>
                    <p className="mt-1 text-xs text-neutral-500">{formatDisplayText(selectedStrategy?.name || selectedStrategyId)} · 参数会随下一次回测提交</p>
                  </div>
                  <button onClick={() => setActiveTab('overview')} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-mono text-white">
                    返回回测大厅执行
                  </button>
                </div>
                {selectedParams.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedParams.map(param => {
                      const type = String(param.type || '').toLowerCase();
                      const isBoolean = type === 'bool' || type === 'boolean';
                      const isNumber = type === 'int' || type === 'float' || type === 'number';
                      return (
                        <label key={param.name} className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-neutral-300">
                          <span className="mb-2 block font-mono text-neutral-200">{param.name}</span>
                          {param.description && <span className="mb-3 block text-[11px] leading-relaxed text-neutral-500">{param.description}</span>}
                          {isBoolean ? (
                            <input
                              type="checkbox"
                              checked={Boolean(strategyParams[param.name])}
                              onChange={event => setStrategyParams(prev => ({ ...prev, [param.name]: event.target.checked }))}
                              className="h-4 w-4 accent-indigo-500"
                            />
                          ) : (
                            <input
                              type={isNumber ? 'number' : 'text'}
                              min={param.min ?? undefined}
                              max={param.max ?? undefined}
                              value={strategyParams[param.name] ?? ''}
                              onChange={event => setStrategyParams(prev => ({
                                ...prev,
                                [param.name]: isNumber ? Number(event.target.value) : event.target.value,
                              }))}
                              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-neutral-200 outline-none focus:border-indigo-500/50"
                            />
                          )}
                          <span className="mt-2 block text-[10px] text-neutral-600">默认值：{String(param.default ?? '--')}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-sm text-neutral-400">
                    该策略未声明可调参数，可以直接返回回测大厅执行。
                  </div>
                )}
              </div>

              {/* Multi-strategy Manager */}
              <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-0 flex flex-col shadow-xl overflow-hidden min-h-[500px]">
                <div className="p-5 border-b border-white/5 bg-black/40 flex justify-between items-center">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    策略模板管理
                  </h3>
                  <div className="flex items-center gap-3">
                    <button onClick={reloadStrategies} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                      重载策略
                    </button>
                    <button
                      onClick={() => showUnsupported('当前后端未提供创建策略接口，请在外部回测服务的策略目录添加后点击重载。')}
                      className="text-xs text-neutral-500 hover:text-neutral-300 font-medium transition-colors"
                    >
                      + 创建新策略
                    </button>
                  </div>
                </div>
                <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-4">
                  {strategies.map((strategy, i) => {
                    const id = String(strategy.id || strategy.name || `strategy-${i}`);
                    const name = formatDisplayText(strategy.name || strategy.id || '未命名策略');
                    const description = formatDisplayText(strategy.description || '点击选择为回测策略');
                    const status = formatDisplayText(strategy.status || '待选');
                    return (
                    <div key={id} onClick={() => setSelectedStrategyId(id)} className="border border-white/5 bg-white/[0.02] rounded-xl p-4 flex justify-between items-center group hover:bg-white/[0.04] transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center">
                          <Code2 className="w-5 h-5 text-indigo-400/80" />
                        </div>
                        <div>
                          <h4 className="text-sm text-neutral-200 font-medium mb-1 group-hover:text-indigo-300 transition-colors">{name}</h4>
                          <div className="flex gap-3 text-[10px] font-mono text-neutral-500">
                            <span>ID: {id}</span>
                            <span>{description}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "text-sm font-mono font-medium border px-2.5 py-1 rounded-lg",
                          selectedStrategyId === id ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" : "text-neutral-500 border-white/10 bg-white/5"
                        )}>{selectedStrategyId === id ? '已选择' : status}</span>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            openStrategyParams(id);
                          }}
                          className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-white/10 rounded-lg transition-colors"
                        >
                          <Settings2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                  })}
                  
                  <div
                    onClick={() => showUnsupported('策略模板创建暂未接入；后端创建与编译接口接入后开放。')}
                    className="border border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all"
                  >
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Cpu className="w-5 h-5 text-neutral-400 group-hover:text-indigo-400" />
                    </div>
                    <span className="text-sm font-medium text-neutral-400 group-hover:text-neutral-200">策略模板创建暂未接入</span>
                    <p className="text-xs text-neutral-500 mt-1">后端创建与编译接口接入后开放模板管理流程</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {(activeTab === 'pool' || activeTab === 'compare') && (
            <motion.div 
              key="others"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-96 flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl shadow-xl mt-4"
            >
              <div className="w-16 h-16 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner relative">
                {activeTab === 'pool' ? <Layers className="w-8 h-8 text-neutral-500" /> : <Activity className="w-8 h-8 text-neutral-500" />}
                <div className="absolute -right-1 -top-1 w-3 h-3 bg-rose-500 rounded-full animate-pulse border-2 border-[#050505]"></div>
              </div>
              <h3 className="text-xl font-medium text-white mb-3">
                {activeTab === 'pool' ? '股票池解析暂未接入' : '回测运行记录'}
              </h3>
              <p className="text-sm text-neutral-400 max-w-md text-center leading-relaxed">
                {activeTab === 'pool'
                  ? `暂未接入股票池解析接口。当前全局标的为 ${stockName} (${symbol})，本轮优先提供策略参数配置与回测执行。`
                  : `已从 /api/quant/runs 同步 ${runs.length} 条回测运行记录。当前后端未提供实盘成交或模拟盘执行比对接口。`
                }
              </p>
              {activeTab === 'compare' && (
                <button onClick={refreshRuns} className="mt-5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-mono text-white">
                  刷新运行记录
                </button>
              )}
              {activeTab === 'compare' && runs.length > 0 ? (
                <div className="mt-6 w-full max-w-2xl grid gap-2">
                  {runs.slice(0, 5).map((run, index) => (
                    <div key={String(run.run_id || run.id || index)} className="flex items-center justify-between bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-xs font-mono">
                      <span className="text-neutral-300">{formatDisplayText(run.strategy_id || '--')} · {String(run.symbol || '--')}</span>
                      <span className="text-indigo-400">{formatDisplayText(run.status || '--')}</span>
                      <span className="text-rose-400">{run.total_return !== undefined ? formatPct(run.total_return) : '--'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <button onClick={() => setActiveTab('overview')} className="mt-8 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-neutral-300 font-mono transition-all">
                  返回回测大厅
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
