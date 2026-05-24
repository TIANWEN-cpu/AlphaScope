import { useState } from 'react';
import { Bot, Maximize2, RefreshCw, Send, Zap, Clock, LineChart as LineChartIcon, Settings2, Sparkles, ChevronDown, ImagePlus } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ChatMessage } from '../types';

const generateKlineData = (points: number, basePrice: number = 1500) => {
  let currentPrice = basePrice;
  return Array.from({ length: points }).map((_, i) => {
    currentPrice += (Math.random() * 20 - 10);
    return {
      date: `05-${String(10 + Math.floor(i / 2)).padStart(2, '0')}`,
      ma5: currentPrice + 5,
      ma10: currentPrice,
      ma20: currentPrice - 10,
      volume: 400000 + Math.random() * 800000,
      up: Math.random() > 0.48,
    };
  });
};

const MOCK_NEWS = [
  { time: "22:13", title: "市场定价显示，交易员已完全预期到2026年底美联储将加息25个基点。", source: "财联社" },
  { time: "22:12", title: "财联社5月22日电，美联储官员沃勒表示，4月份消费者价格上涨的范围令人担忧...", source: "财联社" },
  { time: "22:04", title: "港股IPO：融泰药业递表港交所", desc: "广东融泰药业股份有限公司向港交所提交上市申请书，独家保荐人为中信证券。", source: "公告" }
];

const MOCK_FINANCE = [
  { label: '市盈率(TTM)', value: '28.45', trend: 'up' },
  { label: '市净率(MRQ)', value: '6.12', trend: 'down' },
  { label: '毛利率', value: '91.8%', trend: 'up' },
  { label: '净利润同增', value: '+19.1%', trend: 'up' },
];

const MOCK_FUNDS = [
  { label: '主力净流入', value: '+3.2亿', color: 'text-rose-500' },
  { label: '超大单', value: '+4.5亿', color: 'text-rose-500' },
  { label: '大单', value: '-1.3亿', color: 'text-emerald-500' },
  { label: '中单', value: '-2.1亿', color: 'text-emerald-500' },
];

