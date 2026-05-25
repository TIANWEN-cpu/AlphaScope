import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Bot, Maximize2, RefreshCw, Send, Zap, Clock, LineChart as LineChartIcon, Settings2, Sparkles, ChevronDown, ImagePlus } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ChatMessage } from '../types';
import { api, NewsRecord, PriceBar } from '../lib/api';

const periodToPoints = (period: string) => {
  if (period === '分时') return 60;
  if (period === '周K') return 30;
  if (period === '月K') return 20;
  return 40;
};

const averageClose = (bars: PriceBar[], index: number, window: number) => {
  const start = Math.max(0, index - window + 1);
  const slice = bars.slice(start, index + 1);
  const total = slice.reduce((sum, bar) => sum + Number(bar.close || 0), 0);
  return slice.length ? total / slice.length : Number(bars[index]?.close || 0);
};

const toChartData = (bars: PriceBar[], points = 40) => {
  const sorted = [...bars].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return sorted.slice(-points).map((bar, index, arr) => ({
    date: String(bar.date || '').slice(5) || `${index + 1}`,
    ma5: averageClose(arr, index, 5),
    ma10: averageClose(arr, index, 10),
    ma20: averageClose(arr, index, 20),
    volume: Number(bar.volume || 0),
    up: Number(bar.close || 0) >= Number(bar.open || bar.close || 0),
    close: Number(bar.close || 0),
  }));
};

const EMPTY_FINANCE = [
  { label: '市盈率(TTM)', value: '--', trend: 'up' },
  { label: '市净率(MRQ)', value: '--', trend: 'down' },
  { label: '毛利率', value: '--', trend: 'up' },
  { label: '净利润同比', value: '--', trend: 'up' },
];

const EMPTY_FUNDS = [
  { label: '主力净流入', value: '--', color: 'text-neutral-400' },
  { label: '超大单', value: '--', color: 'text-neutral-400' },
  { label: '大单', value: '--', color: 'text-neutral-400' },
  { label: '中单', value: '--', color: 'text-neutral-400' },
];

const displayNumber = (value: number, digits = 2) =>
  Number.isFinite(value) ? value.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '--';

