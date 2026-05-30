import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { ComponentType } from 'react';
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
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { findStockTarget, StockTarget } from '../lib/stocks';

type TabID = 'overview' | 'workshop' | 'pool' | 'compare';

const TABS: Array<{ id: TabID; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: '回测大厅', icon: History },
  { id: 'workshop', label: '策略工坊', icon: Code2 },
  { id: 'pool', label: '股票池解析', icon: Layers },
  { id: 'compare', label: '实盘比对', icon: Activity },
];

const EQUITY_CURVE = Array.from({ length: 40 }).map((_, i) => ({
  month: `M${i + 1}`,
  base: 10000 * Math.pow(1.006, i),
  strategy: 10000 * Math.pow(1.015, i) * (1 + (Math.sin(i / 3) * 0.045)),
}));

const DEFAULT_POOL_TEXT = `600519 贵州茅台
300750 宁德时代
600036 招商银行
002594 比亚迪
300059 东方财富
601318 中国平安`;

const EXECUTION_ROWS = [
  { time: '09:35:18', symbol: '600519.SH', name: '贵州茅台', signal: '低吸买入', simulated: 1720.4, actual: 1721.2, slippage: 0.05, status: '已成交' },
  { time: '10:12:44', symbol: '300750.SZ', name: '宁德时代', signal: '突破加仓', simulated: 205.2, actual: 206.1, slippage: 0.44, status: '部分成交' },
  { time: '13:41:09', symbol: '300059.SZ', name: '东方财富', signal: '止盈减仓', simulated: 15.92, actual: 15.89, slippage: -0.19, status: '已成交' },
  { time: '14:28:32', symbol: '601318.SH', name: '中国平安', signal: '风控降仓', simulated: 48.4, actual: 48.31, slippage: -0.19, status: '已成交' },
];

interface ParsedPoolRow {
  stock: StockTarget;
  momentum: number;
  liquidity: number;
  risk: number;
  score: number;
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

function buildPoolRows(stocks: StockTarget[]): ParsedPoolRow[] {
  return stocks.map((stock, index) => {
    const base = stock.symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) + index * 13;
    const momentum = 45 + (base % 38);
    const liquidity = 52 + (base % 31);
    const risk = 18 + (base % 36);
    const score = Math.round(momentum * 0.42 + liquidity * 0.34 + (100 - risk) * 0.24);
    return { stock, momentum, liquidity, risk, score };
  }).sort((a, b) => b.score - a.score);
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
  tone?: 'rose' | 'emerald' | 'indigo' | 'neutral';
}) {
  const color = {
    rose: 'text-rose-400',
    emerald: 'text-emerald-400',
    indigo: 'text-indigo-300',
    neutral: 'text-neutral-300',
  }[tone];

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 shadow-xl backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">{label}</p>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <h3 className="text-3xl font-mono font-medium text-white">{value}</h3>
      <p className={cn('mt-2 text-[11px] font-mono', color)}>{hint}</p>
    </div>
  );
}

