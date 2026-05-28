import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Newspaper, 
  Search, 
  TrendingUp, 
  Flame, 
  Calendar, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  Filter, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  Gauge, 
  Globe, 
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AnnouncementRecord, api, NewsRecord, normalizeDisplayError, PriceBar } from '../lib/api';

interface NewsItem {
  id: string;
  time: string;
  title: string;
  category: 'macro' | 'announcement' | 'risk' | 'funds';
  source: string;
  severity: 'high' | 'medium' | 'info';
  sentiment: 'bullish' | 'bearish' | 'neutral';
  impactScore: number;
  content: string;
  aiSummary: string;
  sourceUrl?: string;
  publishedAt?: string;
  degradedFrom?: string;
}

interface NewsAggregatorProps {
  symbol?: string;
  stockName?: string;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

const includesAny = (value: string, keywords: string[]) =>
  keywords.some(keyword => value.includes(keyword.toLowerCase()));

const categoryFromEventType = (
  eventType?: string,
  title = '',
  summary = '',
  source = '',
): NewsItem['category'] => {
  const value = (eventType || '').toLowerCase();
  if (value.includes('announce') || value.includes('公告') || value.includes('report')) return 'announcement';
  if (value.includes('risk') || value.includes('风险')) return 'risk';
  if (value.includes('fund') || value.includes('flow') || value.includes('资金')) return 'funds';
  const text = `${title} ${summary} ${source}`.toLowerCase();
  if (includesAny(text, ['公告', '披露', '续签', '股东', '董事会', '监事会', '回购', '分红', '业绩', '商标许可', '权益变动', '停复牌'])) return 'announcement';
  if (includesAny(text, ['主力', '资金', '净流入', '净流出', '大单', '超大单', '北向', '南向', '融资融券', '出逃'])) return 'funds';
  if (includesAny(text, ['风险', '下跌', '减持', '处罚', '亏损', '预亏', '诉讼', '监管', '违约', '退市', '暴跌', '出逃'])) return 'risk';
  return 'macro';
};

const sentimentFromScore = (score?: number): NewsItem['sentiment'] => {
  const value = Number(score || 0);
  if (value > 0.15) return 'bullish';
  if (value < -0.15) return 'bearish';
  return 'neutral';
};

const severityFromImportance = (importance?: number): NewsItem['severity'] => {
  const value = Number(importance || 0);
  if (value >= 0.8) return 'high';
  if (value >= 0.5) return 'medium';
  return 'info';
};

const displayTime = (value?: string) => {
  if (!value) return '--:--';
  return value.slice(11, 16) || value.slice(0, 10);
};

const getApiFailure = (label: string, result: PromiseSettledResult<{ success: boolean; error?: string | null; message?: string | null }>) => {
  if (result.status === 'rejected') {
    return `${label}请求失败：${normalizeDisplayError(result.reason, '未知错误')}`;
  }
  if (!result.value.success) {
    return `${label}接口失败：${normalizeDisplayError(result.value.error || result.value.message, '未知错误')}`;
  }
  return '';
};

const displayNumber = (value: number, digits = 2) =>
  Number.isFinite(value)
    ? value.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits })
    : '--';

const formatChangePct = (value?: number) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

const sentimentLabel = (sentiment: NewsItem['sentiment']) => {
  if (sentiment === 'bullish') return '利好';
  if (sentiment === 'bearish') return '偏空';
  return '中性';
};

const severityLabel = (severity: NewsItem['severity']) => {
  if (severity === 'high') return '高重要性';
  if (severity === 'medium') return '中等重要性';
  return '一般重要性';
};

