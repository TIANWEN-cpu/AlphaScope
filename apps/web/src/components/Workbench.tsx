import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Bot, Maximize2, RefreshCw, Send, Zap, Clock, LineChart as LineChartIcon, Settings2, Sparkles, ChevronDown, ImagePlus } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Cell, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ChatMessage } from '../types';
import { STOCK_UNIVERSE, StockTarget, findStockTarget, formatStockLabel, resolveStockTarget } from '../lib/stocks';
import { getPersistedStock, subscribeStockSelected } from '../lib/workspaceEvents';
import { fetchApi, API_BASE_URL, API_KEY, LOCAL_API_TOKEN } from '../lib/api';
import {
  buildModelOptions,
  getModelKey,
  getRouteSelection,
  loadAiModelRoutesFromApi,
  loadLocalAiModelRoutes,
  ModelProvider,
} from '../lib/aiModelRouting';
import { ThemedSelect } from './ThemedSelect';

interface WorkbenchChartPoint {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  wickRange: [number, number];
  ma5: number;
  ma10: number;
  ma20: number;
  volume: number;
  amount?: number;
  change: number;
  changePct: number;
  up: boolean;
  source?: string;
  frequency?: string;
}

interface PriceBar {
  symbol: string;
  date: string;
  market?: string;
  frequency?: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount?: number;
  change_pct?: number;
  previous_close?: number;
  source?: string;
}

interface PriceSeriesResponse {
  symbol: string;
  frequency: string;
  bars: PriceBar[];
  total: number;
  degraded?: boolean;
  source_status?: string;
}

const generateKlineData = (points: number, basePrice: number = 1500, stepDays = 1): WorkbenchChartPoint[] => {
  let currentPrice = basePrice;
  const volatility = Math.max(0.25, Math.min(10, basePrice * 0.012));
  const volumeBase = Math.max(80000, basePrice * 2800);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (points - 1) * stepDays);
  const raw = Array.from({ length: points }).map((_, i) => {
    const open = currentPrice;
    const close = Math.max(0.1, currentPrice + (Math.random() * volatility * 2 - volatility));
    const high = Math.max(open, close) + Math.random() * volatility * 0.8;
    const low = Math.max(0.1, Math.min(open, close) - Math.random() * volatility * 0.8);
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i * stepDays);
    currentPrice = close;
    return {
      date: date.toISOString().slice(0, 10),
      open: Number(open.toFixed(2)),
      close: Number(close.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      wickRange: [Number(low.toFixed(2)), Number(high.toFixed(2))] as [number, number],
      volume: volumeBase + Math.random() * volumeBase * 1.8,
      change: Number((close - open).toFixed(2)),
      changePct: Number((((close - open) / open) * 100).toFixed(2)),
      up: close >= open,
    };
  });
  return raw.map((item, index) => {
    const slice5 = raw.slice(Math.max(0, index - 4), index + 1);
    const slice10 = raw.slice(Math.max(0, index - 9), index + 1);
    const slice20 = raw.slice(Math.max(0, index - 19), index + 1);
    return {
      ...item,
      ma5: Number((slice5.reduce((sum, point) => sum + point.close, 0) / slice5.length).toFixed(2)),
      ma10: Number((slice10.reduce((sum, point) => sum + point.close, 0) / slice10.length).toFixed(2)),
      ma20: Number((slice20.reduce((sum, point) => sum + point.close, 0) / slice20.length).toFixed(2)),
      source: 'local-preview',
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

interface ChatResponse {
  conversation_id: string;
  mode: string;
  content: string;
  provider?: string;
  model?: string;
  detected_intent?: string;
  auto_routed?: boolean;
  error?: boolean;
}

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || '未知错误');
}

function formatMessageHtml(content: string) {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<span class="text-white font-medium">$1</span>')
    .replace(/\n/g, '<br/>');
}

function stripSymbolSuffix(symbol: string) {
  return String(symbol || '').trim().split('.')[0];
}

function formatAxisDate(value: string) {
  const text = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(text)) return text.slice(5, 16);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(5, 10);
  return text;
}

function getMinimumPeriodBars(period: string) {
  if (period === '月K') return 6;
  if (period === '周K') return 12;
  return 2;
}

function shouldShowMovingAverage(period: string, dataLength: number, windowSize: number) {
  if (period === '月K' || period === '周K') {
    return dataLength >= windowSize;
  }
  return dataLength >= 2;
}