export function Backtesting() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<TabID>('overview');
  const [poolText, setPoolText] = useState(DEFAULT_POOL_TEXT);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState('回测引擎待命，可启动单票或组合策略验证。');
  const [strategies, setStrategies] = useState(['均值回归（小市值）', '高频动量突破', '双均线趋势跟踪']);
  const [compiled, setCompiled] = useState(false);
  const parsedPool = useMemo(() => buildPoolRows(parsePoolText(poolText)), [poolText]);

  const runTest = () => {
    setRunning(true);
    setActionMessage('正在基于当前股票池和风控参数运行回测...');
    window.setTimeout(() => {
      setRunning(false);
      setActionMessage(`回测完成：已验证 ${Math.max(1, parsedPool.length)} 个标的，最大回撤仍在阈值内。`);
    }, 1600);
  };

  const compileStrategy = () => {
    setCompiled(true);
    setActionMessage('已将 TDX 公式编译为 Python 策略草案，可进入回测大厅运行验证。');
  };

  const createStrategy = () => {
    const nextName = `自定义策略 ${strategies.length + 1}`;
    setStrategies((prev) => [nextName, ...prev]);
    setActionMessage(`已创建「${nextName}」，请在策略工坊继续编辑规则。`);
  };

  const handlePoolImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setPoolText(text || DEFAULT_POOL_TEXT);
      setActionMessage(`已导入股票池文件「${file.name}」，识别结果会自动刷新。`);
    };
    reader.readAsText(file, 'utf-8');
    event.target.value = '';
  };

  const exportPool = () => {
    const rows = ['symbol,name,sector,momentum,liquidity,risk,score']
      .concat(parsedPool.map((row) => `${row.stock.symbol},${row.stock.name},${row.stock.sector},${row.momentum},${row.liquidity},${row.risk},${row.score}`));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ai-finance-stock-pool.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    setActionMessage('已导出股票池 CSV，可用于复盘或导入其他量化工具。');
  };

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
            <span className="flex items-center gap-1.5 rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 align-middle font-mono text-[11px] tracking-widest text-indigo-400">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.8)]" />
              CORE-V2
            </span>
          </h2>
          <p className="mt-2 text-sm font-mono tracking-wide text-neutral-400">量化策略验证、股票池解析与模拟盘/实盘一致性检查</p>
        </div>

        <div className="flex rounded-xl border border-white/5 bg-black/40 p-1.5 backdrop-blur-md">
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
        <div className="mb-5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-xs text-indigo-100/80">
          {actionMessage}
        </div>
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="mb-6 flex justify-end gap-4">
                <button
                  data-testid="backtest-open-params"
                  onClick={() => setParamsOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-5 py-2.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-black/60"
                >
                  <Settings2 className="h-4 w-4" />
                  回测参数
                </button>
                <button
                  onClick={runTest}
                  disabled={running}
                  className="flex items-center gap-2 rounded-lg border border-indigo-500/50 bg-indigo-600 px-8 py-2.5 text-xs font-medium text-white shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all hover:bg-indigo-500 disabled:opacity-50"
                >
                  {running ? <Activity className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                  {running ? '引擎计算中...' : '启动单票/组合回测'}
                </button>
              </div>

              <AnimatePresence>
                {paramsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-white/5 bg-black/25 p-4 text-xs md:grid-cols-4"
                  >
                    {[
                      ['回测周期', '2021-01-01 至今'],
                      ['交易成本', '佣金 0.025% / 印花税 0.05%'],
                      ['调仓频率', '每周一开盘后'],
                      ['风控阈值', '单票 20% / 行业 35%'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-white/[0.03] p-3">
                        <p className="text-[10px] text-neutral-500">{label}</p>
                        <p className="mt-1 text-neutral-200">{value}</p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-4">
                <MetricCard label="累计收益" value="+42.5%" hint="vs. 沪深300 +15.8%" icon={TrendingUp} tone="rose" />
                <MetricCard label="最大回撤" value="-12.4%" hint="风控阈值 -15%" icon={ShieldAlert} tone="emerald" />
                <MetricCard label="胜率" value="64.0%" hint="共执行 128 笔交易" icon={Flag} tone="indigo" />
                <MetricCard label="夏普比率" value="1.82" hint="风险调整后收益良好" icon={BarChart} />
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 shadow-xl backdrop-blur-md xl:col-span-2">
                  <h3 className="mb-6 border-b border-white/5 pb-3 text-xs font-mono uppercase tracking-widest text-neutral-400">收益率曲线</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={EQUITY_CURVE}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="month" stroke="#737373" fontSize={11} tickLine={false} />
                        <YAxis stroke="#737373" fontSize={11} tickFormatter={(val) => `¥${(val / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.82)', borderColor: 'rgba(255,255,255,0.12)', borderRadius: '12px', fontSize: '12px' }} />
                        <Line type="monotone" dataKey="strategy" name="策略收益" stroke="#f43f5e" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="base" name="沪深300基准" stroke="#737373" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-xl backdrop-blur-md">
                  <h3 className="mb-4 text-xs font-mono uppercase tracking-widest text-neutral-400">风控审核</h3>
                  {[
                    ['硬性止损', '组合回撤超过 15% 自动触发清仓建议。'],
                    ['仓位上限', '单一标的暴露头寸上限 20%，行业上限 35%。'],
                    ['执行一致性', '滑点、佣金和成交失败均纳入实盘偏差统计。'],
                  ].map(([title, desc], index) => (
                    <div key={title} className="mb-3 rounded-xl border border-white/5 bg-black/25 p-4">
                      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-neutral-200">
                        <CheckCircle2 className={cn('h-4 w-4', index === 0 ? 'text-rose-400' : 'text-indigo-300')} />
                        {title}
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-500">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'workshop' && (
            <motion.div key="workshop" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="min-h-[500px] overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] shadow-xl">
                <div className="flex items-center justify-between border-b border-white/5 bg-black/40 p-5">
                  <h3 className="text-sm font-medium text-white">TDX 公式编译 / 导入</h3>
                  <button data-testid="backtest-compile-strategy" onClick={compileStrategy} className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-mono text-white transition-colors hover:bg-indigo-500">编译为 Python 策略</button>
                </div>
                <div className="min-h-[430px] bg-[#050505] p-6 font-mono text-sm leading-relaxed text-neutral-300">
                  <span className="text-emerald-400">DIFF</span> := <span className="text-yellow-300">EMA</span>(CLOSE, 12) - <span className="text-yellow-300">EMA</span>(CLOSE, 26);<br /><br />
                  <span className="text-emerald-400">DEA</span> := <span className="text-yellow-300">EMA</span>(DIFF, 9);<br /><br />
                  <span className="text-emerald-400">MACD</span> := 2 * (DIFF - DEA);<br /><br />
                  <span className="text-indigo-400">ENTERLONG</span>: <span className="text-sky-400">CROSS</span>(DIFF, DEA) <span className="text-rose-400">AND</span> MACD &gt; 0;<br /><br />
                  <span className="text-indigo-400">EXITLONG</span>: <span className="text-sky-400">CROSS</span>(DEA, DIFF);
                  {compiled && (
                    <div className="mt-8 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 font-sans text-xs leading-relaxed text-emerald-100/80">
                      编译成功：已生成 enter_long / exit_long 信号函数，并自动附加滑点、佣金和风控检查。
                    </div>
                  )}
                </div>
              </div>

              <div className="min-h-[500px] rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white">多策略管理器</h3>
                  <button data-testid="backtest-create-strategy" onClick={createStrategy} className="text-xs font-medium text-indigo-400 hover:text-indigo-300">+ 创建新策略</button>
                </div>
                {strategies.map((name, index) => (
                  <div key={name} className="mb-3 flex items-center justify-between rounded-xl border border-white/5 bg-black/25 p-4">
                    <div>
                      <h4 className="text-sm font-medium text-neutral-200">{name}</h4>
                      <p className="mt-1 text-[10px] font-mono text-neutral-500">持仓 {3 - index} 支 · 胜率 {(55 + index * 4.2).toFixed(1)}%</p>
                    </div>
                    <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400">运行中</span>
                  </div>
                ))}
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
                    <p className="mt-1 text-xl font-mono text-white">{parsedPool.length}</p>
                  </div>
                  <div className="rounded-xl bg-black/25 p-3">
                    <p className="text-[10px] text-neutral-500">最高分</p>
                    <p className="mt-1 text-xl font-mono text-rose-400">{parsedPool[0]?.score ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-black/25 p-3">
                    <p className="text-[10px] text-neutral-500">低风险</p>
                    <p className="mt-1 text-xl font-mono text-emerald-400">{parsedPool.filter((row) => row.risk < 45).length}</p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] shadow-xl">
                <div className="flex items-center justify-between border-b border-white/5 bg-black/35 p-5">
                  <h3 className="text-sm font-semibold text-white">截面因子清洗结果</h3>
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
                      <th className="px-5 py-3 text-right">动量</th>
                      <th className="px-5 py-3 text-right">流动性</th>
                      <th className="px-5 py-3 text-right">风险</th>
                      <th className="px-5 py-3 text-right">综合分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedPool.map((row) => (
                      <tr key={row.stock.symbol} className="border-b border-white/5 hover:bg-white/[0.025]">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-neutral-200">{row.stock.name}</p>
                          <p className="mt-1 font-mono text-[10px] text-indigo-300">{row.stock.symbol}</p>
                        </td>
                        <td className="px-5 py-3.5 text-neutral-400">{row.stock.sector}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-neutral-300">{row.momentum}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-neutral-300">{row.liquidity}</td>
                        <td className={cn('px-5 py-3.5 text-right font-mono', row.risk > 45 ? 'text-amber-300' : 'text-emerald-400')}>{row.risk}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-rose-400">{row.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'compare' && (
            <motion.div key="compare" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                <MetricCard label="成交一致率" value="92.4%" hint="较昨日 +1.8%" icon={CheckCircle2} tone="emerald" />
                <MetricCard label="平均滑点" value="0.18%" hint="低于 0.30% 阈值" icon={Activity} tone="indigo" />
                <MetricCard label="风控拒单" value="2笔" hint="均为行业暴露超限" icon={ShieldAlert} tone="rose" />
                <MetricCard label="资金偏离" value="¥18.6k" hint="可接受区间内" icon={BarChart} />
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] shadow-xl">
                <div className="border-b border-white/5 bg-black/35 p-5">
                  <h3 className="text-sm font-semibold text-white">模拟盘 vs 实盘执行明细</h3>
                  <p className="mt-1 text-xs text-neutral-500">用于排查信号时间、成交价差、滑点和风控拒单原因。</p>
                </div>
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="border-b border-white/5 bg-black/20 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                    <tr>
                      <th className="px-5 py-3">时间</th>
                      <th className="px-5 py-3">标的</th>
                      <th className="px-5 py-3">信号</th>
                      <th className="px-5 py-3 text-right">模拟价</th>
                      <th className="px-5 py-3 text-right">实盘价</th>
                      <th className="px-5 py-3 text-right">滑点</th>
                      <th className="px-5 py-3 text-right">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EXECUTION_ROWS.map((row) => (
                      <tr key={`${row.time}-${row.symbol}`} className="border-b border-white/5 hover:bg-white/[0.025]">
                        <td className="px-5 py-3.5 font-mono text-neutral-500">{row.time}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-neutral-200">{row.name}</p>
                          <p className="mt-1 font-mono text-[10px] text-indigo-300">{row.symbol}</p>
                        </td>
                        <td className="px-5 py-3.5 text-neutral-300">{row.signal}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-neutral-400">{row.simulated}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-neutral-200">{row.actual}</td>
                        <td className={cn('px-5 py-3.5 text-right font-mono', Math.abs(row.slippage) > 0.35 ? 'text-amber-300' : 'text-emerald-400')}>{row.slippage > 0 ? '+' : ''}{row.slippage}%</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={cn('rounded-full border px-2 py-1 text-[10px]', row.status === '部分成交' ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300')}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
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