const mapNewsRecord = (item: NewsRecord): NewsItem => ({
  id: item.id,
  time: displayTime(item.published_at),
  title: item.title,
  category: categoryFromEventType(item.event_type, item.title, item.summary || '', item.source || ''),
  source: item.source || '数据源',
  severity: severityFromImportance(item.importance),
  sentiment: sentimentFromScore(item.sentiment),
  impactScore: Math.round(Number(item.importance || item.confidence || 0.5) * 100),
  content: item.summary || item.title,
  aiSummary: item.summary || '该事件已进入 AI-Finance 舆情与事件分析通道，等待更多交叉信源验证。',
  sourceUrl: item.source_url,
  publishedAt: item.published_at,
});

const newsItemIdentity = (item: NewsItem) =>
  [
    item.category,
    item.id,
    item.source,
    item.publishedAt || item.time,
  ].filter(Boolean).join(':');

const newsItemKey = (item: NewsItem, index: number) =>
  `${newsItemIdentity(item)}:${index}`;

const mapRelatedNewsFallback = (item: NewsRecord): NewsItem => ({
  ...mapNewsRecord(item),
  category: 'announcement',
  degradedFrom: '公告源降级，使用相关新闻替代',
  aiSummary: item.summary || '公告源当前不可用，该条为后端 related_news 降级替代结果，需人工确认是否等同正式公告。',
});

const mapAnnouncementRecord = (item: AnnouncementRecord): NewsItem => ({
  id: item.id,
  time: displayTime(item.published_at),
  title: item.title,
  category: 'announcement',
  source: item.source || item.company_name || '公司公告',
  severity: severityFromImportance(item.importance),
  sentiment: 'neutral',
  impactScore: Math.round(Number(item.importance || item.confidence || 0.6) * 100),
  content: `${item.company_name || item.symbol || ''} ${item.category || ''}`.trim() || item.title,
  aiSummary: '公告已接入事件通道，可进一步结合价格、资金流和基本面数据进行影响归因。',
  sourceUrl: item.source_url,
  publishedAt: item.published_at,
});

const DEMO_MARKET_TICKERS = [
  { label: '恒生指数', value: '19,252.12', change: '-0.34%', direction: 'down' },
  { label: '沪深300', value: '3,654.40', change: '+0.48%', direction: 'up' },
  { label: '美债10年期', value: '4.425%', change: '+0.035', direction: 'up' },
  { label: '大基金三期3440亿', value: '超级事件', change: '参考', direction: 'flat' },
  { label: '黄金（盎司）', value: '2,425.80', change: '-0.15%', direction: 'down' },
] as const;

const DEMO_CALENDAR_EVENTS = [
  { time: '16:00', title: '欧元区 4月 核心物价调和指数（HICP）', importance: '★★★☆☆', status: '已公布', preview: '预期 2.7% | 实际 2.6%', impact: '中性偏好' },
  { time: '20:30', title: '美国 4月 PCE 物价指数核心指标（年率）', importance: '★★★★★', status: '未公布', preview: '前值 2.8% | 预测值 2.7%', impact: '高瞻性催化' },
  { time: '21:00', title: '美联储沃勒、雷曼等委员对货币政策答疑', importance: '★★★★☆', status: '未公布', preview: '政策口径寻踪，寻找下半年降息坐标', impact: '流动性突变' }
];