const formatYi = (value: unknown) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '--';
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}亿`;
};

const mapBackendNews = (items: NewsRecord[]) =>
  items.slice(0, 6).map((item) => ({
    id: item.id,
    time: item.published_at ? item.published_at.slice(11, 16) || item.published_at.slice(0, 10) : '--:--',
    title: item.title,
    desc: item.summary || '',
    source: item.source || '数据源',
    sourceUrl: item.source_url || '',
  }));

const renderMessageHtml = (content: string) =>
  content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<span class="text-white font-medium">$1</span>')
    .replace(/\n/g, '<br/>');

interface WorkbenchProps {
  symbol?: string;
  stockName?: string;
}

type AnalysisMode = 'free' | 'standard' | 'deep' | 'expert' | 'vision';

const ANALYSIS_MODES: Array<{ id: AnalysisMode; label: string; description: string }> = [
  { id: 'free', label: '自由问答', description: '轻量聊天，不强制股票分析链路' },
  { id: 'standard', label: '标准分析', description: '行情、基本面、新闻综合分析' },
  { id: 'deep', label: '深度分析', description: '更完整的多维度推理链路' },
  { id: 'expert', label: '专家协作', description: '多 Agent 协作审查投资逻辑' },
  { id: 'vision', label: '视觉分析', description: '结合 K 线截图或研报图片' },
];

export function Workbench({ symbol = '600519', stockName = '贵州茅台' }: WorkbenchProps) {
  const [activePeriod, setActivePeriod] = useState('日K');
  const [activePanelTab, setActivePanelTab] = useState('news');
  const [chartData, setChartData] = useState<ReturnType<typeof toChartData>>([]);
  const [priceBars, setPriceBars] = useState<PriceBar[]>([]);
  const [latestPrice, setLatestPrice] = useState<PriceBar | null>(null);
  const [financeItems, setFinanceItems] = useState(EMPTY_FINANCE);
  const [fundItems, setFundItems] = useState(EMPTY_FUNDS);
  const [newsItems, setNewsItems] = useState<ReturnType<typeof mapBackendNews>>([]);
  const [factorSummary, setFactorSummary] = useState('多因子Alpha模型等待后端计算...');
  const [dataStatus, setDataStatus] = useState('后端数据待同步');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [selectedMode, setSelectedMode] = useState<AnalysisMode>('standard');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [includeStockContext, setIncludeStockContext] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'agent',
      agentName: 'System',
      content: `欢迎使用 AI-Finance 多 Agent 分析工作台。当前标的：**${stockName}** (${symbol})。请选择分析模式并输入问题。`,
      timestamp: new Date().toISOString(),
    }
  ]);
  const [input, setInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    setChartData([]);
    setPriceBars([]);
    setLatestPrice(null);
    setNewsItems([]);
    setFinanceItems(EMPTY_FINANCE);
    setFundItems(EMPTY_FUNDS);

    async function loadWorkbenchData() {
      setDataStatus(`正在同步 ${stockName} (${symbol}) 后端行情、财务、新闻与因子...`);
      const [pricesResult, latestResult, fundamentalsResult, newsResult, fundFlowResult, factorsResult] = await Promise.allSettled([
        api.prices(symbol, 90),
        api.latestPrice(symbol),
        api.fundamentals(symbol),
        api.news(symbol, 8),
        api.fundFlow(symbol, 30),
        api.factors(symbol, stockName, 60),
      ]);

      if (cancelled) return;

      if (pricesResult.status === 'fulfilled' && pricesResult.value.success && pricesResult.value.data?.bars?.length) {
        const bars = pricesResult.value.data.bars;
        setPriceBars(bars);
        setChartData(toChartData(bars, periodToPoints(activePeriod)));
      }

      if (latestResult.status === 'fulfilled' && latestResult.value.success && latestResult.value.data) {
        setLatestPrice(latestResult.value.data);
      }

      if (fundamentalsResult.status === 'fulfilled' && fundamentalsResult.value.success && fundamentalsResult.value.data) {
        const data = fundamentalsResult.value.data;
        const periods = Array.isArray(data.financial_periods) ? data.financial_periods as Record<string, unknown>[] : [];
        const latest = periods[0] || {};
        const valuation = (data.valuation || {}) as Record<string, unknown>;
        setFinanceItems([
          { label: '市盈率(TTM)', value: String(valuation.pe || valuation.pe_ttm || '--'), trend: 'up' },
          { label: '市净率(MRQ)', value: String(valuation.pb || '--'), trend: 'down' },
          { label: '毛利率', value: latest.gross_margin_pct ? `${Number(latest.gross_margin_pct).toFixed(1)}%` : '--', trend: 'up' },
          { label: '净利润同比', value: latest.yoy_net_profit_pct ? `${Number(latest.yoy_net_profit_pct) >= 0 ? '+' : ''}${Number(latest.yoy_net_profit_pct).toFixed(1)}%` : '--', trend: 'up' },
        ]);
      }

      if (newsResult.status === 'fulfilled' && newsResult.value.success && newsResult.value.data?.news?.length) {
        setNewsItems(mapBackendNews(newsResult.value.data.news));
      } else {
        setNewsItems([]);
      }

      if (fundFlowResult.status === 'fulfilled' && fundFlowResult.value.success && fundFlowResult.value.data) {
        const summary = (fundFlowResult.value.data.summary || {}) as Record<string, unknown>;
        const records = Array.isArray(fundFlowResult.value.data.records) ? fundFlowResult.value.data.records as Record<string, unknown>[] : [];
        const latestRecord = records[records.length - 1] || {};
        setFundItems([
          { label: '主力净流入', value: formatYi(summary.main_net_yi ?? latestRecord.main_net_yi), color: Number(summary.main_net_yi ?? latestRecord.main_net_yi ?? 0) >= 0 ? 'text-rose-500' : 'text-emerald-500' },
          { label: '超大单', value: formatYi(summary.super_net_yi ?? latestRecord.super_net_yi), color: Number(summary.super_net_yi ?? latestRecord.super_net_yi ?? 0) >= 0 ? 'text-rose-500' : 'text-emerald-500' },
          { label: '大单', value: formatYi(summary.large_net_yi ?? latestRecord.large_net_yi), color: Number(summary.large_net_yi ?? latestRecord.large_net_yi ?? 0) >= 0 ? 'text-rose-500' : 'text-emerald-500' },
          { label: '中单', value: formatYi(summary.medium_net_yi ?? latestRecord.medium_net_yi), color: Number(summary.medium_net_yi ?? latestRecord.medium_net_yi ?? 0) >= 0 ? 'text-rose-500' : 'text-emerald-500' },
        ]);
      }

      if (factorsResult.status === 'fulfilled' && factorsResult.value.success && factorsResult.value.data) {
        const factorText = JSON.stringify(factorsResult.value.data, null, 2).slice(0, 500);
        setFactorSummary(factorText || '后端因子接口已返回，但内容为空。');
      } else {
        setFactorSummary('后端因子接口暂不可用，请检查 /api/factors 数据源。');
      }

      const syncedParts = [
        pricesResult.status === 'fulfilled' && pricesResult.value.success && pricesResult.value.data?.bars?.length ? '行情' : '',
        newsResult.status === 'fulfilled' && newsResult.value.success && newsResult.value.data?.news?.length ? '新闻' : '',
        fundamentalsResult.status === 'fulfilled' && fundamentalsResult.value.success ? '财务' : '',
      ].filter(Boolean);
      setDataStatus(syncedParts.length ? `已同步 ${syncedParts.join('、')} 数据` : `暂无 ${stockName} (${symbol}) 后端数据`);
    }

    loadWorkbenchData();
    setMessages([
      {
        id: `${symbol}-system`,
        role: 'agent',
        agentName: 'System',
        content: `欢迎使用 AI-Finance 多 Agent 分析工作台。当前标的：**${stockName}** (${symbol})。请选择分析模式并输入问题。`,
        timestamp: new Date().toISOString(),
      },
    ]);
    setConversationId(undefined);
    setChatError('');

    return () => {
      cancelled = true;
    };
  }, [symbol, stockName]);

  const handlePeriodChange = (period: string) => {
    setActivePeriod(period);
    const points = periodToPoints(period);
    setChartData(priceBars.length ? toChartData(priceBars, points) : []);
  };

  const refreshPrices = async () => {
    setDataStatus(`正在刷新 ${stockName} 行情...`);
    const fetched = await api.priceFetch(symbol, 120);
    if (!fetched.success) {
      setDataStatus(fetched.error || '行情刷新失败');
      return;
    }
    const [pricesResult, latestResult] = await Promise.all([api.prices(symbol, 120), api.latestPrice(symbol)]);
    if (pricesResult.success && pricesResult.data?.bars?.length) {
      setPriceBars(pricesResult.data.bars);
      setChartData(toChartData(pricesResult.data.bars, periodToPoints(activePeriod)));
    } else {
      setPriceBars([]);
      setChartData([]);
    }
    if (latestResult.success && latestResult.data) {
      setLatestPrice(latestResult.data);
    } else {
      setLatestPrice(null);
    }
    setDataStatus(`行情刷新完成：${fetched.data?.fetched || 0} 条`);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      setChatError('');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : '无法切换全屏模式');
    }
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const preview = String(reader.result || '');
      const base64 = preview.split(',')[1] || '';
      if (!base64) {
        setChatError('图片读取失败，请重新选择文件');
        return;
      }

      setChatError('');
      setIsSending(true);
      const responseId = `${Date.now()}-vision`;
      setMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}-upload`,
          role: 'user',
          content: `上传图片：${file.name}`,
          timestamp: new Date().toISOString(),
        },
        {
          id: responseId,
          role: 'agent',
          agentName: 'Vision',
          content: `正在分析图片：**${file.name}**...`,
          timestamp: new Date().toISOString(),
        },
      ]);

      const result = await api.visionReport({
        image_base64: base64,
        mime_type: file.type || 'image/png',
        ticker: includeStockContext ? symbol : undefined,
        user_context: `${stockName} ${symbol} Workbench 多模态分析`,
      });

      if (result.success && result.data?.report) {
        setMessages(prev => prev.map(msg => (
          msg.id === responseId ? { ...msg, content: result.data?.report || '视觉分析完成，但报告为空。' } : msg
        )));
      } else {
        const message = result.error || '视觉分析失败';
        setChatError(message);
        setMessages(prev => prev.map(msg => (
          msg.id === responseId ? { ...msg, content: `视觉分析失败：${message}` } : msg
        )));
      }
      setIsSending(false);
    };
    reader.onerror = () => {
      setChatError('图片读取失败，请重新选择文件');
      setIsSending(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const userInput = input.trim();
    const mode = ANALYSIS_MODES.find(item => item.id === selectedMode);
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userInput,
      timestamp: new Date().toISOString(),
    };

    setChatError('');
    setIsSending(true);
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    const responseId = `${Date.now()}-agent`;
    setMessages(prev => [...prev, {
      id: responseId,
      role: 'agent',
      agentName: 'System',
      content: `任务分发：**${userInput}**\n\n- 当前模式：${mode?.label || '标准分析'}\n- [基本面助理] 正在提取财报数据...\n- [量化策略专家] 正在计算当前因子载荷...\n- [风险合规顾问] 正在检查舆情风险...`,
      timestamp: new Date().toISOString(),
    }]);

    let streamedContent = '';
    try {
      await api.streamChat(
        {
          conversation_id: conversationId,
          message: userInput,
          mode: selectedMode,
          stock_symbol: includeStockContext ? symbol : undefined,
          stock_name: includeStockContext ? stockName : undefined,
        },
        (event) => {
          if (event.type === 'status' && typeof event.data === 'object' && event.data && 'conversation_id' in event.data) {
            setConversationId(String((event.data as Record<string, unknown>).conversation_id));
          }

          if (event.type === 'content' && event.chunk) {
            streamedContent += event.chunk;
            setMessages(prev => prev.map(msg => (
              msg.id === responseId ? { ...msg, content: streamedContent } : msg
            )));
          }

          if (event.type === 'done' && !streamedContent.trim()) {
            setMessages(prev => prev.map(msg => (
              msg.id === responseId
                ? { ...msg, content: '后端已完成本次请求，但没有返回文本内容。请检查模型供应商配置或稍后重试。' }
                : msg
            )));
          }
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '后端分析服务暂不可用';
      setChatError(message);
      setMessages(prev => prev.map(msg => (
        msg.id === responseId
          ? {
              ...msg,
              content: `请求失败：${message}\n\n已保留你的问题：**${userInput}**。请检查后端服务、模型 Provider 或网络连接后重试。`,
            }
          : msg
      )));
    } finally {
      setIsSending(false);
    }
  };

  const currentMode = ANALYSIS_MODES.find(item => item.id === selectedMode) || ANALYSIS_MODES[1];
  const latestChartPoint = chartData[chartData.length - 1];
  const chartValues = chartData.flatMap(point => [Number(point.ma5 || 0), Number(point.ma10 || 0), Number(point.ma20 || 0)]).filter(Number.isFinite);
  const chartHigh = chartValues.length ? Math.max(...chartValues) : 0;
  const chartLow = chartValues.length ? Math.min(...chartValues) : 0;
  const hasPriceData = Boolean(latestPrice || latestChartPoint);
  const currentClose = latestPrice?.close || latestChartPoint?.close || latestChartPoint?.ma20 || 0;
  const currentChange = latestPrice?.change_pct ?? 0;
  const isPriceUp = Number(currentChange) >= 0;

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
            {stockName}
            <span className="text-xs font-mono font-medium text-neutral-400 bg-white/[0.03] px-2.5 py-1 rounded border border-white/5 tracking-wider">{symbol}</span>
          </h1>
          <div className={cn("flex items-baseline gap-4", isPriceUp ? "text-rose-500" : "text-emerald-500")}>
            <span className="text-4xl font-mono font-medium tracking-tight drop-shadow-[0_0_15px_rgba(244,63,94,0.3)]">{hasPriceData ? displayNumber(Number(currentClose)) : '--'}</span>
            <span className={cn(
              "text-sm font-mono font-medium flex items-center px-2 py-0.5 rounded border",
              !hasPriceData ? "bg-white/5 border-white/10 text-neutral-500" : isPriceUp ? "bg-rose-500/10 border-rose-500/20 text-rose-500" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
            )}>
              {hasPriceData ? (
                <>
                  <span className="rotate-45 mr-1 text-lg leading-none">{isPriceUp ? '↗' : '↙'}</span>{Number(currentChange) >= 0 ? '+' : ''}{Number(currentChange).toFixed(2)}%
                </>
              ) : '等待行情'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {financeItems.slice(0, 4).map((item, i) => (
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
                 <span className="text-[10px] font-mono text-neutral-500">{dataStatus}</span>
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
                <button
                  onClick={refreshPrices}
                  title="刷新后端行情"
                  className="px-3 py-1.5 text-xs rounded-md font-medium transition-all cursor-pointer text-neutral-500 hover:text-indigo-300 border border-transparent"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-3 flex items-center gap-8 text-[11px] font-mono whitespace-nowrap bg-black/20 border-b border-white/5">
               <span className="text-yellow-500/90 flex items-center gap-2"><div className="w-2 h-0.5 bg-yellow-500/90"></div>MA5: {latestChartPoint ? displayNumber(Number(latestChartPoint.ma5 || 0)) : '--'}</span>
               <span className="text-indigo-400/90 flex items-center gap-2"><div className="w-2 h-0.5 bg-indigo-400/90"></div>MA10: {latestChartPoint ? displayNumber(Number(latestChartPoint.ma10 || 0)) : '--'}</span>
               <span className="text-emerald-400/90 flex items-center gap-2"><div className="w-2 h-0.5 bg-emerald-400/90"></div>MA20: {latestChartPoint ? displayNumber(Number(latestChartPoint.ma20 || 0)) : '--'}</span>
               <span className="text-neutral-500 ml-auto">{priceBars.length ? `VOL: ${Number(latestChartPoint?.volume || 0).toLocaleString('zh-CN')}` : '等待后端行情'}</span>
            </div>

             {/* Chart Area */}
             <div className="flex-1 p-5 bg-black/40 relative">
                <div className="absolute right-6 top-6 text-[10px] font-mono text-neutral-600">{displayNumber(chartHigh)}</div>
                <div className="absolute right-6 bottom-24 text-[10px] font-mono text-neutral-600">{displayNumber(chartLow)}</div>
               {chartData.length === 0 && (
                 <div className="absolute inset-0 z-10 flex items-center justify-center text-center text-xs text-neutral-500 bg-black/20">
                   暂无后端行情数据，请点击刷新或稍后重试。
                 </div>
               )}
             
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
                 {/* Compact volume-like bars under the moving averages */}
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
                    {newsItems.length === 0 ? (
                      <div className="h-full min-h-[220px] flex items-center justify-center text-center text-xs text-neutral-500">
                        暂无后端新闻数据，请点击刷新或稍后重试。
                      </div>
                    ) : newsItems.map((news, i) => (
                      <div
                        key={i}
                        onClick={() => news.sourceUrl && window.open(news.sourceUrl, '_blank', 'noopener,noreferrer')}
                       className="px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer group"
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
                           {news.sourceUrl && <span className="text-[10px] text-indigo-400 mt-1 inline-block">打开原文 ↗</span>}
                           {news.desc && <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">{news.desc}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

               {activePanelTab === 'finance' && (
                 <motion.div key="finance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                   {financeItems.map((item, i) => (
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
                   {fundItems.map((item, i) => (
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
                   <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-4 py-3 rounded-lg text-xs flex items-start gap-3 max-w-3xl whitespace-pre-wrap font-mono leading-relaxed">
                     <Settings2 className="w-5 h-5" />
                     {factorSummary}
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
            <div className="relative">
              <button
                onClick={() => setShowModeMenu(prev => !prev)}
                className="flex items-center gap-1.5 px-2 py-1 text-[11px] rounded border border-white/10 bg-black/40 text-neutral-400 hover:text-white transition-colors"
              >
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_5px_rgba(99,102,241,0.5)]"></div>
                {currentMode.label}
                <ChevronDown className="w-3 h-3 ml-1" />
              </button>
              <AnimatePresence>
                {showModeMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute right-0 top-8 w-56 rounded-xl border border-white/10 bg-neutral-950/95 p-1.5 shadow-2xl backdrop-blur z-30"
                  >
                    {ANALYSIS_MODES.map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => {
                          setSelectedMode(mode.id);
                          setShowModeMenu(false);
                        }}
                        className={cn(
                          "w-full rounded-lg px-3 py-2 text-left transition-colors",
                          selectedMode === mode.id ? "bg-indigo-500/15 text-indigo-200" : "text-neutral-400 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <div className="text-xs font-medium">{mode.label}</div>
                        <div className="mt-0.5 text-[10px] text-neutral-500">{mode.description}</div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button onClick={refreshPrices} title="刷新行情与面板数据" className="p-1.5 hover:bg-white/5 rounded-md text-neutral-500 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={toggleFullscreen} title="切换全屏" className="p-1.5 hover:bg-white/5 rounded-md text-neutral-500 transition-colors">
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
                       <p dangerouslySetInnerHTML={{ __html: renderMessageHtml(msg.content) }} />
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
               [系统] 已切换至 {stockName} ({symbol})
             </span>
          </motion.div>
        </div>
        
        <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-md relative z-10">
          <AnimatePresence>
            {chatError && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="mb-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
              >
                {chatError}
              </motion.div>
            )}
            {showConfigPanel && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="mb-3 rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-neutral-300"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-neutral-200">分析配置</span>
                  <span className="text-[10px] text-neutral-500">{currentMode.label}</span>
                </div>
                <label className="flex items-center justify-between gap-4 rounded-lg bg-white/[0.03] px-3 py-2">
                  <span>
                    <span className="block text-neutral-300">携带当前股票上下文</span>
                    <span className="text-[10px] text-neutral-500">{stockName} ({symbol})</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={includeStockContext}
                    onChange={event => setIncludeStockContext(event.target.checked)}
                    className="h-4 w-4 accent-indigo-500"
                  />
                </label>
              </motion.div>
            )}
          </AnimatePresence>
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
              disabled={isSending}
              placeholder={`对 ${stockName} 提出分析需求...`}
              className="w-full bg-transparent p-4 text-sm focus:outline-none text-neutral-200 placeholder:text-neutral-500 resize-none h-24 custom-scrollbar disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="flex justify-between items-center px-3 pb-3">
              <div className="flex gap-1.5">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <button
                  title="多模态分析 (上传 K 线截图或本地研报)"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending}
                  className="p-1.5 text-neutral-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ImagePlus className="w-4.5 h-4.5" />
                </button>
                <button
                  title="分析配置"
                  onClick={() => setShowConfigPanel(prev => !prev)}
                  className={cn(
                    "p-1.5 text-neutral-500 hover:text-neutral-300 rounded-md hover:bg-white/5 transition-colors",
                    showConfigPanel && "bg-white/10 text-neutral-200"
                  )}
                >
                  <Settings2 className="w-4.5 h-4.5" />
                </button>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-mono text-neutral-500">
                <span>{isSending ? '正在请求后端...' : 'ENTER 发送 • SHIFT+ENTER 换行'}</span>
                <button
                  onClick={handleSend}
                  disabled={isSending || !input.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg border border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSending ? '处理中' : '发送'} <Send className="w-3.5 h-3.5" />
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