function formatPricePayloadMessage(payload: PriceSeriesResponse, periodLabel: string) {
  if (payload.source_status === 'short_history') {
    return `${periodLabel}样本不足，仅显示上市以来可用K线`;
  }
  if (payload.degraded) {
    return '行情源降级，使用可用缓存';
  }
  return '真实行情已同步';
}

function formatPrice(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolume(value?: number) {
  const number = Number(value || 0);
  if (number >= 100000000) return `${(number / 100000000).toFixed(2)}亿`;
  if (number >= 10000) return `${(number / 10000).toFixed(1)}万`;
  return Math.round(number).toLocaleString('zh-CN');
}

function getWorkbenchPriceDomain(data: WorkbenchChartPoint[], fallback: number): [number, number] {
  const values = data.flatMap((point) => [
    point.open,
    point.close,
    point.high,
    point.low,
    point.ma5,
    point.ma10,
    point.ma20,
  ]).filter((value) => Number.isFinite(value));
  const baseValues = values.length ? values : [fallback || 1];
  const min = Math.min(...baseValues);
  const max = Math.max(...baseValues);
  const range = Math.max(max - min, Math.abs(max) * 0.01, 1);
  const padding = Math.max(range * 0.08, 0.01);
  return [Math.max(0, min - padding), max + padding];
}

function enrichWorkbenchData(rawBars: PriceBar[]): WorkbenchChartPoint[] {
  const bars = [...rawBars].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return bars.map((bar, index) => {
    const open = Number(bar.open || 0);
    const close = Number(bar.close || 0);
    const high = Number(bar.high || Math.max(open, close));
    const low = Number(bar.low || Math.min(open, close));
    const previousClose = index > 0
      ? Number(bars[index - 1].close || open)
      : Number(bar.previous_close || 0) || (
        typeof bar.change_pct === 'number' && Number.isFinite(bar.change_pct) && bar.change_pct !== -100
          ? close / (1 + bar.change_pct / 100)
          : open
      );
    const base = previousClose || open || close || 1;
    const change = close - base;
    const changePct = typeof bar.change_pct === 'number' && Number.isFinite(bar.change_pct)
      ? bar.change_pct
      : (change / base) * 100;
    const slice5 = bars.slice(Math.max(0, index - 4), index + 1);
    const slice10 = bars.slice(Math.max(0, index - 9), index + 1);
    const slice20 = bars.slice(Math.max(0, index - 19), index + 1);

    return {
      date: String(bar.date || ''),
      open: Number(open.toFixed(2)),
      close: Number(close.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      wickRange: [Number(low.toFixed(2)), Number(high.toFixed(2))],
      ma5: Number((slice5.reduce((sum, point) => sum + Number(point.close || 0), 0) / Math.max(1, slice5.length)).toFixed(2)),
      ma10: Number((slice10.reduce((sum, point) => sum + Number(point.close || 0), 0) / Math.max(1, slice10.length)).toFixed(2)),
      ma20: Number((slice20.reduce((sum, point) => sum + Number(point.close || 0), 0) / Math.max(1, slice20.length)).toFixed(2)),
      volume: Number(bar.volume || 0),
      amount: Number(bar.amount || 0),
      change: Number(change.toFixed(2)),
      changePct: Number(changePct.toFixed(2)),
      up: close >= base,
      source: bar.source,
      frequency: bar.frequency,
    };
  });
}

function getFloatingTooltipStyle(
  coordinate?: { x?: number; y?: number },
  viewBox?: { x?: number; y?: number; width?: number; height?: number },
  size: { width: number; height: number } = { width: 188, height: 168 },
) {
  if (typeof coordinate?.x !== 'number' || typeof coordinate?.y !== 'number') {
    return { transform: 'translate(-50%, calc(-100% - 12px))' };
  }

  const { width, height } = size;
  const edgePadding = 12;
  const chartLeft = Number(viewBox?.x ?? 0);
  const chartTop = Number(viewBox?.y ?? 0);
  const chartRight = chartLeft + Number(viewBox?.width ?? 0);
  const nearLeft = coordinate.x - width / 2 < chartLeft + edgePadding;
  const nearRight = chartRight > chartLeft && coordinate.x + width / 2 > chartRight - edgePadding;
  const shiftX = nearLeft ? '8px' : nearRight ? 'calc(-100% - 8px)' : '-50%';
  const shiftY = 'calc(-100% - 12px)';

  return { transform: `translate(${shiftX}, ${shiftY})` };
}

function WorkbenchChartTooltip({ active, payload, label, coordinate, viewBox }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as WorkbenchChartPoint;
  const isUp = data.change >= 0;
  return (
    <div
      style={getFloatingTooltipStyle(coordinate, viewBox, { width: 150, height: 58 })}
      className="w-[150px] rounded-md border border-indigo-400/20 bg-[#090a10]/88 px-2.5 py-1.5 text-[10px] text-neutral-300 shadow-[0_8px_18px_rgba(0,0,0,0.28)] backdrop-blur"
    >
      <div className="flex items-center justify-between gap-3 font-mono">
        <span className="truncate text-neutral-200">{label}</span>
        <span className={isUp ? 'text-rose-400' : 'text-emerald-400'}>
          {isUp ? '+' : ''}{data.changePct.toFixed(2)}%
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-1 font-mono">
        <span className="text-neutral-500">量</span>
        <span className="text-neutral-100">{formatVolume(data.volume)}</span>
      </div>
    </div>
  );
}

function CompactWorkbenchTooltip({ active, payload, label, coordinate, viewBox }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as WorkbenchChartPoint;
  const isUp = data.change >= 0;
  return (
    <div
      style={getFloatingTooltipStyle(coordinate, viewBox, { width: 150, height: 58 })}
      className="w-[150px] rounded-md border border-indigo-400/20 bg-[#090a10]/88 px-2.5 py-1.5 text-[10px] text-neutral-300 shadow-[0_8px_18px_rgba(0,0,0,0.28)] backdrop-blur"
    >
      <div className="flex items-center justify-between gap-3 font-mono">
        <span className="truncate text-neutral-200">{label}</span>
        <span className={isUp ? 'text-rose-400' : 'text-emerald-400'}>
          {isUp ? '+' : ''}{data.changePct.toFixed(2)}%
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-1 font-mono">
        <span className={isUp ? 'text-rose-400' : 'text-emerald-400'}>
          {isUp ? '涨' : '跌'} {isUp ? '+' : ''}{data.change.toFixed(2)}
        </span>
        <span className="text-neutral-100">{formatPrice(data.close)}</span>
      </div>
    </div>
  );
}

function SilentTooltip() {
  return null;
}

function WorkbenchCandlestick(props: any) {
  const { x, y, width, height, payload } = props;
  const point = payload as WorkbenchChartPoint | undefined;
  if (!point) return null;

  const color = point.close >= point.open ? '#f43f5e' : '#10b981';
  const slotX = Number(x || 0);
  const slotWidth = Math.max(Number(width || 0), 1);
  const cx = slotX + slotWidth / 2;
  const yStart = Number(y || 0);
  const yEnd = yStart + Number(height || 0);
  const wickTop = Math.min(yStart, yEnd);
  const wickBottom = Math.max(yStart, yEnd);
  const wickHeight = Math.max(wickBottom - wickTop, 1);
  const high = Number(point.high);
  const low = Number(point.low);
  const priceToY = (price: number) => {
    if (!Number.isFinite(high) || !Number.isFinite(low) || high <= low) {
      return wickTop + wickHeight / 2;
    }
    const clamped = Math.max(low, Math.min(high, price));
    return wickTop + ((high - clamped) / (high - low)) * wickHeight;
  };
  const yOpen = priceToY(point.open);
  const yClose = priceToY(point.close);
  const rectHeight = Math.max(Math.abs(yOpen - yClose), 1.5);
  const rectY = Math.max(wickTop, Math.min(Math.min(yOpen, yClose), wickBottom - rectHeight));
  const bodyWidth = Math.max(3, Math.min(slotWidth * 0.72, 9));

  return (
    <g>
      <line x1={cx} y1={wickTop} x2={cx} y2={wickBottom} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <rect
        x={cx - bodyWidth / 2}
        y={rectY}
        width={bodyWidth}
        height={rectHeight}
        fill={color}
        fillOpacity={0.9}
        stroke={color}
        strokeWidth={1}
        rx={0.75}
      />
    </g>
  );
}

function getPeriodConfig(period: string) {
  if (period === '分时') return { points: 60, frequency: 'intraday', limit: 120, stepDays: 1 };
  if (period === '周K') return { points: 104, frequency: '1w', limit: 156, stepDays: 7 };
  if (period === '月K') return { points: 60, frequency: '1mo', limit: 120, stepDays: 30 };
  return { points: 40, frequency: '1d', limit: 80, stepDays: 1 };
}

function getPeriodTestId(period: string) {
  if (period === '分时') return 'workbench-period-intraday';
  if (period === '周K') return 'workbench-period-weekly';
  if (period === '月K') return 'workbench-period-monthly';
  return 'workbench-period-daily';
}

interface WorkbenchProps {
  onOpenModelSettings?: () => void;
}

export function Workbench({ onOpenModelSettings }: WorkbenchProps) {
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
  const [chatProviders, setChatProviders] = useState<ModelProvider[]>([]);
  const [selectedChatModelKey, setSelectedChatModelKey] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStatus, setChatStatus] = useState('正在读取系统设置中的模型配置...');
  const [latestQuote, setLatestQuote] = useState<WorkbenchChartPoint | undefined>();
  const [hoveredChartPoint, setHoveredChartPoint] = useState<WorkbenchChartPoint | undefined>();
  const [priceStatus, setPriceStatus] = useState<'loading' | 'live' | 'degraded'>('loading');
  const [priceMessage, setPriceMessage] = useState('正在同步行情...');
  const [priceRefreshKey, setPriceRefreshKey] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'agent',
      agentName: 'System',
      content: `欢迎使用研策中枢 AlphaScope 多 Agent 分析工作台。当前标的：**${currentStock.name}** (${currentStock.symbol})。请选择分析模式并输入问题。`,
      timestamp: new Date().toISOString(),
    }
  ]);
  const [input, setInput] = useState('');
  const metrics = getWorkbenchMetrics(currentStock);
  const selectedMode = ANALYSIS_MODES.find((mode) => mode.id === analysisMode) ?? ANALYSIS_MODES[0];
  const chatModelOptions = useMemo(() => buildModelOptions(chatProviders, 'chat'), [chatProviders]);
  const selectedChatModel = useMemo(
    () => chatModelOptions.find((option) => option.key === selectedChatModelKey) ?? chatModelOptions[0],
    [chatModelOptions, selectedChatModelKey],
  );
  const canSendChat = Boolean(input.trim() && selectedChatModel && !chatLoading);
  const chartLastPoint = chartData[chartData.length - 1];
  const lastChartPoint = activePeriod === '分时' ? (latestQuote ?? chartLastPoint) : chartLastPoint;
  const displayPrice = lastChartPoint?.close ?? metrics.price;
  const displayChange = lastChartPoint?.changePct ?? metrics.change;
  const displayIsUp = displayChange >= 0;
  const isPeriodDataTooShort = chartData.length > 0 && chartData.length < getMinimumPeriodBars(activePeriod);
  const chartStats = useMemo(() => {
    const lastPoint = chartData[chartData.length - 1];
    const ma5 = lastPoint?.ma5 ?? metrics.price;
    const ma10 = lastPoint?.ma10 ?? metrics.price;
    const ma20 = lastPoint?.ma20 ?? metrics.price;
    const values = chartData.flatMap((point) => [point.high, point.low, point.ma5, point.ma10, point.ma20]);
    const validValues = values.filter((value) => Number.isFinite(value));
    const max = validValues.length ? Math.max(...validValues) : metrics.price;
    const min = validValues.length ? Math.min(...validValues) : metrics.price;
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
  const priceDomain = useMemo(
    () => getWorkbenchPriceDomain(chartData, metrics.price),
    [chartData, metrics.price],
  );
  const priceSourceLabel = priceStatus === 'live'
    ? `${lastChartPoint?.source || 'provider'} · ${lastChartPoint?.date || ''}`
    : priceMessage;
  const chartSourceLabel = isPeriodDataTooShort
    ? `${activePeriod}样本不足，仅显示上市以来可用K线`
    : priceSourceLabel;
  const displayChartPoint = hoveredChartPoint ?? lastChartPoint;
  const displayChartPointUp = (displayChartPoint?.change ?? 0) >= 0;
  const showMa5Line = shouldShowMovingAverage(activePeriod, chartData.length, 5);
  const showMa10Line = shouldShowMovingAverage(activePeriod, chartData.length, 10);
  const showMa20Line = shouldShowMovingAverage(activePeriod, chartData.length, 20);

  const handleChartMouseMove = (state: any) => {
    const point = state?.activePayload?.find((item: any) => item?.payload)?.payload as WorkbenchChartPoint | undefined;
    if (point) setHoveredChartPoint(point);
  };
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
    let cancelled = false;

    async function loadChatProviders() {
      try {
        const result = await fetchApi<{ providers: ModelProvider[] }>('/api/settings/providers');
        if (cancelled) return;
        const providers = result.providers || [];
        const options = buildModelOptions(providers, 'chat');
        const routes = await loadAiModelRoutesFromApi().catch(() => loadLocalAiModelRoutes());
        const chatRoute = getRouteSelection(routes, providers, 'chat');
        const routeKey = getModelKey(chatRoute);
        setChatProviders(providers);
        setSelectedChatModelKey((current) => (
          current && options.some((option) => option.key === current)
            ? current
            : routeKey && options.some((option) => option.key === routeKey)
              ? routeKey
              : options[0]
                ? options[0].key
              : ''
        ));
        setChatStatus(
          options.length
            ? `已连接系统设置 Provider，共 ${options.length} 个可用聊天模型`
            : '没有可用聊天模型，请先到系统设置添加 Provider 并获取模型列表',
        );
      } catch (error) {
        if (cancelled) return;
        setChatProviders([]);
        setSelectedChatModelKey('');
        setChatStatus(`模型配置读取失败：${getErrorMessage(error)}`);
      }
    }

    loadChatProviders();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeStockSelected(({ stock }) => {
      const resolved = stock.resolved || stock.source === 'backend'
        ? stock
        : findStockTarget(stock.symbol) ?? stock;
      setCurrentStock(resolved);
      setMessages((prev) => [
        ...prev.map((msg) => msg.id === 'welcome'
          ? {
              ...msg,
              content: `欢迎使用研策中枢 AlphaScope 多 Agent 分析工作台。当前标的：**${resolved.name}** (${resolved.symbol})。请选择分析模式并输入问题。`,
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

  useEffect(() => {
    if (currentStock.resolved || currentStock.source === 'backend') return;
    let cancelled = false;
    const code = stripSymbolSuffix(currentStock.symbol);
    void resolveStockTarget(code).then((resolved) => {
      if (cancelled || !resolved) return;
      if (resolved.symbol !== currentStock.symbol || resolved.name !== currentStock.name || resolved.source !== currentStock.source || resolved.resolved !== currentStock.resolved) {
        setCurrentStock(resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentStock]);

  useEffect(() => {
    let cancelled = false;
    const period = getPeriodConfig(activePeriod);
    const fallback = generateKlineData(period.points, currentStock.startPrice, period.stepDays);

    async function loadPrices() {
      setPriceStatus('loading');
      setPriceMessage('正在同步真实行情...');
      try {
        const symbol = encodeURIComponent(stripSymbolSuffix(currentStock.symbol));
        const payload = await fetchApi<PriceSeriesResponse>(
          `/api/prices/${symbol}?frequency=${period.frequency}&limit=${period.limit}`,
        );
        if (cancelled) return;
        const nextData = payload.bars?.length ? enrichWorkbenchData(payload.bars) : fallback;
        let nextQuote = nextData[nextData.length - 1];
        if (period.frequency === 'intraday') {
          try {
            const latest = await fetchApi<PriceBar>(`/api/prices/${symbol}/latest`);
            if (!cancelled && latest?.close) {
              nextQuote = enrichWorkbenchData([latest])[0];
              nextQuote.changePct = Number((latest.change_pct || nextQuote.changePct || 0).toFixed(2));
              setLatestQuote(nextQuote);
            }
          } catch {
            if (!cancelled) setLatestQuote(nextQuote);
          }
        } else {
          setLatestQuote(undefined);
        }
        if (cancelled) return;
        setChartData(nextData);
        if (payload.bars?.length) {
          setPriceStatus(payload.degraded ? 'degraded' : 'live');
          setPriceMessage(formatPricePayloadMessage(payload, activePeriod));
        } else {
          setPriceStatus('degraded');
          setPriceMessage('行情源暂无数据，已切换本地预览');
          setLatestQuote(undefined);
        }
      } catch (error) {
        if (cancelled) return;
        setChartData(fallback);
        setLatestQuote(undefined);
        setPriceStatus('degraded');
        setPriceMessage(error instanceof Error ? error.message : '行情获取失败，已切换本地预览');
      }
    }

    void loadPrices();
    return () => {
      cancelled = true;
    };
  }, [activePeriod, currentStock, priceRefreshKey]);

  const handlePeriodChange = (period: string) => {
    setActivePeriod(period);
  };

  const handleModeChange = (mode: AnalysisModeId) => {
    const nextMode = ANALYSIS_MODES.find((item) => item.id === mode) ?? ANALYSIS_MODES[0];
    setAnalysisMode(mode);
    setModeMenuOpen(false);
    appendSystemMessage(`分析模式已切换为 **${nextMode.label}**。\n${nextMode.desc}。`);
  };

  const handleRefreshChart = () => {
    setPriceRefreshKey((value) => value + 1);
    appendSystemMessage(`已刷新 **${currentStock.name}** (${currentStock.symbol}) 的${activePeriod}行情，并同步更新均线、成交量与资金标签。`);
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

  const handleUploadContext = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      appendSystemMessage(`正在上传 **${file.name}** 到知识库，请稍候...`);
      const formData = new FormData();
      formData.append('file', file);
      const headers = new Headers();
      if (API_KEY) {
        headers.set('X-API-Key', API_KEY);
      }
      if (LOCAL_API_TOKEN) {
        headers.set('X-AlphaScope-Local-Token', LOCAL_API_TOKEN);
      }

      const response = await fetch(`${API_BASE_URL}/api/knowledge/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${response.status} ${response.statusText}`);
      }

      const uploadedName = payload?.data?.filename || file.name;
      setLastUploadedFile(uploadedName);
      appendSystemMessage(`已上传并索引：**${uploadedName}**。\n${payload?.message || '文件上传并处理成功'}`);
    } catch (error) {
      appendSystemMessage(`知识库上传失败：**${file.name}**\n${getErrorMessage(error)}`);
    } finally {
      event.target.value = '';
    }
  };

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || chatLoading) return;

    if (!selectedChatModel) {
      appendSystemMessage('当前没有可用聊天模型。请先到系统设置中添加 Provider、检查连通性并获取模型列表。');
      return;
    }

    const now = Date.now();
    const userMsg: ChatMessage = {
      id: `user-${now}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    };
    const pendingId = `assistant-pending-${now}`;
    const pendingMsg: ChatMessage = {
      id: pendingId,
      role: 'agent',
      agentName: `${selectedChatModel.providerName}/${selectedChatModel.modelId}`,
      content: `正在调用真实模型：**${selectedChatModel.providerName} / ${selectedChatModel.modelId}**\n\n已注入当前标的、行情沙盘、资金和分析模式上下文。`,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setInput('');
    setChatLoading(true);
    setChatStatus(`正在调用 ${selectedChatModel.providerName} / ${selectedChatModel.modelId}...`);

    try {
      const result = await fetchApi<ChatResponse>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          conversation_id: conversationId || undefined,
          message: prompt,
          mode: 'free',
          stock_symbol: currentStock.symbol,
          stock_name: currentStock.name,
          provider: selectedChatModel.providerId,
          model: selectedChatModel.modelId,
          context: {
            close: displayPrice,
            day_change: displayChange,
            period_change: displayChange,
            ma5: Number(chartStats.ma5.toFixed(2)),
            ma20: Number(chartStats.ma20.toFixed(2)),
            ma60: Number(chartStats.ma20.toFixed(2)),
            fund_dir: metrics.funds.map((item) => `${item.label}: ${item.value}`).join('；'),
            data_date: new Date().toLocaleDateString('zh-CN'),
            analysis_mode: selectedMode.label,
            auto_evidence: autoEvidence,
            strict_risk: strictRisk,
          },
        }),
      });

      if (result.conversation_id) {
        setConversationId(result.conversation_id);
      }

      const responseProvider = result.provider || selectedChatModel.providerId;
      const responseModel = result.model || selectedChatModel.modelId;
      const modelLine = `模型调用：**${responseProvider} / ${responseModel}**`;
      const content = result.content?.trim()
        ? `${modelLine}\n\n${result.content.trim()}`
        : `${modelLine}\n\n模型没有返回内容。请检查该 Provider 的模型权限、余额或 Base URL。`;

      setMessages((prev) => prev.map((msg) => (
        msg.id === pendingId
          ? {
              ...msg,
              agentName: `${responseProvider}/${responseModel}`,
              content,
              timestamp: new Date().toISOString(),
            }
          : msg
      )));
      setChatStatus(`上次调用成功：${responseProvider} / ${responseModel}`);
    } catch (error) {
      const message = getErrorMessage(error);
      setMessages((prev) => prev.map((msg) => (
        msg.id === pendingId
          ? {
              ...msg,
              agentName: '模型调用失败',
              content: `模型调用失败：${message}\n\n这不是模拟回复。请检查系统设置中的 Provider、Base URL、API Key、模型名称和网络连通性。`,
              timestamp: new Date().toISOString(),
            }
          : msg
      )));
      setChatStatus(`模型调用失败：${message}`);
    } finally {
      setChatLoading(false);
    }
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
          <div className={cn('flex min-w-0 flex-wrap items-baseline gap-3', displayIsUp ? 'text-rose-500' : 'text-emerald-500')}>
            <span className={cn('font-mono text-3xl font-medium tracking-tight sm:text-4xl', displayIsUp ? 'drop-shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'drop-shadow-[0_0_15px_rgba(16,185,129,0.25)]')}>
              {formatPrice(displayPrice)}
            </span>
            <span className={cn('flex items-center rounded border px-2 py-0.5 font-mono text-sm font-medium', displayIsUp ? 'border-rose-500/20 bg-rose-500/10 text-rose-500' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500')}>
              <span className="rotate-45 mr-1 text-lg leading-none">{displayIsUp ? '↗' : '↘'}</span>{displayIsUp ? '+' : ''}{displayChange.toFixed(2)}%
            </span>
            <span className={cn('max-w-[22rem] truncate rounded border px-2 py-0.5 align-middle font-mono text-[10px]', priceStatus === 'live' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300')}>
              {priceStatus === 'loading' ? '同步中' : priceSourceLabel}
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
                 <span className="hidden max-w-[18rem] truncate rounded border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[10px] text-neutral-500 sm:inline">
                   {priceStatus === 'loading' ? '正在同步行情' : chartSourceLabel}
                 </span>
              </div>
              <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefreshChart}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-neutral-400 transition-colors hover:bg-white/[0.05] hover:text-neutral-200"
                title="刷新行情"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', priceStatus === 'loading' && 'animate-spin')} />
              </button>
              <div className="flex rounded-lg border border-white/5 bg-black/40 p-1 shadow-inner">
                {['分时', '日K', '周K', '月K'].map((period) => (
                  <button 
                    key={period}
                    data-testid={getPeriodTestId(period)}
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
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-white/5 bg-black/20 px-5 py-3 font-mono text-[11px]">
               <span className={cn('flex items-center gap-2', showMa5Line ? 'text-yellow-500/90' : 'text-neutral-600')}><div className={cn('h-0.5 w-2', showMa5Line ? 'bg-yellow-500/90' : 'bg-neutral-700')}></div>MA5: {showMa5Line ? formatPrice(chartStats.ma5) : '--'}</span>
               <span className={cn('flex items-center gap-2', showMa10Line ? 'text-indigo-400/90' : 'text-neutral-600')}><div className={cn('h-0.5 w-2', showMa10Line ? 'bg-indigo-400/90' : 'bg-neutral-700')}></div>MA10: {showMa10Line ? formatPrice(chartStats.ma10) : '--'}</span>
               <span className={cn('flex items-center gap-2', showMa20Line ? 'text-emerald-400/90' : 'text-neutral-600')}><div className={cn('h-0.5 w-2', showMa20Line ? 'bg-emerald-400/90' : 'bg-neutral-700')}></div>MA20: {showMa20Line ? formatPrice(chartStats.ma20) : '--'}</span>
               {displayChartPoint && (
                 <span className="min-w-0 truncate rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-neutral-400">
                   {displayChartPoint.date} · 收 {formatPrice(displayChartPoint.close)} · <span className={displayChartPointUp ? 'text-rose-400' : 'text-emerald-400'}>{displayChartPointUp ? '+' : ''}{displayChartPoint.changePct.toFixed(2)}%</span>
                 </span>
               )}
               {isPeriodDataTooShort && (
                 <span className="min-w-0 truncate rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-amber-300">
                   {activePeriod}样本不足：仅 {chartData.length} 根，可能是新股或行情源历史较短
                 </span>
               )}
               <span className="text-neutral-500 sm:ml-auto">VOL: {formatVolume(chartStats.volume)}</span>
            </div>

            {/* Chart Area */}
            <div className="relative min-h-0 flex-1 bg-black/40 p-5">
               <div className="absolute right-6 top-6 text-[10px] font-mono text-neutral-600">{formatPrice(chartStats.high)}</div>
               <div className="absolute right-6 bottom-24 text-[10px] font-mono text-neutral-600">{formatPrice(chartStats.low)}</div>
             
             <ResponsiveContainer width="100%" height="80%">
               <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }} onMouseMove={handleChartMouseMove}>
                 <CartesianGrid stroke="#ffffff" strokeOpacity={0.03} strokeDasharray="4 4" vertical={false} />
                 <XAxis dataKey="date" tickFormatter={formatAxisDate} hide />
                 <YAxis domain={priceDomain} hide />
                 <Tooltip
                   content={<CompactWorkbenchTooltip />}
                   offset={0}
                   allowEscapeViewBox={{ x: true, y: true }}
                   wrapperStyle={{ pointerEvents: 'none', zIndex: 30, outline: 'none' }}
                   cursor={{ stroke: '#818cf8', strokeOpacity: 0.32, strokeWidth: 1 }}
                 />
                 <Bar dataKey="wickRange" barSize={9} shape={<WorkbenchCandlestick />}>
                    {chartData.map((entry, index) => (
                      <Cell key={`candle-${index}`} fill={entry.up ? '#f43f5e' : '#10b981'} />
                    ))}
                 </Bar>
                 {showMa5Line && <Line type="monotone" dataKey="ma5" stroke="#eab308" strokeWidth={1.5} dot={false} activeDot={false} />}
                 {showMa10Line && <Line type="monotone" dataKey="ma10" stroke="#818cf8" strokeWidth={1.5} dot={false} activeDot={false} />}
                 {showMa20Line && <Line type="monotone" dataKey="ma20" stroke="#34d399" strokeWidth={1.5} dot={false} activeDot={false} />}
               </ComposedChart>
             </ResponsiveContainer>
             
             <ResponsiveContainer width="100%" height="20%">
               <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                 <XAxis dataKey="date" tickFormatter={formatAxisDate} tick={{ fill: '#737373', fontSize: 10 }} stroke="#222" minTickGap={22} />
                 <Tooltip
                   content={<WorkbenchChartTooltip />}
                   offset={0}
                   allowEscapeViewBox={{ x: true, y: true }}
                   wrapperStyle={{ pointerEvents: 'none', zIndex: 30, outline: 'none' }}
                   cursor={{ fill: 'rgba(129,140,248,0.08)' }}
                 />
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
            <button
              data-testid="workbench-open-model-settings"
              onClick={onOpenModelSettings}
              className="p-1.5 hover:bg-white/5 rounded-md text-neutral-500 transition-colors"
              title="模型路由设置"
            >
              <Bot className="w-3.5 h-3.5" />
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
          <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-xs text-neutral-300">
                <Bot className="h-4 w-4 shrink-0 text-indigo-300" />
                <span className="shrink-0 font-medium text-neutral-100">真实模型</span>
                <span className="truncate font-mono text-[11px] text-neutral-500">{chatStatus}</span>
              </div>
              <button
                type="button"
                onClick={onOpenModelSettings}
                className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-neutral-400 transition-colors hover:border-indigo-400/40 hover:text-indigo-200"
              >
                设置
              </button>
              <ThemedSelect
                data-testid="workbench-chat-model-select"
                value={selectedChatModel?.key || ''}
                onChange={setSelectedChatModelKey}
                disabled={!chatModelOptions.length || chatLoading}
                className="min-w-[220px]"
                buttonClassName="h-8 rounded-lg bg-black/50 px-2 text-xs"
                menuClassName="text-xs"
                options={chatModelOptions.length ? chatModelOptions.map((option) => ({
                  value: option.key,
                  label: `${option.providerName} / ${option.modelId}${option.vision ? ' · 视觉' : ''}`,
                  badge: option.vision ? <span className="rounded-full bg-indigo-400/10 px-1.5 py-0.5 text-[9px] text-indigo-200">视觉</span> : undefined,
                })) : [{ value: '', label: '请先在系统设置获取模型列表', disabled: true }]}
              />
            </div>
          </div>
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
                  disabled={!canSendChat}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-white rounded-lg border border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all",
                    canSendChat ? "bg-indigo-600 hover:bg-indigo-500" : "cursor-not-allowed bg-neutral-800 text-neutral-500 border-white/10 shadow-none"
                  )}
                >
                  {chatLoading ? '调用中' : '发送'}
                  {chatLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
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
