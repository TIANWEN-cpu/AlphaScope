import { useState } from 'react';
import { Play, Settings2, Download, TrendingUp, History, Flag, ShieldAlert, BarChart, XCircle, Activity, Code2, Layers, Cpu, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { BacktestResult } from '../types';
import { cn } from '../lib/utils';

const MOCK_RESULTS: BacktestResult[] = [
  { id: '1', strategyName: 'MACD Momentum (Long)', returnRate: 42.5, maxDrawdown: -12.4, winRate: 64, sharpeRatio: 1.8, dateRange: '2020-01 - 2023-11' },
  { id: '2', strategyName: 'Mean Reversion Volatility', returnRate: 18.2, maxDrawdown: -6.1, winRate: 58, sharpeRatio: 2.1, dateRange: '2021-06 - 2023-11' },
];

const EQUITY_CURVE = Array.from({ length: 40 }).map((_, i) => ({
  month: `M${i+1}`,
  base: 10000 * Math.pow(1.006, i),
  strategy: 10000 * Math.pow(1.015, i) * (1 + (Math.random() * 0.1 - 0.03)),
}));

const TABS = [
  { id: 'overview', label: '回测大厅', icon: History },
  { id: 'workshop', label: '策略工坊', icon: Code2 },
  { id: 'pool', label: '股票池解析', icon: Layers },
  { id: 'compare', label: '实盘比对', icon: Activity },
];

export function Backtesting() {
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const runTest = () => {
    setRunning(true);
    setTimeout(() => setRunning(false), 2000);
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
            金策智算引擎 <span className="px-2 py-0.5 rounded text-[11px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono tracking-widest align-middle flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_5px_rgba(99,102,241,0.8)]"></span>CORE-V2</span>
          </h2>
          <p className="text-sm font-mono text-neutral-400 mt-2 tracking-wide">量化策略验证与回测执行中枢 (Quant Strategy Execution & Backtesting Engine)</p>
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
                  layoutId="jince-tab"
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
                <div className="flex gap-4">
                  <button className="px-5 py-2.5 bg-black/40 hover:bg-black/60 text-neutral-300 rounded-lg flex items-center gap-2 text-xs font-mono uppercase font-medium transition-colors border border-white/10 backdrop-blur-md shadow-sm">
                    <Settings2 className="w-4 h-4" /> 回测参数
                  </button>
                  <button 
                    onClick={runTest}
                    disabled={running}
                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white border border-indigo-500/50 rounded-lg flex items-center gap-2 text-xs font-mono uppercase font-medium transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                  >
                    {running ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    {running ? '引擎计算中...' : '启动单票/组合回测'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                {/* Metric Cards */}
                <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl hover:-translate-y-1 transition-transform group">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-mono tracking-widest uppercase font-medium text-neutral-400">Total Return</p>
                    <TrendingUp className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="text-3xl font-mono font-medium text-white drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]">+42.5%</h3>
                  <p className="text-[11px] font-mono text-rose-400 mt-2">vs. 基准收益 +15.8%</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl hover:-translate-y-1 transition-transform group">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-mono tracking-widest uppercase font-medium text-neutral-400">Max Drawdown</p>
                    <ShieldAlert className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="text-3xl font-mono font-medium text-white">-12.4%</h3>
                  <p className="text-[11px] font-mono text-emerald-400 mt-2">风控审核: 优秀 (阈值-15%)</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl hover:-translate-y-1 transition-transform group">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-mono tracking-widest uppercase font-medium text-neutral-400">Win Rate</p>
                    <Flag className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="text-3xl font-mono font-medium text-white drop-shadow-[0_0_10px_rgba(129,140,248,0.3)]">64.0%</h3>
                  <p className="text-[11px] font-mono text-neutral-500 mt-2">共执行 128 笔交易</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl hover:-translate-y-1 transition-transform group">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-mono tracking-widest uppercase font-medium text-neutral-400">Sharpe Ratio</p>
                    <BarChart className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="text-3xl font-mono font-medium text-white">1.82</h3>
                  <p className="text-[11px] font-mono text-neutral-500 mt-2">风险调整超额收益</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none"></div>
                  <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-6 flex items-center gap-2 pb-3 border-b border-white/5">
                    收益率曲线 (实盘一致性比对)
                  </h3>
                  <div className="h-80 w-full -ml-3 relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={EQUITY_CURVE}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="month" stroke="#737373" fontSize={11} fontFamily="monospace" tickLine={false} />
                        <YAxis stroke="#737373" fontSize={11} fontFamily="monospace" tickLine={false} tickFormatter={(val) => `¥${(val/1000).toFixed(0)}k`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', fontFamily: 'monospace', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}
                        />
                        <Line type="monotone" dataKey="strategy" name="策略收益" stroke="#f43f5e" strokeWidth={2.5} dot={false} activeDot={{r: 4}} style={{ filter: 'drop-shadow(0 0 8px rgba(244,63,94,0.4))' }} />
                        <Line type="monotone" dataKey="base" name="沪深300基准" stroke="#737373" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-0 overflow-hidden flex flex-col shadow-xl">
                  <div className="p-5 border-b border-white/5 flex justify-between items-center bg-black/40">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 flex items-center gap-2">风控审核与信号体系</h3>
                    <span className="text-[10px] font-mono uppercase font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded shadow-inner">ACTIVE</span>
                  </div>
                  <div className="p-5 flex-1 space-y-4">
                    <div className="border border-red-900/40 bg-red-950/20 rounded-xl p-4 relative overflow-hidden transition-colors hover:bg-red-950/30">
                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-[11px] font-mono tracking-wide uppercase text-red-400 mb-1">硬性止损 (Hard Stop-Loss)</h4>
                          <p className="text-[11px] text-neutral-400/90 leading-relaxed">组合回撤超过 15% 时立即清仓。引擎已阻断 12 次情绪化覆盖干预。</p>
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
                      <h4 className="text-[11px] font-mono tracking-wide uppercase text-sky-400 mb-1 ml-3">交易一致性 (Execution Consistency)</h4>
                      <p className="text-[11px] text-neutral-400/90 ml-3">滑点与佣金折损已计算在内，模型实盘偏离度控制在 &lt; 0.5% 内。</p>
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
                  <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-mono text-xs shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all">
                    编译为 Python 策略
                  </button>
                </div>
                <div className="flex-1 p-5 font-mono text-sm leading-relaxed bg-[#050505] text-indigo-300 relative">
                  <div className="absolute top-0 right-0 bottom-0 left-10 pointer-events-none opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
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

              {/* Multi-strategy Manager */}
              <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-0 flex flex-col shadow-xl overflow-hidden min-h-[500px]">
                <div className="p-5 border-b border-white/5 bg-black/40 flex justify-between items-center">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    多策略管理器 (策略进化)
                  </h3>
                  <button className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                    + 创建新策略
                  </button>
                </div>
                <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-4">
                  {['均值回归(小市值)', '高频动量突破', '双均线趋势跟踪'].map((name, i) => (
                    <div key={i} className="border border-white/5 bg-white/[0.02] rounded-xl p-4 flex justify-between items-center group hover:bg-white/[0.04] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center">
                          <Code2 className="w-5 h-5 text-indigo-400/80" />
                        </div>
                        <div>
                          <h4 className="text-sm text-neutral-200 font-medium mb-1 group-hover:text-indigo-300 transition-colors">{name}</h4>
                          <div className="flex gap-3 text-[10px] font-mono text-neutral-500">
                            <span>持仓: {3-i} 支</span>
                            <span>胜率: {(55 + i * 4.2).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400 text-sm font-mono font-medium border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 rounded-lg">运行中</span>
                        <button className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-white/10 rounded-lg transition-colors">
                          <Settings2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="border border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Cpu className="w-5 h-5 text-neutral-400 group-hover:text-indigo-400" />
                    </div>
                    <span className="text-sm font-medium text-neutral-400 group-hover:text-neutral-200">AI 策略进化引擎</span>
                    <p className="text-xs text-neutral-500 mt-1">使用遗传算法与深度学习自动演化新策略规则</p>
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
                {activeTab === 'pool' ? 'BLK 股票池解析引擎' : '实盘与模拟盘深度比对'}
              </h3>
              <p className="text-sm text-neutral-400 max-w-md text-center leading-relaxed">
                {activeTab === 'pool' 
                  ? '该模块负责自动解析各种结构化的股票池文件 (BLK、CSV) 并进行高维度的截面因子清洗筛选。该节点正在配置本地算力资源。'
                  : '一致性对比引擎实时监控回测信号与实盘执行账户的偏离度，追踪由于滑点、网络延迟或风控拒绝导致的差异。该节点正在对接券商 API 环境。'
                }
              </p>
              <button className="mt-8 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-neutral-300 font-mono transition-all">
                节点挂载中 (CONNECTING...)
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