export function Workbench() {
  const [activePeriod, setActivePeriod] = useState('日K');
  const [activePanelTab, setActivePanelTab] = useState('news');
  const [chartData, setChartData] = useState(() => generateKlineData(40));
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'agent',
      agentName: 'System',
      content: '欢迎使用 AI-Finance 多 Agent 分析工作台。当前标的：**贵州茅台** (600519)。请选择分析模式并输入问题。',
      timestamp: new Date().toISOString(),
    }
  ]);
  const [input, setInput] = useState('');

  const handlePeriodChange = (period: string) => {
    setActivePeriod(period);
    const points = period === '分时' ? 60 : period === '周K' ? 30 : period === '月K' ? 20 : 40;
    setChartData(generateKlineData(points));
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');

    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        agentName: 'System',
        content: `任务分发：**${input}**\n\n- [基本面助理] 提取财报数据...\n- [量化策略专家] 计算当前因子载荷...\n- [风险合规顾问] 检查舆情风险...`,
        timestamp: new Date().toISOString(),
      }]);
    }, 600);

    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 2).toString(),
        role: 'agent',
        agentName: 'System',
        content: `[综合分析报告]\n\n**1. 基本面评分 (8/10)**\n盈利能力强劲，Q1营收达预期，但渠道库存存在微小压力。\n\n**2. 量化诊断 (多头)**\n当前 MA(5) 向上金叉 MA(10)，资金流呈现净流入状态，多因子模型输出看多信号，置信度 85%。\n\n**建议操作：** 继续持有/设逢低买点。`,
        timestamp: new Date().toISOString(),
      }]);
    }, 2500);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="p-6 lg:p-8 max-w-[1600px] mx-auto text-neutral-300"
    >
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 relative z-10">
        <div>
          <h1 className="text-3xl font-display font-medium tracking-tight text-white flex items-center gap-4 mb-3">
            贵州茅台
            <span className="text-xs font-mono font-medium text-neutral-400 bg-white/[0.03] px-2.5 py-1 rounded border border-white/5 tracking-wider">600519.SH</span>
          </h1>
          <div className="flex items-baseline gap-4 text-rose-500">
            <span className="text-4xl font-mono font-medium tracking-tight drop-shadow-[0_0_15px_rgba(244,63,94,0.3)]">1,513.48</span>
            <span className="text-sm font-mono font-medium flex items-center bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded text-rose-500">
              <span className="rotate-45 mr-1 text-lg leading-none">↗</span>+0.39%
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {MOCK_FINANCE.slice(0, 4).map((item, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-xl px-5 py-3.5 flex flex-col min-w-[120px] shadow-sm transform transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.04]">
              <span className="text-xs text-neutral-500 mb-1.5">{item.label}</span>
              <span className={cn("text-sm font-mono font-medium tracking-wide", item.trend === 'up' ? 'text-rose-500' : 'text-emerald-500')}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 relative z-10">
        {/* Left Column: Chart & Info */}
        <div className="xl:col-span-2 flex flex-col gap-8">
          {/* Chart Panel */}
          <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl h-[500px] flex flex-col">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
              <div className="flex items-center gap-3">
                 <h2 className="font-semibold text-neutral-200">行情走势</h2>
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
              </div>
              <div className="flex bg-black/40 rounded-lg p-1 border border-white/5 shadow-inner">
                {['分时', '日K', '周K', '月K'].map((period) => (
                  <button 
                    key={period}
                    onClick={() => handlePeriodChange(period)}
                    className={cn(
                      "px-5 py-1.5 text-xs rounded-md font-medium transition-all cursor-pointer",
                      activePeriod === period ? "bg-white/10 text-white shadow-sm border border-white/10" : "text-neutral-500 hover:text-neutral-300 border border-transparent"
                    )}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 py-3 flex items-center gap-8 text-[11px] font-mono whitespace-nowrap bg-black/20 border-b border-white/5">
               <span className="text-yellow-500/90 flex items-center gap-2"><div className="w-2 h-0.5 bg-yellow-500/90"></div>MA5: 1502.16</span>
               <span className="text-indigo-400/90 flex items-center gap-2"><div className="w-2 h-0.5 bg-indigo-400/90"></div>MA10: 1507.75</span>
               <span className="text-emerald-400/90 flex items-center gap-2"><div className="w-2 h-0.5 bg-emerald-400/90"></div>MA20: 1513.69</span>
               <span className="text-neutral-500 ml-auto">VOL: 1,158,400</span>
            </div>

            {/* Chart Area */}
            <div className="flex-1 p-5 bg-black/40 relative">
               <div className="absolute right-6 top-6 text-[10px] font-mono text-neutral-600">1570.93</div>
               <div className="absolute right-6 bottom-24 text-[10px] font-mono text-neutral-600">1460.54</div>
             
             <ResponsiveContainer width="100%" height="80%">
               <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                 <defs>
                   <linearGradient id="colorMa5" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#eab308" stopOpacity={0.4}/>
                     <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid stroke="#ffffff" strokeOpacity={0.03} strokeDasharray="4 4" vertical={false} />
                 <YAxis domain={['auto', 'auto']} hide />
                 <Area type="monotone" dataKey="ma5" stroke="#eab308" strokeWidth={2} fillOpacity={1} fill="url(#colorMa5)" />
                 <Line type="monotone" dataKey="ma10" stroke="#818cf8" strokeWidth={1.5} dot={false} />
                 <Line type="monotone" dataKey="ma20" stroke="#34d399" strokeWidth={1.5} dot={false} />
                 {/* Fake Candlesticks using Bar */}
                 <Bar dataKey="ma5" barSize={4}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.up ? '#f43f5e' : '#10b981'} />
                    ))}
                 </Bar>
               </ComposedChart>
             </ResponsiveContainer>
             
             <ResponsiveContainer width="100%" height="20%">
               <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                 <Bar dataKey="volume" barSize={4} radius={[2, 2, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-vol-${index}`} fill={entry.up ? '#f43f5e' : '#10b981'} fillOpacity={0.4} />
                    ))}
                 </Bar>
               </ComposedChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom News/Facts Panel */}
        <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[380px]">
           <div className="flex items-center gap-8 px-6 border-b border-white/5 bg-white/[0.01] pt-1">
             {[ 
               { id: 'news', label: '实时资讯', icon: Zap },
               { id: 'finance', label: '核心财务', icon: Clock },
               { id: 'funds', label: '主力资金', icon: LineChartIcon },
               { id: 'quant', label: '量化因子', icon: Settings2 },
             ].map((tab) => (
               <button 
                 key={tab.id} 
                 onClick={() => setActivePanelTab(tab.id)}
                 className={cn(
                 "flex items-center gap-2 py-4 text-xs font-medium border-b-2 transition-colors relative",
                 activePanelTab === tab.id ? "border-indigo-400 text-indigo-400" : "border-transparent text-neutral-500 hover:text-neutral-300"
               )}>
                 <tab.icon className={cn("w-4 h-4", activePanelTab === tab.id ? "text-indigo-400 drop-shadow-[0_0_5px_rgba(129,140,248,0.5)]" : "text-neutral-600")} />
                 {tab.label}
                 {activePanelTab === tab.id && (
                    <motion.div 
                      layoutId="activeTabIndicator"
                      className="absolute bottom-[-2px] left-0 right-0 h-[2px] bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]"
                    />
                 )}
               </button>
             ))}
           </div>
           <div className="flex-1 overflow-y-auto p-4 bg-black/40 custom-scrollbar">
             <AnimatePresence mode="wait">
               {activePanelTab === 'news' && (
                 <motion.div 
                   key="news"
                   initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                 >
                   {MOCK_NEWS.map((news, i) => (
                     <div key={i} className="px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer group">
                       <div className="flex gap-4">
                         <div className="text-[10px] font-mono text-neutral-500 group-hover:text-neutral-400 mt-1 flex items-center gap-2">
                            {news.time}
                         </div>
                         <div className="flex-1">
                           <div className="flex items-center gap-2 mb-1.5">
                             <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[9px] font-mono uppercase">
                               {news.source}
                             </span>
                             <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
                           </div>
                           <h4 className="text-sm text-neutral-200 font-medium leading-relaxed group-hover:text-indigo-300 transition-colors">{news.title}</h4>
                           {news.desc && <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">{news.desc}</p>}
                         </div>
                       </div>
                     </div>
                   ))}
                 </motion.div>
               )}

               {activePanelTab === 'finance' && (
                 <motion.div key="finance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                   {MOCK_FINANCE.map((item, i) => (
                     <div key={i} className="bg-white/[0.03] border border-white/5 p-4 rounded-xl flex flex-col justify-center hover:bg-white/[0.05] transition-colors">
                       <span className="text-xs text-neutral-500 mb-2">{item.label}</span>
                       <span className={cn("text-2xl font-mono font-medium", item.trend === 'up' ? 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]' : 'text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]')}>
                         {item.value}
                       </span>
                     </div>
                   ))}
                 </motion.div>
               )}

               {activePanelTab === 'funds' && (
                 <motion.div key="funds" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                   {MOCK_FUNDS.map((item, i) => (
                     <div key={i} className="bg-white/[0.03] border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center hover:bg-white/[0.05] transition-colors">
                       <span className="text-xs text-neutral-500 mb-2">{item.label}</span>
                       <span className={`text-2xl font-mono font-medium drop-shadow-md ${item.color}`}>
                         {item.value}
                       </span>
                     </div>
                   ))}
                 </motion.div>
               )}

               {activePanelTab === 'quant' && (
                 <motion.div key="quant" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex h-full items-center justify-center p-4">
                   <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-4 py-3 rounded-lg text-sm flex items-center gap-3">
                     <Settings2 className="w-5 h-5" />
                     多因子Alpha模型运算中... 当前暴露度良好。
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>
           </div>
        </div>
      </div>

      {/* Right AI Engine Panel */}
      <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col h-[912px] sticky top-8 relative overflow-hidden">
        {/* Glow effect at top */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-indigo-500/10 blur-[50px] pointer-events-none"></div>

        <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-white/[0.01] relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600/20 to-indigo-400/20 flex items-center justify-center border border-indigo-400/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <h2 className="font-semibold text-neutral-200 tracking-wide">AI 分析引擎</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-2 py-1 text-[11px] rounded border border-white/10 bg-black/40 text-neutral-400 hover:text-white transition-colors">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_5px_rgba(99,102,241,0.5)]"></div>
              标准分析
              <ChevronDown className="w-3 h-3 ml-1" />
            </button>
            <button className="p-1.5 hover:bg-white/5 rounded-md text-neutral-500 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 hover:bg-white/5 rounded-md text-neutral-500 transition-colors">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar z-10">
          <AnimatePresence>
            {messages.map(msg => (
              <motion.div 
                key={msg.id} 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="flex gap-3"
              >
                {msg.role !== 'user' ? (
                  <div className="min-w-0 flex-1 mr-4">
                     <div className="bg-white/[0.04] border border-white/[0.05] rounded-xl rounded-tl-sm p-4 text-sm text-neutral-300 leading-relaxed shadow-[0_4px_15px_rgba(0,0,0,0.1)] backdrop-blur-sm">
                       <p dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<span class="text-white font-medium">$1</span>').replace(/\n/g, '<br/>') }} />
                     </div>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1 ml-12">
                     <div className="bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 border border-indigo-500/30 text-indigo-50 rounded-xl rounded-tr-sm p-4 text-sm leading-relaxed shadow-[0_4px_15px_rgba(99,102,241,0.05)] backdrop-blur-sm">
                       {msg.content}
                     </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 1 }} 
            className="flex justify-center my-4 relative z-10"
          >
             <span className="text-[10px] font-mono text-neutral-500 bg-black/40 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm">
               [系统] 已切换至 贵州茅台 (600519)
             </span>
          </motion.div>
        </div>
        
        <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-md relative z-10">
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden shadow-inner focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
            <textarea 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="对 贵州茅台 提出分析需求..." 
              className="w-full bg-transparent p-4 text-sm focus:outline-none text-neutral-200 placeholder:text-neutral-500 resize-none h-24 custom-scrollbar"
            />
            <div className="flex justify-between items-center px-3 pb-3">
              <div className="flex gap-1.5">
                <button title="多模态分析 (上传 K 线截图或本地研报)" className="p-1.5 text-neutral-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-colors">
                  <ImagePlus className="w-4.5 h-4.5" />
                </button>
                <button title="分析配置" className="p-1.5 text-neutral-500 hover:text-neutral-300 rounded-md hover:bg-white/5 transition-colors">
                  <Settings2 className="w-4.5 h-4.5" />
                </button>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-mono text-neutral-500">
                <span>ENTER 发送 • SHIFT+ENTER 换行</span>
                <button 
                  onClick={handleSend}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg border border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all"
                >
                  发送 <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </motion.div>
  );
}