export function NewsAggregator({ symbol = '600519', stockName = '贵州茅台' }: NewsAggregatorProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);
  const [isAiExpanded, setIsAiExpanded] = useState<boolean>(true);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newsState, setNewsState] = useState<LoadState>('idle');
  const [priceState, setPriceState] = useState<LoadState>('idle');
  const [refreshTick, setRefreshTick] = useState(0);
  const [dataStatus, setDataStatus] = useState('等待同步后端资讯');
  const [latestPrice, setLatestPrice] = useState<PriceBar | null>(null);
  const [priceStatus, setPriceStatus] = useState('行情待同步');
  const [newsSymbol, setNewsSymbol] = useState<string | null>(null);
  const newsRequestRef = useRef(0);
  const priceRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const detailRequestRef = useRef(0);

  useEffect(() => {
    const requestId = newsRequestRef.current + 1;
    newsRequestRef.current = requestId;
    searchRequestRef.current += 1;
    detailRequestRef.current += 1;
    const controller = new AbortController();
    const isCurrent = () => newsRequestRef.current === requestId && !controller.signal.aborted;

    async function loadNews() {
      const keepCurrentNews = newsSymbol === symbol && news.length > 0;
      setIsLoading(true);
      setNewsState('loading');
      if (!keepCurrentNews) {
        setNews([]);
        setSelectedArticle(null);
        setNewsSymbol(null);
      }
      setDataStatus(`正在同步 ${stockName} (${symbol}) 新闻与公告...`);
      try {
        const nextItems: NewsItem[] = [];
        const failures: string[] = [];

        const newsResult = await api.news(symbol, 30, { signal: controller.signal });
        if (!isCurrent()) return;
        if (newsResult.success && newsResult.data?.news?.length) {
          nextItems.push(...newsResult.data.news.map(mapNewsRecord));
          setNews(nextItems);
          setSelectedArticle(nextItems[0]);
          setNewsSymbol(symbol);
          setNewsState('ready');
          setDataStatus(`已接入 ${nextItems.length} 条后端新闻，正在补充公告通道...`);
        } else if (!newsResult.success) {
          failures.push(`新闻接口失败：${normalizeDisplayError(newsResult.error || newsResult.message, '未知错误')}`);
        }

        const announcementResult = await api.announcements(symbol, 12, { signal: controller.signal });
        if (!isCurrent()) return;
        if (announcementResult.success && announcementResult.data?.announcements?.length) {
          nextItems.push(...announcementResult.data.announcements.map(mapAnnouncementRecord));
        } else if (
          announcementResult.success
          && announcementResult.data?.degraded
          && announcementResult.data.related_news?.length
        ) {
          nextItems.push(...announcementResult.data.related_news.map(mapRelatedNewsFallback));
          failures.push(`公告源降级：${normalizeDisplayError(announcementResult.error || announcementResult.data.source_status, '使用相关新闻替代')}`);
        } else if (!announcementResult.success) {
          failures.push(`公告接口失败：${normalizeDisplayError(announcementResult.error || announcementResult.message, '未知错误')}`);
        }

        if (nextItems.length) {
          setNews(nextItems);
          setSelectedArticle(nextItems[0]);
          setNewsSymbol(symbol);
          setDataStatus(
            failures.length
              ? `已接入 ${nextItems.length} 条后端新闻/公告；部分通道异常：${failures.join('；')}`
              : `已接入 ${nextItems.length} 条后端新闻/公告`,
          );
          setNewsState('ready');
        } else {
          if (keepCurrentNews) {
            setNewsState('ready');
            setDataStatus(
              failures.length
                ? `后端资讯同步失败，已保留上次成功结果：${failures.join('；')}`
                : `后端暂无最新 ${stockName} (${symbol}) 新闻或公告，已保留上次成功结果`,
            );
          } else {
            setNews([]);
            setSelectedArticle(null);
            setNewsSymbol(symbol);
            setNewsState(failures.length ? 'error' : 'empty');
            setDataStatus(
              failures.length
                ? `后端资讯同步失败：${failures.join('；')}`
                : `后端暂无 ${stockName} (${symbol}) 新闻或公告`,
            );
          }
        }
      } catch (error) {
        if (isCurrent()) {
          if (keepCurrentNews) {
            setNewsState('ready');
            setDataStatus(`后端资讯同步异常，已保留上次成功结果：${normalizeDisplayError(error, '后端资讯同步异常')}`);
          } else {
            setNews([]);
            setSelectedArticle(null);
            setNewsSymbol(symbol);
            setNewsState('error');
            setDataStatus(`后端资讯同步异常：${normalizeDisplayError(error, '后端资讯同步异常')}`);
          }
        }
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    }

    loadNews();
    return () => {
      controller.abort();
    };
  }, [symbol, stockName, refreshTick]);

  useEffect(() => {
    const requestId = priceRequestRef.current + 1;
    priceRequestRef.current = requestId;
    const controller = new AbortController();
    const isCurrent = () => priceRequestRef.current === requestId && !controller.signal.aborted;

    async function loadLatestPrice() {
      setPriceState('loading');
      setLatestPrice(null);
      setPriceStatus(`正在同步 ${stockName} (${symbol}) 最新行情...`);
      const result = await api.latestPrice(symbol, { signal: controller.signal });
      if (!isCurrent()) return;
      if (result.success && result.data) {
        setLatestPrice(result.data);
        setPriceStatus(`行情已同步：${result.data.date || result.data.source || symbol}`);
        setPriceState('ready');
      } else {
        setLatestPrice(null);
        setPriceState(result.success ? 'empty' : 'error');
        setPriceStatus(normalizeDisplayError(result.error, `暂无 ${stockName} (${symbol}) 最新行情`));
      }
    }

    loadLatestPrice();
    return () => {
      controller.abort();
    };
  }, [symbol, stockName, refreshTick]);

  const openOriginal = (item: NewsItem | null) => {
    if (!item?.sourceUrl) return;
    window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
  };

  const selectArticle = async (item: NewsItem) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setSelectedArticle(item);
    if (item.category === 'announcement') {
      setDataStatus(`已选择公告：${item.title}`);
      return;
    }

    setDataStatus(`正在加载新闻详情：${item.title}`);
    const detail = await api.newsDetail(item.id);
    if (detailRequestRef.current !== requestId) return;
    if (detail.success && detail.data) {
      const mapped = mapNewsRecord(detail.data);
      setSelectedArticle(mapped);
      setNews(prev => prev.map(newsItem => newsItem.id === mapped.id ? mapped : newsItem));
      setDataStatus(`已加载新闻详情：${mapped.title}`);
    } else {
      setDataStatus(normalizeDisplayError(detail.error, `新闻详情加载失败：${item.title}`));
    }
  };

  const runSearch = async () => {
    newsRequestRef.current += 1;
    detailRequestRef.current += 1;
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    const query = searchQuery.trim();
    if (!query) {
      setRefreshTick(tick => tick + 1);
      return;
    }

    setIsLoading(true);
    setNewsState('loading');
    setDataStatus(`正在后端全文检索：${query}`);
    try {
      const result = await api.newsSearch(query, 30);
      if (searchRequestRef.current !== requestId) return;
      if (result.success && result.data?.results?.length) {
        const nextItems = result.data.results.map(mapNewsRecord);
        setNews(nextItems);
        setSelectedArticle(nextItems[0]);
        setSelectedCategory('all');
        setNewsState('ready');
        setDataStatus(`检索完成：${nextItems.length} 条匹配资讯`);
      } else if (result.success) {
        setNews([]);
        setSelectedArticle(null);
        setSelectedCategory('all');
        setNewsState('empty');
        setDataStatus(`后端未检索到 "${query}" 的匹配资讯`);
      } else {
        setNewsState(news.length ? 'ready' : 'error');
        setDataStatus(normalizeDisplayError(result.error, `后端全文检索失败："${query}"，当前列表未更新`));
      }
    } finally {
      if (searchRequestRef.current === requestId) setIsLoading(false);
    }
  };

  const filterCategories = [
    { id: 'all', label: '全部资讯', count: news.length },
    { id: 'macro', label: '宏观大势', count: news.filter(n => n.category === 'macro').length },
    { id: 'announcement', label: '个股公告', count: news.filter(n => n.category === 'announcement').length },
    { id: 'risk', label: '风控与舆情', count: news.filter(n => n.category === 'risk').length },
    { id: 'funds', label: '主力异动', count: news.filter(n => n.category === 'funds').length }
  ];

  const filteredNews = news.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.source.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  const sourceCount = new Set(news.map(item => item.source).filter(Boolean)).size;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="p-6 lg:p-8 max-w-[1600px] mx-auto text-neutral-300 flex flex-col h-full overflow-hidden"
    >
      {/* Real-time Ticker */}
      <div className="w-full bg-indigo-500/5 min-h-[38px] border border-indigo-500/10 rounded-xl px-4 flex items-center justify-between mb-6 overflow-hidden relative group">
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#050505] to-transparent pointer-events-none z-10" />
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#050505] to-transparent pointer-events-none z-10" />
        <div className="flex gap-1.5 items-center bg-indigo-600/20 px-2.5 py-0.5 rounded text-[10px] font-mono tracking-widest text-indigo-400 border border-indigo-500/20 relative z-20 flex-shrink-0 animate-pulse">
          <Flame className="w-3.5 h-3.5" /> HOT
        </div>
        
        <div className="flex-1 overflow-hidden relative mx-6 flex items-center">
          <div className="animate-[marquee_25s_linear_infinite] whitespace-nowrap flex gap-12 text-[11px] font-mono font-medium text-neutral-400">
            {DEMO_MARKET_TICKERS.map(ticker => (
              <span key={ticker.label} className="flex items-center gap-2">
                {ticker.label} {ticker.value}
                <span className="text-yellow-400 px-1 rounded bg-yellow-400/10 border border-yellow-400/20 font-sans font-normal text-[9px]">演示</span>
                <span className={cn(
                  "flex items-center",
                  ticker.direction === 'down' ? "text-emerald-500" : ticker.direction === 'up' ? "text-rose-500" : "text-indigo-400"
                )}>
                  {ticker.direction === 'down' ? <ArrowDownRight className="w-3 h-3" /> : ticker.direction === 'up' ? <ArrowUpRight className="w-3 h-3" /> : null}
                  {ticker.change}
                </span>
              </span>
            ))}
            <span className="flex items-center gap-2">
              {stockName} ({symbol})
              {latestPrice ? (
                <>
                  {displayNumber(Number(latestPrice.close))}
                  <span className={cn(
                    "flex items-center",
                    Number(latestPrice.change_pct || 0) >= 0 ? "text-rose-500" : "text-emerald-500"
                  )}>
                    {Number(latestPrice.change_pct || 0) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {formatChangePct(latestPrice.change_pct)}
                  </span>
                </>
              ) : (
                <span className="text-neutral-500">{priceState === 'loading' ? '正在同步行情' : '暂无后端行情'}</span>
              )}
            </span>
          </div>
        </div>

        <div className="text-[10px] font-mono text-neutral-500 flex-shrink-0 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> {priceStatus}
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0 overflow-hidden">
        {/* News Feed - Takes 2 Columns */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          
          {/* Header Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-display font-medium text-white flex items-center gap-3">
                <Newspaper className="w-6.5 h-6.5 text-indigo-400" />
                数据源终端聚合
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <p className="text-xs text-neutral-500 font-mono">{dataStatus}</p>
                <span className={cn(
                  "text-[10px] font-mono px-2 py-0.5 rounded border",
                  sourceCount > 0
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-white/[0.03] border-white/10 text-neutral-500"
                )}>
                  后端信源 {sourceCount}
                </span>
              </div>
            </div>

            {/* Simple Search */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64 max-w-sm">
                <input
                  type="text"
                  placeholder="搜索重要标题或要素..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') runSearch();
                  }}
                  className="w-full bg-white/[0.02] border border-white-5 focus:border-indigo-500/50 focus:outline-none rounded-xl py-2 pl-9 pr-4 text-xs text-neutral-200 placeholder:text-neutral-500 transition-all font-sans"
                />
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
              </div>
              <button
                onClick={runSearch}
                disabled={isLoading}
                className="px-3 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium border border-indigo-500 flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" /> 检索
              </button>
              <button
                onClick={() => setRefreshTick(tick => tick + 1)}
                disabled={isLoading}
                title="刷新后端资讯"
                className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-neutral-400 disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin text-indigo-400")} />
              </button>
            </div>
          </div>

          {/* Categories Pill Scroller */}
          <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar flex-shrink-0">
            {filterCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
                  selectedCategory === cat.id 
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]" 
                    : "bg-white/[0.02] border-white/5 text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                )}
              >
                {cat.label}
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md font-mono text-[9px] font-bold",
                  selectedCategory === cat.id ? "bg-indigo-700 text-indigo-100" : "bg-white/5 text-neutral-500"
                )}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* Main Feed Container */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar bg-black/10 rounded-2xl border border-white/5 p-4 relative min-h-0">
            <AnimatePresence mode="popLayout">
              {filteredNews.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="h-full flex flex-col justify-center items-center text-center p-8 text-neutral-500 font-mono text-xs gap-3"
                >
                  <Filter className="w-10 h-10 text-neutral-600 animate-pulse" />
                  {newsState === 'loading'
                    ? `正在同步 ${stockName} (${symbol}) 新闻与公告...`
                    : newsState === 'error'
                      ? '后端资讯服务暂时无响应，请稍后刷新重试。'
                      : news.length === 0
                        ? `后端暂无 ${stockName} (${symbol}) 新闻或公告。`
                        : `未能检索到包含关键字 "${searchQuery}" 的核心公告或数据，请重置过滤项。`}
                  {newsState !== 'loading' && (
                    <button
                      type="button"
                      onClick={() => setRefreshTick(tick => tick + 1)}
                      className="mt-2 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-neutral-300 transition-colors hover:bg-white/[0.08]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      重新同步
                    </button>
                  )}
                </motion.div>
              ) : (
                filteredNews.map((item, idx) => {
                  const isCurSelected = selectedArticle ? newsItemIdentity(selectedArticle) === newsItemIdentity(item) : false;
                  return (
                    <motion.div
                      key={newsItemKey(item, idx)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      onClick={() => selectArticle(item)}
                      className={cn(
                        "p-4 mb-4 rounded-xl border transition-all cursor-pointer flex gap-4 relative group",
                        isCurSelected 
                          ? "bg-indigo-500/10 border-indigo-500/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" 
                          : "bg-white/[0.01] border-white/5 hover:border-white/15 hover:bg-white/[0.03]"
                      )}
                    >
                      {/* Left Badge Indicator Column */}
                      <div className="flex flex-col gap-2 items-center flex-shrink-0 w-12 text-center border-r border-white/5 pr-3">
                        <span className="text-xs font-mono font-medium text-neutral-400 group-hover:text-neutral-300">{item.time}</span>
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          item.severity === 'high' ? "bg-rose-500 animate-[pulse_1.5s_infinite] shadow-[0_0_8px_rgb(244,63,94)]" : "bg-neutral-500"
                        )} />
                        
                        <div className={cn(
                          "text-[9px] font-mono uppercase px-1 py-0.5 rounded-sm shrink-0 border mt-1",
                          item.sentiment === 'bullish' ? 'bg-rose-950/20 border-rose-500/20 text-rose-400' :
                          item.sentiment === 'bearish' ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400' :
                          'bg-neutral-900 border-white/5 text-neutral-500'
                        )}>
                          {item.sentiment === 'bullish' ? '利好' : item.sentiment === 'bearish' ? '偏空' : '中性'}
                        </div>
                      </div>

                      {/* Title / Description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="text-[10px] uppercase font-mono font-bold tracking-wider rounded px-1.5 py-0.5 bg-white/5 border border-white/10 text-indigo-400">
                            {item.source}
                          </span>
                          {item.degradedFrom && (
                            <span className="text-[10px] font-mono rounded px-1.5 py-0.5 bg-yellow-400/10 border border-yellow-400/20 text-yellow-300">
                              降级替代
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-neutral-500 flex items-center gap-1">
                            影响因子: <span className={cn(
                              "font-bold",
                              item.impactScore >= 80 ? "text-rose-400" : "text-indigo-400"
                            )}>{item.impactScore}%</span>
                          </span>
                        </div>
                        <h3 className="text-sm text-neutral-100 font-medium leading-relaxed group-hover:text-indigo-300 transition-colors mb-1.5">
                          {item.title}
                        </h3>
                        <p className="text-xs text-neutral-400 leading-relaxed max-w-3xl line-clamp-2">
                          {item.content}
                        </p>
                      </div>

                      {/* Right subtle arrow */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 group-hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                        {item.sourceUrl && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              openOriginal(item);
                            }}
                            className="px-2 py-1 rounded-md bg-black/50 border border-white/10 text-[10px] text-neutral-300 hover:text-white hover:border-indigo-500/40"
                          >
                            原文
                          </button>
                        )}
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Dynamic Detail Panel / Calendar Right Column */}
        <div className="flex flex-col gap-6 h-full min-h-0 overflow-hidden">
          
          {/* Main Top Drawer: AI News Smart Analyzer */}
          <div className={cn(
            "bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col relative overflow-hidden transition-all duration-300 shadow-lg",
            isAiExpanded ? "flex-[3] min-h-[220px]" : "h-[64px] flex-shrink-0"
          )}>
            <div className="absolute top-0 left-0 right-0 h-32 bg-indigo-500/10 blur-[40px] pointer-events-none" />
            
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5 select-none relative z-10 flex-shrink-0">
              <div 
                className="flex gap-2.5 items-center cursor-pointer group" 
                onClick={() => {
                  setIsAiExpanded(!isAiExpanded);
                  if (!isAiExpanded) setIsCalendarExpanded(true);
                }}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-all">
                  <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-200 group-hover:text-white transition-colors">AI 舆情深度透析</h3>
                  <p className="text-[9px] font-mono uppercase text-neutral-500 tracking-wider">Mouthpiece Semantic Engine</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsAiExpanded(!isAiExpanded);
                  if (!isAiExpanded) setIsCalendarExpanded(true);
                }}
                className="w-7 h-7 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition-all"
                title={isAiExpanded ? "折叠面板" : "展开面板"}
              >
                {isAiExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <div className={cn(
              "flex-1 overflow-y-auto custom-scrollbar relative z-10 text-xs text-neutral-400 leading-relaxed pr-1 transition-all duration-300 min-h-0",
              !isAiExpanded && "opacity-0 pointer-events-none scale-95"
            )}>
              <AnimatePresence mode="wait">
                {selectedArticle ? (
                  <motion.div 
                    key={selectedArticle.id}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="bg-black/30 border border-white/5 rounded-xl p-3">
                      <span className="text-[10px] uppercase font-mono text-neutral-500 block mb-1">选定信源</span>
                      <p className="text-xs text-neutral-200 font-medium">{selectedArticle.title}</p>
                      {selectedArticle.degradedFrom && (
                        <p className="mt-2 text-[10px] text-yellow-300 font-mono">{selectedArticle.degradedFrom}</p>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-[10px] font-mono text-neutral-500">
                          {selectedArticle.publishedAt || selectedArticle.time} · {selectedArticle.source}
                        </span>
                        <button
                          onClick={() => openOriginal(selectedArticle)}
                          disabled={!selectedArticle.sourceUrl}
                          className="ml-auto px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-neutral-300 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <Globe className="w-3 h-3" /> 打开原文
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-neutral-300 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> 后端字段评估
                      </h4>
                      <p className="text-xs text-neutral-400">
                        当前仅基于后端返回的 importance、confidence 与 sentiment 字段展示：
                        <strong className="text-white font-medium">{severityLabel(selectedArticle.severity)}</strong>
                        ，情绪方向为
                        <strong className="text-white font-medium">{sentimentLabel(selectedArticle.sentiment)}</strong>
                        ，影响分 {selectedArticle.impactScore}%。
                      </p>
                    </div>

                    <div className="space-y-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4">
                      <h4 className="font-semibold text-neutral-200 flex items-center gap-1.5 text-xs text-indigo-300">
                        <Sparkles className="w-3.5 h-3.5" /> 后端摘要与待接入归因
                        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 font-mono">量化归因待接入</span>
                      </h4>
                      <p className="text-xs leading-relaxed text-indigo-100 italic">
                        "{selectedArticle.aiSummary}"
                      </p>
                    </div>

                    <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-3 text-center">
                      <div className="p-2 bg-black/20 rounded-lg">
                        <span className="text-[10px] font-mono text-neutral-500 block">后端影响分</span>
                        <span className="text-xs font-mono font-medium text-emerald-400">{selectedArticle.impactScore}%</span>
                      </div>
                      <div className="p-2 bg-black/20 rounded-lg">
                        <span className="text-[10px] font-mono text-neutral-500 block">量化因子归因</span>
                        <span className="text-xs font-mono font-medium text-yellow-400">待接入</span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center text-center text-neutral-500 font-sans gap-2 py-8"
                  >
                    <Gauge className="w-8 h-8 text-neutral-600 animate-pulse" />
                    <p className="text-[11px]">请在左侧列表中点击单个新闻或情报公告，以启动大语言模型分析及投研归因评估。</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom Card: Economic Calendar (财经日历) */}
          <div className={cn(
            "bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col shadow-lg transition-all duration-300 overflow-hidden relative",
            isCalendarExpanded ? "flex-[2] min-h-[180px]" : "h-[64px] flex-shrink-0"
          )}>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5 select-none relative z-10 flex-shrink-0">
              <div 
                className="flex gap-2.5 items-center cursor-pointer group" 
                onClick={() => {
                  setIsCalendarExpanded(!isCalendarExpanded);
                  if (!isCalendarExpanded) setIsAiExpanded(true);
                }}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/20 transition-all">
                  <Calendar className="w-4.5 h-4.5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-200 group-hover:text-white transition-colors flex items-center gap-2">
                    海外财经及指标前瞻
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 font-mono">演示</span>
                  </h3>
                  <p className="text-[9px] font-mono uppercase text-neutral-500 tracking-wider">Macro Indicator Calendar · Local demo, collapsed by default</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsCalendarExpanded(!isCalendarExpanded);
                  if (!isCalendarExpanded) setIsAiExpanded(true);
                }}
                className="w-7 h-7 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition-all"
                title={isCalendarExpanded ? "折叠面板" : "展开面板"}
              >
                {isCalendarExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            
            <div className={cn(
              "flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 transition-all duration-300 min-h-0",
              !isCalendarExpanded && "opacity-0 pointer-events-none scale-95"
            )}>
              {DEMO_CALENDAR_EVENTS.map((evt, i) => (
                <div key={i} className="bg-black/20 border border-white/5 p-2 px-3 rounded-lg flex flex-col hover:bg-neutral-900/40 transition-colors">
                  <div className="flex justify-between items-center mb-1 flex-wrap gap-2 text-[10px]">
                    <span className="font-mono text-neutral-500 font-medium">{evt.time}</span>
                    <span className="text-indigo-400 tracking-wider font-mono">{evt.importance}</span>
                    <span className={cn(
                      "px-1 py-0.5 rounded text-[8px] font-sans font-medium uppercase border",
                      evt.status === '已公布' 
                        ? 'bg-neutral-800 border-white/5 text-neutral-400' 
                        : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-450'
                    )}>{evt.status}</span>
                  </div>
                  <h4 className="text-xs text-neutral-200 font-medium line-clamp-1">{evt.title}</h4>
                  <div className="flex justify-between items-center text-[10px] mt-1 text-natural-500 leading-none">
                    <span className="text-neutral-500">{evt.preview}</span>
                    <span className="text-indigo-400 font-medium text-[9px]">{evt.impact}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
