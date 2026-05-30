import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Bot, Maximize2, RefreshCw, Send, Zap, Clock, LineChart as LineChartIcon, Settings2, Sparkles, ChevronDown, ImagePlus } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, Area, YAxis, CartesianGrid, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ChatMessage } from '../types';
import { STOCK_UNIVERSE, StockTarget, findStockTarget, formatStockLabel } from '../lib/stocks';
import { getPersistedStock, subscribeStockSelected } from '../lib/workspaceEvents';

const generateKlineData = (points: number, basePrice: number = 1500) => {
  let currentPrice = basePrice;
  const volatility = Math.max(0.25, Math.min(10, basePrice * 0.012));
  const maOffset = Math.max(0.2, Math.min(10, basePrice * 0.004));
  const volumeBase = Math.max(80000, basePrice * 2800);
  return Array.from({ length: points }).map((_, i) => {
    currentPrice = Math.max(0.1, currentPrice + (Math.random() * volatility * 2 - volatility));
    return {
      date: `05-${String(10 + Math.floor(i / 2)).padStart(2, '0')}`,
      ma5: currentPrice + maOffset,
      ma10: currentPrice,
      ma20: Math.max(0.1, currentPrice - maOffset * 2),
      volume: volumeBase + Math.random() * volumeBase * 1.8,
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

const stockMetrics: Record<string, { price: number; change: number; finance: typeof MOCK_FINANCE; funds: typeof MOCK_FUNDS }> = {
  '600519.SH': {
    price: 1513.48,
    change: 0.39,
    finance: MOCK_FINANCE,
    funds: MOCK_FUNDS,
  },
  '300750.SZ': {
    price: 206.1,
    change: 2.14,
    finance: [
      { label: '市盈率(TTM)', value: '21.72', trend: 'down' },
      { label: '市净率(MRQ)', value: '4.86', trend: 'up' },
      { label: '毛利率', value: '25.4%', trend: 'up' },
      { label: '净利润同增', value: '+12.7%', trend: 'up' },
    ],
    funds: [
      { label: '主力净流入', value: '+5.8亿', color: 'text-rose-500' },
      { label: '超大单', value: '+2.6亿', color: 'text-rose-500' },
      { label: '大单', value: '+1.1亿', color: 'text-rose-500' },
      { label: '中单', value: '-0.9亿', color: 'text-emerald-500' },
    ],
  },
};

function getWorkbenchMetrics(stock: StockTarget) {
  return stockMetrics[stock.symbol] ?? {
    price: stock.startPrice,
    change: stock.symbol.charCodeAt(0) % 2 === 0 ? 1.06 : -0.72,
    finance: MOCK_FINANCE,
    funds: MOCK_FUNDS,
  };
}

const ANALYSIS_MODES = [
  { id: 'standard', label: '标准分析', desc: '基本面、资金、技术面综合研判' },
  { id: 'risk', label: '风险扫描', desc: '公告、舆情、解禁、减持和异常交易优先' },
  { id: 'technical', label: '技术诊断', desc: 'K线、均线、量价和短线情绪优先' },
] as const;

type AnalysisModeId = typeof ANALYSIS_MODES[number]['id'];

type PanelTabId = 'news' | 'finance' | 'funds' | 'quant';

const PANEL_TABS: Array<{ id: PanelTabId; label: string; icon: typeof Zap }> = [
  { id: 'news', label: '实时资讯', icon: Zap },
  { id: 'finance', label: '核心财务', icon: Clock },
  { id: 'funds', label: '主力资金', icon: LineChartIcon },
  { id: 'quant', label: '量化因子', icon: Settings2 },
];

const QUANT_FACTORS = [
  { label: '动量强度', value: '74', desc: '近端价格强度与成交扩张匹配度较高。' },
  { label: '波动约束', value: '中', desc: '短线波动放大，仓位建议保留风险缓冲。' },
  { label: '拥挤度', value: '58', desc: '主题热度上升但未达到极端拥挤。' },
  { label: '证据完整度', value: 'B', desc: '需继续补公告、资金流和估值来源。' },
];

function formatMessageHtml(content: string) {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<span class="text-white font-medium">$1</span>')
    .replace(/\n/g, '<br/>');
}

function formatPrice(value: number) {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolume(value: number) {
  if (value >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return Math.round(value).toLocaleString('zh-CN');
}

export function Workbench() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentStock, setCurrentStock] = useState<StockTarget>(() => getPersistedStock() ?? STOCK_UNIVERSE[0]);
  const [activePeriod, setActivePeriod] = useState('日K');
  const [activePanelTab, setActivePanelTab] = useState<PanelTabId>('news');
  const [chartData, setChartData] = useState(() => generateKlineData(40, currentStock.startPrice));
  const [analysisMode, setAnalysisMode] = useState<AnalysisModeId>('standard');
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoEvidence, setAutoEvidence] = useState(true);
  const [strictRisk, setStrictRisk] = useState(true);
  const [lastUploadedFile, setLastUploadedFile] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'agent',
      agentName: 'System',
      content: `欢迎使用 AI-Finance 多 Agent 分析工作台。当前标的：**${currentStock.name}** (${currentStock.symbol})。请选择分析模式并输入问题。`,
      timestamp: new Date().toISOString(),
    }
  ]);
  const [input, setInput] = useState('');
  const metrics = getWorkbenchMetrics(currentStock);
  const selectedMode = ANALYSIS_MODES.find((mode) => mode.id === analysisMode) ?? ANALYSIS_MODES[0];
  const chartStats = useMemo(() => {
    const lastPoint = chartData[chartData.length - 1];
    const ma5 = lastPoint?.ma5 ?? metrics.price;
    const ma10 = lastPoint?.ma10 ?? metrics.price;
    const ma20 = lastPoint?.ma20 ?? metrics.price;
    const values = chartData.flatMap((point) => [point.ma5, point.ma10, point.ma20]);
    const max = Math.max(...values, metrics.price);
    const min = Math.min(...values, metrics.price);
    const volume = lastPoint?.volume ?? 0;
    return {
      ma5,
      ma10,
      ma20,
      high: max,
      low: min,
      volume,
    };
  }, [chartData, metrics.price]);
  const stockNews = useMemo(() => {
    const prefix = `${currentStock.name} ${currentStock.symbol}`;
    const sector = currentStock.sector || '当前行业';
    const stockSpecific = [
      {
        time: '14:12',
        title: `${prefix} 公告与业务跟踪：重点核验 ${sector} 订单、收入确认和客户结构。`,
        desc: `该条已绑定当前标的，点击后会把公告/业务线索推送到右侧 AI 分析引擎。`,
        source: '公告',
      },
      {
        time: '13:36',
        title: `${currentStock.name} 资金与换手观察：放量方向需要与价格行为交叉验证。`,
        desc: '资金信号只作为短线关注度，不直接替代基本面和公告证据。',
        source: '资金',
      },
      ...MOCK_NEWS,
    ];
    return stockSpecific.slice(0, 5);
  }, [currentStock]);

  const handlePanelTabChange = (tabId: PanelTabId) => {
    setActivePanelTab(tabId);
  };

  const handlePanelItemSelect = (title: string, detail: string) => {
    appendSystemMessage(`已选中 **${currentStock.name}** 的信息卡片：**${title}**。\n${detail}\n\n下一步建议：把该信息与公告、价格行为、资金流和证据链进行交叉核验。`);
  };

  const appendSystemMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `system-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role: 'agent',
        agentName: 'System',
        content,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  useEffect(() => {
    return subscribeStockSelected(({ stock }) => {
      const resolved = findStockTarget(stock.symbol) ?? stock;
      setCurrentStock(resolved);
      setChartData(generateKlineData(40, resolved.startPrice));
      setMessages((prev) => [
        ...prev.map((msg) => msg.id === 'welcome'
          ? {
              ...msg,
              content: `欢迎使用 AI-Finance 多 Agent 分析工作台。当前标的：**${resolved.name}** (${resolved.symbol})。请选择分析模式并输入问题。`,
            }
          : msg),
        {
          id: `stock-${Date.now()}`,
          role: 'agent',
          agentName: 'System',
          content: `已切换研究标的：**${resolved.name}** (${resolved.symbol})。行情、资金与多 Agent 分析上下文已同步。`,
          timestamp: new Date().toISOString(),
        },
      ]);
    });
  }, []);

  const handlePeriodChange = (period: string) => {
    setActivePeriod(period);
    const points = period === '分时' ? 60 : period === '周K' ? 30 : period === '月K' ? 20 : 40;
    setChartData(generateKlineData(points, currentStock.startPrice));
  };

  const handleModeChange = (mode: AnalysisModeId) => {
    const nextMode = ANALYSIS_MODES.find((item) => item.id === mode) ?? ANALYSIS_MODES[0];
    setAnalysisMode(mode);
    setModeMenuOpen(false);
    appendSystemMessage(`分析模式已切换为 **${nextMode.label}**。\n${nextMode.desc}。`);
  };

  const handleRefreshChart = () => {
    const points = activePeriod === '分时' ? 60 : activePeriod === '周K' ? 30 : activePeriod === '月K' ? 20 : 40;
    setChartData(generateKlineData(points, currentStock.startPrice));
    appendSystemMessage(`已刷新 **${currentStock.name}** (${currentStock.symbol}) 的${activePeriod}行情沙盘，并同步更新均线、成交量与资金标签。`);
  };

  const handleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        appendSystemMessage('已退出全屏研究模式。');
      } else {
        await document.documentElement.requestFullscreen();
        appendSystemMessage('已进入全屏研究模式，适合进行盘中盯盘或投研展示。');
      }
    } catch {
      appendSystemMessage('当前浏览器未允许全屏切换，请检查浏览器权限或手动使用 F11。');
    }
  };

  const handleUploadContext = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLastUploadedFile(file.name);
    appendSystemMessage(`已载入多模态材料：**${file.name}**。\n该文件会作为 ${currentStock.name} 的图像/研报上下文，请切换到“K线/多模态解析”模块继续做视觉诊断。`);
    event.target.value = '';
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
        content: `任务分发：**${input}**\n\n- [分析模式] ${selectedMode.label}：${selectedMode.desc}\n- [基本面助理] 提取 ${currentStock.name} 财报数据...\n- [量化策略专家] 计算当前因子载荷...\n- [风险合规顾问] 检查舆情风险...`,
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
      className="mx-auto max-w-[1600px] p-6 text-neutral-300 lg:p-8"
    >
      {/* Top Header */}
      <div className="relative z-10 mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="mb-3 flex min-w-0 flex-wrap items-center gap-3 text-2xl font-medium tracking-tight text-white sm:text-3xl">
            {currentStock.name}
            <span className="shrink-0 rounded border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-xs font-medium tracking-wider text-neutral-300">{currentStock.symbol}</span>
          </h1>
          <div className="flex min-w-0 flex-wrap items-baseline gap-3 text-rose-500">
            <span className="font-mono text-3xl font-medium tracking-tight drop-shadow-[0_0_15px_rgba(244,63,94,0.3)] sm:text-4xl">{metrics.price.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="flex items-center rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 font-mono text-sm font-medium text-rose-500">
              <span className="rotate-45 mr-1 text-lg leading-none">{metrics.change >= 0 ? '↗' : '↘'}</span>{metrics.change >= 0 ? '+' : ''}{metrics.change.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 md:w-auto md:max-w-[48rem]">
          {metrics.finance.slice(0, 4).map((item, i) => (
            <div key={i} className="flex min-w-0 flex-col rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.04]">
              <span className="mb-1.5 truncate text-xs text-neutral-500">{item.label}</span>
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
          <div className="flex h-[500px] min-h-0 flex-col overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] shadow-2xl backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-white/[0.01] px-5 py-4">
              <div className="flex items-center gap-3">
                 <h2 className="font-semibold text-neutral-200">行情走势</h2>
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
              </div>
              <div className="flex rounded-lg border border-white/5 bg-black/40 p-1 shadow-inner">
                {['分时', '日K', '周K', '月K'].map((period) => (
                  <button 
                    key={period}
                    onClick={() => handlePeriodChange(period)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-md font-medium transition-all cursor-pointer sm:px-5",
                      activePeriod === period ? "bg-white/10 text-white shadow-sm border border-white/10" : "text-neutral-500 hover:text-neutral-300 border border-transparent"
                    )}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-white/5 bg-black/20 px-5 py-3 font-mono text-[11px]">
               <span className="flex items-center gap-2 text-yellow-500/90"><div className="h-0.5 w-2 bg-yellow-500/90"></div>MA5: {formatPrice(chartStats.ma5)}</span>
               <span className="flex items-center gap-2 text-indigo-400/90"><div className="h-0.5 w-2 bg-indigo-400/90"></div>MA10: {formatPrice(chartStats.ma10)}</span>
               <span className="flex items-center gap-2 text-emerald-400/90"><div className="h-0.5 w-2 bg-emerald-400/90"></div>MA20: {formatPrice(chartStats.ma20)}</span>
               <span className="text-neutral-500 sm:ml-auto">VOL: {formatVolume(chartStats.volume)}</span>
            </div>

            {/* Chart Area */}
            <div className="relative min-h-0 flex-1 bg-black/40 p-5">
               <div className="absolute right-6 top-6 text-[10px] font-mono text-neutral-600">{formatPrice(chartStats.high)}</div>
               <div className="absolute right-6 bottom-24 text-[10px] font-mono text-neutral-600">{formatPrice(chartStats.low)}</div>
             
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
             {PANEL_TABS.map((tab) => (
               <button 
                 key={tab.id} 
                 type="button"
                 data-testid={`workbench-info-tab-${tab.id}`}
                 onClick={() => handlePanelTabChange(tab.id)}
                 className={cn(
                 "flex items-center gap-2 py-4 text-xs font-medium border-b-2 transition-colors relative focus:outline-none focus:ring-2 focus:ring-indigo-500/40",
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
                   {stockNews.map((news, i) => (
                     <button
                       key={`${news.time}-${news.title}`}
                       type="button"
                       data-testid={`workbench-news-item-${i}`}
                       onClick={() => handlePanelItemSelect(news.title, `${news.source} 线索已关联 ${formatStockLabel(currentStock)}，可进入新闻聚合页继续按来源分类追踪。`)}
                       className="w-full px-4 py-3 text-left border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer group focus:outline-none focus:bg-indigo-500/[0.04]"
                     >
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
                     </button>
                   ))}
                 </motion.div>
               )}

               {activePanelTab === 'finance' && (
                 <motion.div key="finance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.finance.map((item, i) => (
                     <button
                       key={item.label}
                       type="button"
                       data-testid={`workbench-finance-card-${i}`}
                       onClick={() => handlePanelItemSelect(item.label, `当前值 ${item.value}，请结合 ${currentStock.name} 最新财报、行业均值和估值假设复核。`)}
                       className="bg-white/[0.03] border border-white/5 p-4 rounded-xl flex flex-col justify-center hover:bg-white/[0.05] transition-colors text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                     >
                       <span className="text-xs text-neutral-500 mb-2">{item.label}</span>
                       <span className={cn("text-2xl font-mono font-medium", item.trend === 'up' ? 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]' : 'text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]')}>
                         {item.value}
                       </span>
                     </button>
                   ))}
                 </motion.div>
               )}

               {activePanelTab === 'funds' && (
                 <motion.div key="funds" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                   {metrics.funds.map((item, i) => (
                     <button
                       key={item.label}
                       type="button"
                       data-testid={`workbench-funds-card-${i}`}
                       onClick={() => handlePanelItemSelect(item.label, `${item.label} 当前为 ${item.value}。资金项需要和换手率、价格方向、龙虎榜/两融数据交叉验证。`)}
                       className="bg-white/[0.03] border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center hover:bg-white/[0.05] transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                     >
                       <span className="text-xs text-neutral-500 mb-2">{item.label}</span>
                       <span className={`text-2xl font-mono font-medium drop-shadow-md ${item.color}`}>
                         {item.value}
                       </span>
                     </button>
                   ))}
                 </motion.div>
               )}

               {activePanelTab === 'quant' && (
                 <motion.div key="quant" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid h-full grid-cols-2 gap-4 p-4">
                   {QUANT_FACTORS.map((factor, i) => (
                     <button
                       key={factor.label}
                       type="button"
                       data-testid={`workbench-quant-card-${i}`}
                       onClick={() => handlePanelItemSelect(factor.label, `${factor.desc} 该因子当前只作为研究辅助，不构成投资建议。`)}
                       className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-left text-indigo-200 transition-colors hover:bg-indigo-500/15 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                     >
                       <span className="block text-[10px] font-mono uppercase tracking-widest text-indigo-300/70">{factor.label}</span>
                       <span className="mt-2 block text-2xl font-mono font-semibold text-indigo-100">{factor.value}</span>
                       <span className="mt-2 block text-[11px] leading-relaxed text-indigo-100/65">{factor.desc}</span>
                     </button>
                   ))}
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
            <div className="relative">
              <button
                data-testid="workbench-analysis-mode"
                onClick={() => setModeMenuOpen((open) => !open)}
                className="flex items-center gap-1.5 px-2 py-1 text-[11px] rounded border border-white/10 bg-black/40 text-neutral-400 hover:text-white transition-colors"
              >
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_5px_rgba(99,102,241,0.5)]"></div>
                {selectedMode.label}
                <ChevronDown className="w-3 h-3 ml-1" />
              </button>
              <AnimatePresence>
                {modeMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    className="absolute right-0 top-8 z-50 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#101010]/95 shadow-2xl backdrop-blur-xl"
                  >
                    {ANALYSIS_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        data-testid={`workbench-mode-${mode.id}`}
                        onClick={() => handleModeChange(mode.id)}
                        className={cn(
                          "w-full px-3 py-3 text-left transition-colors",
                          analysisMode === mode.id ? "bg-indigo-500/10" : "hover:bg-white/[0.04]"
                        )}
                      >
                        <span className="block text-xs font-medium text-neutral-100">{mode.label}</span>
                        <span className="mt-1 block text-[10px] leading-relaxed text-neutral-500">{mode.desc}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button data-testid="workbench-refresh-chart" onClick={handleRefreshChart} className="p-1.5 hover:bg-white/5 rounded-md text-neutral-500 transition-colors" title="刷新行情沙盘">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button data-testid="workbench-fullscreen" onClick={handleFullscreen} className="p-1.5 hover:bg-white/5 rounded-md text-neutral-500 transition-colors" title="切换全屏">
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
                       <p dangerouslySetInnerHTML={{ __html: formatMessageHtml(msg.content) }} />
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
               [系统] 已切换至 {formatStockLabel(currentStock)}
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
              placeholder={`对 ${currentStock.name} 提出分析需求...`} 
              className="w-full bg-transparent p-4 text-sm focus:outline-none text-neutral-200 placeholder:text-neutral-500 resize-none h-24 custom-scrollbar"
            />
            <div className="flex justify-between items-center px-3 pb-3">
              <div className="flex gap-1.5">
                <input ref={fileInputRef} type="file" accept="image/*,.pdf,.txt,.md,.csv" onChange={handleUploadContext} className="hidden" />
                <button
                  data-testid="workbench-upload-context"
                  onClick={() => fileInputRef.current?.click()}
                  title="多模态分析 (上传 K 线截图或本地研报)"
                  className="p-1.5 text-neutral-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-colors"
                >
                  <ImagePlus className="w-4.5 h-4.5" />
                </button>
                <button
                  data-testid="workbench-analysis-settings"
                  onClick={() => setSettingsOpen((open) => !open)}
                  title="分析配置"
                  className="p-1.5 text-neutral-500 hover:text-neutral-300 rounded-md hover:bg-white/5 transition-colors"
                >
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
          <AnimatePresence>
            {settingsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="mt-3 rounded-xl border border-white/10 bg-black/35 p-3 text-xs text-neutral-400"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-medium text-neutral-200">本次分析配置</span>
                  <span className="font-mono text-[10px] text-indigo-300">{selectedMode.label}</span>
                </div>
                <label className="mb-2 flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-white/[0.03] px-3 py-2">
                  <span>自动附带证据链引用</span>
                  <input type="checkbox" checked={autoEvidence} onChange={() => setAutoEvidence((value) => !value)} />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-white/[0.03] px-3 py-2">
                  <span>风险事件优先进入摘要</span>
                  <input type="checkbox" checked={strictRisk} onChange={() => setStrictRisk((value) => !value)} />
                </label>
                {lastUploadedFile && (
                  <p className="mt-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2 text-[11px] text-indigo-100/80">
                    已加载材料：{lastUploadedFile}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
    </motion.div>
  );
}
