import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Bot, Maximize2, RefreshCw, Send, Zap, Clock, LineChart as LineChartIcon, Settings2, Sparkles, ChevronDown, ImagePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ChatMessage } from '../types';
import { api, NewsRecord, PriceBar } from '../lib/api';

type LoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
type MetricTone = 'up' | 'down' | 'neutral';
type FinanceItem = { label: string; value: string; trend: MetricTone };
type QuantCard = { label: string; value: string; tone: MetricTone; detail: string };
type QuantSignal = { type: string; title: string; meta: string };
type PriceFrequency = 'intraday' | '1d' | '1w' | '1mo';
type ChartPoint = {
  date: string;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  avgPrice: number | null;
  referencePrice: number | null;
  volume: number;
  amount: number;
  changePct: number;
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  up: boolean;
};
type FactorPanelData = {
  state: LoadState;
  cards: QuantCard[];
  counts: Array<{ label: string; value: string }>;
  signals: QuantSignal[];
  computedAt?: string;
  message?: string;
};

const PERIOD_CONFIG: Record<string, { frequency: PriceFrequency; limit: number; label: string }> = {
  分时: { frequency: 'intraday', limit: 240, label: '分时' },
  日K: { frequency: '1d', limit: 120, label: '日K' },
  周K: { frequency: '1w', limit: 80, label: '周K' },
  月K: { frequency: '1mo', limit: 60, label: '月K' },
};

const getPeriodConfig = (period: string) => PERIOD_CONFIG[period] || PERIOD_CONFIG['日K'];

const averageClose = (bars: PriceBar[], index: number, window: number): number | null => {
  const start = Math.max(0, index - window + 1);
  const slice = bars.slice(start, index + 1);
  if (slice.length < window) return null;
  const total = slice.reduce((sum, bar) => sum + Number(bar.close || 0), 0);
  return slice.length ? total / slice.length : null;
};

const formatChartLabel = (date: string, frequency: PriceFrequency) => {
  if (!date) return '';
  if (frequency === 'intraday') return date.slice(11, 16) || date.slice(-5);
  if (frequency === '1mo') return date.slice(0, 7);
  return date.slice(5);
};

const toChartData = (bars: PriceBar[], frequency: PriceFrequency): ChartPoint[] => {
  const sorted = [...bars].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const intradayReference = frequency === 'intraday'
    ? Number(
        sorted.find(bar => Number(bar.previous_close || 0) > 0)?.previous_close ||
        sorted.find(bar => Number(bar.prev_close || 0) > 0)?.prev_close ||
        sorted[0]?.open ||
        sorted[0]?.close ||
        0
      )
    : null;
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  return sorted.map((bar, index, arr) => {
    const open = Number(bar.open || bar.close || 0);
    const high = Number(bar.high || bar.close || 0);
    const low = Number(bar.low || bar.close || 0);
    const close = Number(bar.close || 0);
    const volume = Number(bar.volume || 0);
    if (frequency === 'intraday') {
      const weight = volume > 0 ? volume : 1;
      cumulativePriceVolume += close * weight;
      cumulativeVolume += weight;
    }
    const referencePrice = frequency === 'intraday' && intradayReference && Number.isFinite(intradayReference)
      ? intradayReference
      : null;
    const changePct = referencePrice
      ? ((close - referencePrice) / referencePrice) * 100
      : Number(bar.change_pct || 0);

    return {
      date: String(bar.date || ''),
      label: formatChartLabel(String(bar.date || ''), frequency) || `${index + 1}`,
      open,
      high,
      low,
      close,
      avgPrice: frequency === 'intraday' && cumulativeVolume > 0 ? cumulativePriceVolume / cumulativeVolume : null,
      referencePrice,
      ma5: averageClose(arr, index, 5),
      ma10: averageClose(arr, index, 10),
      ma20: averageClose(arr, index, 20),
      volume,
      amount: Number(bar.amount || 0),
      changePct,
      up: close >= (referencePrice || open || close),
    };
  });
};

const EMPTY_FINANCE: FinanceItem[] = [
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

const EMPTY_FACTOR_PANEL: FactorPanelData = {
  state: 'idle',
  cards: [
    { label: '综合因子', value: '--', tone: 'neutral', detail: '等待后端计算' },
    { label: '新闻情绪', value: '--', tone: 'neutral', detail: '新闻样本待同步' },
    { label: '资金流', value: '--', tone: 'neutral', detail: '资金流样本待同步' },
    { label: '价格动量', value: '--', tone: 'neutral', detail: '行情样本待同步' },
  ],
  counts: [
    { label: '新闻', value: '--' },
    { label: '事件', value: '--' },
    { label: '研报', value: '--' },
  ],
  signals: [],
  message: '多因子 Alpha 模型等待后端计算...',
};

const displayNumber = (value: number, digits = 2) =>
  Number.isFinite(value) ? value.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '--';

const toFiniteNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const isUsefulNumber = (value: unknown, allowZero = false) => {
  const num = toFiniteNumber(value);
  if (num === null) return false;
  return allowZero || num !== 0;
};

const formatPlainNumber = (value: unknown, digits = 2, allowZero = false) => {
  const num = toFiniteNumber(value);
  if (num === null || (!allowZero && num === 0)) return '--';
  return num.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
};

const formatPercentMetric = (value: unknown, signed = false, allowZero = false) => {
  const num = toFiniteNumber(value);
  if (num === null || (!allowZero && num === 0)) return '--';
  const prefix = signed && num >= 0 ? '+' : '';
  return `${prefix}${num.toFixed(1)}%`;
};

const formatYiMetric = (value: unknown, signed = false, allowZero = false) => {
  const num = toFiniteNumber(value);
  if (num === null || (!allowZero && num === 0)) return '--';
  const prefix = signed && num >= 0 ? '+' : '';
  return `${prefix}${num.toFixed(1)}亿`;
};

const formatYi = (value: unknown) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '--';
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}亿`;
};

const metricTone = (value: unknown, inverse = false): MetricTone => {
  const num = toFiniteNumber(value);
  if (num === null || num === 0) return 'neutral';
  const positive = num > 0;
  if (inverse) return positive ? 'down' : 'up';
  return positive ? 'up' : 'down';
};

const toneTextClass = (tone: MetricTone) => cn(
  tone === 'up' && 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]',
  tone === 'down' && 'text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]',
  tone === 'neutral' && 'text-neutral-300',
);

const buildFinanceItems = (data: Record<string, unknown>): FinanceItem[] => {
  const periods = Array.isArray(data.financial_periods) ? data.financial_periods as Record<string, unknown>[] : [];
  const latest = periods[0] || {};
  const valuation = (data.valuation || {}) as Record<string, unknown>;
  const score = (data.fundamental_score || {}) as Record<string, unknown>;

  const candidates: Array<FinanceItem | null> = [
    isUsefulNumber(valuation.pe ?? valuation.pe_ttm)
      ? { label: '市盈率(TTM)', value: formatPlainNumber(valuation.pe ?? valuation.pe_ttm), trend: metricTone(valuation.pe ?? valuation.pe_ttm, true) }
      : null,
    isUsefulNumber(valuation.pb)
      ? { label: '市净率(MRQ)', value: formatPlainNumber(valuation.pb), trend: metricTone(valuation.pb, true) }
      : null,
    isUsefulNumber(latest.revenue_yi)
      ? { label: '营收(最新)', value: formatYiMetric(latest.revenue_yi), trend: 'neutral' }
      : null,
    isUsefulNumber(latest.net_profit_yi)
      ? { label: '归母净利', value: formatYiMetric(latest.net_profit_yi), trend: metricTone(latest.net_profit_yi) }
      : null,
    isUsefulNumber(latest.gross_margin_pct)
      ? { label: '毛利率', value: formatPercentMetric(latest.gross_margin_pct), trend: metricTone(latest.gross_margin_pct) }
      : null,
    isUsefulNumber(latest.roe_pct)
      ? { label: 'ROE', value: formatPercentMetric(latest.roe_pct), trend: metricTone(latest.roe_pct) }
      : null,
    isUsefulNumber(latest.debt_ratio_pct)
      ? { label: '资产负债率', value: formatPercentMetric(latest.debt_ratio_pct), trend: metricTone(latest.debt_ratio_pct, true) }
      : null,
    isUsefulNumber(latest.yoy_net_profit_pct, true)
      ? { label: '净利润同比', value: formatPercentMetric(latest.yoy_net_profit_pct, true, true), trend: metricTone(latest.yoy_net_profit_pct) }
      : null,
    isUsefulNumber(latest.yoy_revenue_pct, true)
      ? { label: '营收同比', value: formatPercentMetric(latest.yoy_revenue_pct, true, true), trend: metricTone(latest.yoy_revenue_pct) }
      : null,
    isUsefulNumber(score.total_score)
      ? { label: `基本面评分${score.grade ? ` ${score.grade}` : ''}`, value: formatPlainNumber(score.total_score, 1), trend: 'neutral' }
      : null,
  ];

  const items = candidates.filter(Boolean) as FinanceItem[];
  return [...items, ...EMPTY_FINANCE].slice(0, 4);
};

const factorTone = (value: unknown): MetricTone => {
  const num = toFiniteNumber(value);
  if (num === null || Math.abs(num) < 0.05) return 'neutral';
  return num > 0 ? 'up' : 'down';
};

const formatFactorScore = (value: unknown) => {
  const num = toFiniteNumber(value);
  if (num === null) return '--';
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}`;
};

const signalLabel = (type: string) => {
  const labels: Record<string, string> = {
    news: '新闻',
    event: '公告',
    analyst: '研报',
    fund_flow: '资金',
    momentum: '动量',
  };
  return labels[type] || '信号';
};

const formatFactorSignal = (signal: Record<string, unknown>): QuantSignal => {
  const type = String(signal.type || '');
  if (type === 'fund_flow') {
    return {
      type: signalLabel(type),
      title: `主力净流入 ${formatYiMetric(signal.last_main_yi, true, true)}`,
      meta: `近段合计 ${formatYiMetric(signal.main_total_yi, true, true)} / 流入 ${signal.inflow_days ?? 0} 天`,
    };
  }
  if (type === 'momentum') {
    return {
      type: signalLabel(type),
      title: `短期涨跌 ${formatPercentMetric(signal.short_return_pct, true, true)}`,
      meta: `中期 ${formatPercentMetric(signal.mid_return_pct, true, true)} / 量能 ${formatPercentMetric(signal.volume_change_pct, true, true)}`,
    };
  }
  const score = signal.sentiment ?? signal.score ?? signal.rating_score;
  return {
    type: signalLabel(type),
    title: String(signal.title || '暂无标题'),
    meta: score !== undefined ? `信号值 ${formatFactorScore(score)}` : String(signal.institution || signal.category || ''),
  };
};

const buildFactorPanel = (data: Record<string, unknown>): FactorPanelData => {
  const factors = (data.factors || {}) as Record<string, unknown>;
  const counts = (data.sample_counts || {}) as Record<string, unknown>;
  const signals = Array.isArray(data.signals) ? data.signals as Record<string, unknown>[] : [];
  const cards: QuantCard[] = [
    { label: '综合因子', value: formatFactorScore(factors.composite), tone: factorTone(factors.composite), detail: '加权汇总新闻、事件、研报、资金与动量' },
    { label: '新闻情绪', value: formatFactorScore(factors.news_sentiment), tone: factorTone(factors.news_sentiment), detail: `新闻样本 ${counts.news ?? 0} 条` },
    { label: '资金流', value: formatFactorScore(factors.fund_flow), tone: factorTone(factors.fund_flow), detail: '主力资金近况归一化' },
    { label: '价格动量', value: formatFactorScore(factors.momentum), tone: factorTone(factors.momentum), detail: '短中期涨跌与量能变化' },
  ];

  return {
    state: 'ready',
    cards,
    counts: [
      { label: '新闻', value: String(counts.news ?? 0) },
      { label: '事件', value: String(counts.events ?? 0) },
      { label: '研报', value: String(counts.reports ?? 0) },
    ],
    signals: signals.slice(0, 5).map(formatFactorSignal),
    computedAt: String(data.computed_at || ''),
    message: '因子计算完成',
  };
};

const formatVolume = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '--';
  if (value >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function MarketChart({
  data,
  frequency,
  activePeriod,
  hoveredIndex,
  onHover,
  onLeave,
}: {
  data: ChartPoint[];
  frequency: PriceFrequency;
  activePeriod: string;
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
  onLeave: () => void;
}) {
  const width = 960;
  const priceHeight = 250;
  const volumeHeight = 78;
  const pad = { top: 18, right: 54, bottom: 22, left: 12 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = priceHeight - pad.top - pad.bottom;
  const volumeTop = priceHeight + 18;
  const volumePlotHeight = volumeHeight - 20;
  const visible = data.filter(item => item.close > 0);

  if (!visible.length) {
    return null;
  }

  const priceValues = frequency === 'intraday'
    ? visible.flatMap(item => [item.close, item.avgPrice || 0, item.referencePrice || 0]).filter(value => Number.isFinite(value) && value > 0)
    : visible.flatMap(item => [item.high, item.low, item.ma5 || 0, item.ma10 || 0, item.ma20 || 0]).filter(value => Number.isFinite(value) && value > 0);
  const minPrice = Math.min(...priceValues);
  const maxPrice = Math.max(...priceValues);
  const padding = Math.max((maxPrice - minPrice) * 0.08, maxPrice * (frequency === 'intraday' ? 0.0015 : 0.005), 0.01);
  const yMin = minPrice - padding;
  const yMax = maxPrice + padding;
  const xStep = visible.length > 1 ? plotWidth / (visible.length - 1) : plotWidth;
  const candleSlot = visible.length > 0 ? plotWidth / visible.length : plotWidth;
  const candleWidth = frequency === 'intraday' ? 2 : clamp(candleSlot * 0.54, 3, 13);
  const maxVolume = Math.max(...visible.map(item => item.volume || 0), 1);
  const currentIndex = hoveredIndex !== null && hoveredIndex < visible.length ? hoveredIndex : visible.length - 1;
  const current = visible[currentIndex];

  const xFor = (index: number) => pad.left + index * xStep;
  const yFor = (value: number) => pad.top + (yMax - value) / (yMax - yMin) * plotHeight;
  const volumeY = (value: number) => volumeTop + volumePlotHeight - (value / maxVolume) * volumePlotHeight;
  const linePath = (key: 'ma5' | 'ma10' | 'ma20' | 'close' | 'avgPrice') => {
    let started = false;
    return visible
      .map((item, index) => {
        const raw = key === 'close' ? item.close : item[key];
        if (!raw) return '';
        const command = started ? 'L' : 'M';
        started = true;
        return `${command} ${xFor(index).toFixed(2)} ${yFor(raw).toFixed(2)}`;
      })
      .filter(Boolean)
      .join(' ');
  };
  const intradayPath = linePath('close');
  const intradayAvgPath = linePath('avgPrice');
  const tickIndexes = Array.from(new Set([0, Math.floor(visible.length * 0.25), Math.floor(visible.length * 0.5), Math.floor(visible.length * 0.75), visible.length - 1]))
    .filter(index => index >= 0 && index < visible.length);
  const priceTicks = [yMax, yMax - (yMax - yMin) / 3, yMax - (yMax - yMin) * 2 / 3, yMin];
  const hoverX = xFor(currentIndex);
  const hoverY = yFor(frequency === 'intraday' ? current.close : current.up ? current.high : current.low);
  const tooltipWidth = frequency === 'intraday' ? 250 : 270;
  const tooltipX = clamp(hoverX - tooltipWidth / 2, pad.left + 8, width - pad.right - tooltipWidth - 8);
  const tooltipY = clamp(hoverY - 76, pad.top + 6, priceHeight - 118);
  const previousClose = current.referencePrice;

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${width} ${priceHeight + volumeHeight + 34}`} preserveAspectRatio="none" className="h-full w-full">
        <rect x={0} y={0} width={width} height={priceHeight + volumeHeight + 34} fill="transparent" />
        {priceTicks.map((tick, index) => (
          <g key={`tick-${index}`}>
            <line x1={pad.left} x2={width - pad.right} y1={yFor(tick)} y2={yFor(tick)} stroke="#ffffff" strokeOpacity={0.05} strokeDasharray="4 4" />
            <text x={width - pad.right + 8} y={yFor(tick) + 4} fill="#525252" fontSize="10" fontFamily="monospace">
              {displayNumber(tick)}
            </text>
          </g>
        ))}

        {frequency === 'intraday' ? (
          <>
            {previousClose && (
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={yFor(previousClose)}
                y2={yFor(previousClose)}
                stroke="#737373"
                strokeOpacity={0.55}
                strokeDasharray="6 4"
              />
            )}
            <path d={intradayPath} fill="none" stroke="#eab308" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
            {intradayAvgPath && (
              <path d={intradayAvgPath} fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeOpacity="0.9" vectorEffect="non-scaling-stroke" />
            )}
            <path d={`${intradayPath} L ${xFor(visible.length - 1)} ${priceHeight - pad.bottom} L ${xFor(0)} ${priceHeight - pad.bottom} Z`} fill="#eab308" fillOpacity="0.08" />
          </>
        ) : (
          <>
            <path d={linePath('ma5')} fill="none" stroke="#eab308" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
            <path d={linePath('ma10')} fill="none" stroke="#818cf8" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
            <path d={linePath('ma20')} fill="none" stroke="#34d399" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
            {visible.map((item, index) => {
              const x = xFor(index);
              const openY = yFor(item.open);
              const closeY = yFor(item.close);
              const highY = yFor(item.high);
              const lowY = yFor(item.low);
              const color = item.up ? '#f43f5e' : '#10b981';
              const bodyY = Math.min(openY, closeY);
              const bodyHeight = Math.max(Math.abs(closeY - openY), 1.5);
              return (
                <g key={`${item.date}-${index}`}>
                  <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
                  <rect x={x - candleWidth / 2} y={bodyY} width={candleWidth} height={bodyHeight} fill={color} fillOpacity={item.up ? 0.9 : 0.78} rx={0.8} />
                </g>
              );
            })}
          </>
        )}

        <line x1={pad.left} x2={width - pad.right} y1={volumeTop + volumePlotHeight} y2={volumeTop + volumePlotHeight} stroke="#ffffff" strokeOpacity={0.07} />
        {visible.map((item, index) => {
          const x = xFor(index);
          const y = volumeY(item.volume || 0);
          const color = item.up ? '#f43f5e' : '#10b981';
          return (
            <rect key={`vol-${item.date}-${index}`} x={x - Math.max(candleWidth, 2) / 2} y={y} width={Math.max(candleWidth, 2)} height={volumeTop + volumePlotHeight - y} fill={color} fillOpacity={0.35} rx={1} />
          );
        })}

        {tickIndexes.map(index => (
          <text key={`x-${index}`} x={xFor(index)} y={priceHeight + volumeHeight + 24} fill="#525252" fontSize="10" fontFamily="monospace" textAnchor={index === 0 ? 'start' : index === visible.length - 1 ? 'end' : 'middle'}>
            {visible[index].label}
          </text>
        ))}

        <line x1={hoverX} x2={hoverX} y1={pad.top} y2={volumeTop + volumePlotHeight} stroke="#ffffff" strokeOpacity={0.16} strokeDasharray="3 3" />
        <circle
          cx={hoverX}
          cy={frequency === 'intraday' ? yFor(current.close) : yFor(current.close)}
          r={3}
          fill={frequency === 'intraday' ? '#eab308' : current.up ? '#f43f5e' : '#10b981'}
          stroke="#0a0a0a"
          strokeWidth={1.5}
        />
        <rect
          x={pad.left}
          y={pad.top}
          width={plotWidth}
          height={volumeTop + volumePlotHeight - pad.top}
          fill="transparent"
          onMouseMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const ratio = clamp((event.clientX - box.left) / box.width, 0, 1);
            onHover(Math.round(ratio * (visible.length - 1)));
          }}
          onMouseLeave={onLeave}
        />
      </svg>

      <div
        className="pointer-events-none absolute rounded-lg border border-white/10 bg-black/75 px-3 py-2 text-[11px] text-neutral-300 shadow-xl backdrop-blur"
        style={{
          left: `${tooltipX / width * 100}%`,
          top: `${tooltipY / (priceHeight + volumeHeight + 34) * 100}%`,
          width: tooltipWidth,
        }}
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="font-mono text-neutral-500">{current.date}</span>
          <span className={cn("font-mono", current.up ? "text-rose-400" : "text-emerald-400")}>{current.changePct >= 0 ? '+' : ''}{current.changePct.toFixed(2)}%</span>
          <span className="text-neutral-600">{activePeriod}</span>
        </div>
        <div className="grid grid-cols-4 gap-x-3 gap-y-1 font-mono">
          <span>开 {displayNumber(current.open)}</span>
          <span>高 {displayNumber(current.high)}</span>
          <span>低 {displayNumber(current.low)}</span>
          <span>收 {displayNumber(current.close)}</span>
        </div>
        <div className="mt-1 flex gap-3 font-mono text-neutral-500">
          <span>量 {formatVolume(current.volume)}</span>
          {frequency === 'intraday' && current.avgPrice ? <span>均 {displayNumber(current.avgPrice)}</span> : null}
          {frequency === 'intraday' && current.referencePrice ? <span>昨收 {displayNumber(current.referencePrice)}</span> : null}
        </div>
      </div>
    </div>
  );
}

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

type AnalysisMode = 'free' | 'standard' | 'deep' | 'expert' | 'vision';

interface WorkbenchProps {
  symbol?: string;
  stockName?: string;
}

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
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [priceBars, setPriceBars] = useState<PriceBar[]>([]);
  const [latestPrice, setLatestPrice] = useState<PriceBar | null>(null);
  const [hoveredChartIndex, setHoveredChartIndex] = useState<number | null>(null);
  const [financeItems, setFinanceItems] = useState(EMPTY_FINANCE);
  const [fundItems, setFundItems] = useState(EMPTY_FUNDS);
  const [newsItems, setNewsItems] = useState<ReturnType<typeof mapBackendNews>>([]);
  const [factorPanel, setFactorPanel] = useState<FactorPanelData>(EMPTY_FACTOR_PANEL);
  const [dataStatus, setDataStatus] = useState('后端数据待同步');
  const [marketState, setMarketState] = useState<LoadState>('idle');
  const [newsState, setNewsState] = useState<LoadState>('idle');
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [selectedMode, setSelectedMode] = useState<AnalysisMode>('standard');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [includeStockContext, setIncludeStockContext] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workbenchRequestRef = useRef(0);
  const priceRefreshRequestRef = useRef(0);
  const activeSymbolRef = useRef(symbol);
  const activePeriodRef = useRef(activePeriod);
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
    const requestId = workbenchRequestRef.current + 1;
    workbenchRequestRef.current = requestId;
    priceRefreshRequestRef.current += 1;
    activeSymbolRef.current = symbol;
    const controller = new AbortController();
    const isCurrent = () => workbenchRequestRef.current === requestId && !controller.signal.aborted;
    setMarketState('loading');
    setNewsState('loading');
    setIsRefreshingPrices(false);
    setChartData([]);
    setPriceBars([]);
    setLatestPrice(null);
    setHoveredChartIndex(null);
    setNewsItems([]);
    setFinanceItems(EMPTY_FINANCE);
    setFundItems(EMPTY_FUNDS);
    setFactorPanel({ ...EMPTY_FACTOR_PANEL, state: 'loading', message: `正在计算 ${stockName} (${symbol}) 量化因子...` });

    async function loadWorkbenchData() {
      setDataStatus(`正在同步 ${stockName} (${symbol}) 后端行情、财务、新闻与因子...`);
      const periodConfig = getPeriodConfig(activePeriodRef.current);
      const [pricesResult, latestResult, fundamentalsResult, newsResult, fundFlowResult, factorsResult] = await Promise.allSettled([
        api.prices(symbol, periodConfig.limit, periodConfig.frequency, { signal: controller.signal }),
        api.latestPrice(symbol, { signal: controller.signal }),
        api.fundamentals(symbol, { signal: controller.signal }),
        api.news(symbol, 8, { signal: controller.signal }),
        api.fundFlow(symbol, 30, { signal: controller.signal }),
        api.factors(symbol, stockName, 60, { signal: controller.signal }),
      ]);

      if (!isCurrent()) return;
      const shouldApplyPriceResult = activePeriodRef.current === periodConfig.label;

      if (shouldApplyPriceResult && pricesResult.status === 'fulfilled' && pricesResult.value.success && pricesResult.value.data?.bars?.length) {
        const bars = pricesResult.value.data.bars;
        setPriceBars(bars);
        setChartData(toChartData(bars, periodConfig.frequency));
        setMarketState('ready');
      } else if (shouldApplyPriceResult && pricesResult.status === 'fulfilled' && pricesResult.value.success) {
        setPriceBars([]);
        setChartData([]);
        setMarketState('empty');
      } else if (shouldApplyPriceResult) {
        setPriceBars([]);
        setChartData([]);
        setMarketState('error');
      }

      if (latestResult.status === 'fulfilled' && latestResult.value.success && latestResult.value.data) {
        setLatestPrice(latestResult.value.data);
      } else if (pricesResult.status !== 'fulfilled' || !pricesResult.value.success || !pricesResult.value.data?.bars?.length) {
        setLatestPrice(null);
      }

      if (fundamentalsResult.status === 'fulfilled' && fundamentalsResult.value.success && fundamentalsResult.value.data) {
        const data = fundamentalsResult.value.data;
        setFinanceItems(buildFinanceItems(data));
      }

      if (newsResult.status === 'fulfilled' && newsResult.value.success && newsResult.value.data?.news?.length) {
        setNewsItems(mapBackendNews(newsResult.value.data.news));
        setNewsState('ready');
      } else if (newsResult.status === 'fulfilled' && newsResult.value.success) {
        setNewsItems([]);
        setNewsState('empty');
      } else {
        setNewsItems([]);
        setNewsState('error');
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
        setFactorPanel(buildFactorPanel(factorsResult.value.data));
      } else {
        setFactorPanel({
          ...EMPTY_FACTOR_PANEL,
          state: factorsResult.status === 'fulfilled' ? 'empty' : 'error',
          message: '后端因子接口暂不可用，请检查 /api/factors 数据源。',
        });
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
      controller.abort();
    };
  }, [symbol, stockName]);

  useEffect(() => {
    const requestId = priceRefreshRequestRef.current + 1;
    priceRefreshRequestRef.current = requestId;
    const controller = new AbortController();
    const periodConfig = getPeriodConfig(activePeriod);
    const refreshSymbol = symbol;
    const isCurrent = () => priceRefreshRequestRef.current === requestId && activeSymbolRef.current === refreshSymbol && !controller.signal.aborted;

    setMarketState('loading');
    setDataStatus(`正在切换到 ${periodConfig.label} 数据...`);
    setHoveredChartIndex(null);

    api.prices(symbol, periodConfig.limit, periodConfig.frequency, { signal: controller.signal }).then((result) => {
      if (!isCurrent()) return;
      if (result.success && result.data?.bars?.length) {
        setPriceBars(result.data.bars);
        setChartData(toChartData(result.data.bars, periodConfig.frequency));
        setMarketState('ready');
        setDataStatus(`已同步 ${periodConfig.label} 行情数据`);
      } else {
        setPriceBars([]);
        setChartData([]);
        setMarketState(result.success ? 'empty' : 'error');
        setDataStatus(result.success ? `${periodConfig.label} 暂无可用数据` : result.error || `${periodConfig.label} 行情接口暂不可用`);
      }
    });

    return () => {
      controller.abort();
    };
  }, [activePeriod, symbol]);

  const handlePeriodChange = (period: string) => {
    activePeriodRef.current = period;
    setActivePeriod(period);
    setHoveredChartIndex(null);
  };

  const refreshPrices = async () => {
    const requestId = priceRefreshRequestRef.current + 1;
    priceRefreshRequestRef.current = requestId;
    const refreshSymbol = symbol;
    const periodConfig = getPeriodConfig(activePeriodRef.current);
    const isCurrent = () => priceRefreshRequestRef.current === requestId && activeSymbolRef.current === refreshSymbol;
    setIsRefreshingPrices(true);
    setMarketState('loading');
    setDataStatus(`正在刷新 ${stockName} ${periodConfig.label} 行情...`);
    const fetched = periodConfig.frequency === 'intraday'
      ? { success: true, data: { fetched: 0 }, error: null }
      : await api.priceFetch(symbol, 120);
    if (!isCurrent()) return;
    if (!fetched.success && periodConfig.frequency !== 'intraday') {
      setDataStatus(fetched.error || '行情刷新失败');
      setMarketState(priceBars.length ? 'ready' : 'error');
      setIsRefreshingPrices(false);
      return;
    }
    const [pricesResult, latestResult] = await Promise.all([
      api.prices(symbol, periodConfig.limit, periodConfig.frequency),
      api.latestPrice(symbol),
    ]);
    if (!isCurrent()) return;
    if (pricesResult.success && pricesResult.data?.bars?.length) {
      setPriceBars(pricesResult.data.bars);
      setChartData(toChartData(pricesResult.data.bars, periodConfig.frequency));
      setMarketState('ready');
    } else {
      setPriceBars([]);
      setChartData([]);
      setMarketState(pricesResult.success ? 'empty' : 'error');
    }
    if (latestResult.success && latestResult.data) {
      setLatestPrice(latestResult.data);
    } else {
      setLatestPrice(null);
    }
    setDataStatus(periodConfig.frequency === 'intraday' ? '分时行情刷新完成' : `行情刷新完成：${fetched.data?.fetched || 0} 条`);
    setIsRefreshingPrices(false);
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
  const activeFrequency = getPeriodConfig(activePeriod).frequency;
  const hasPriceData = Boolean(latestPrice || latestChartPoint);
  const currentClose = latestPrice?.close || latestChartPoint?.close || latestChartPoint?.ma20 || 0;
  const currentChange = latestPrice?.change_pct ?? latestChartPoint?.changePct ?? 0;
  const isPriceUp = Number(currentChange) >= 0;
  const periodDataHint = priceBars.length
    ? `${activePeriod} ${priceBars.length} 条${activeFrequency === '1mo' && priceBars.length < 5 ? '，样本偏少' : ''}${activeFrequency === '1w' && priceBars.length < 8 ? '，样本偏少' : ''}`
    : '等待后端行情';

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
              <span className={cn("text-sm font-mono font-medium tracking-wide", toneTextClass(item.trend))}>
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
                  disabled={isRefreshingPrices}
                  title="刷新后端行情"
                  className="px-3 py-1.5 text-xs rounded-md font-medium transition-all cursor-pointer text-neutral-500 hover:text-indigo-300 border border-transparent disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isRefreshingPrices && "animate-spin text-indigo-300")} />
                </button>
              </div>
            </div>

            <div className="px-6 py-3 flex items-center gap-8 text-[11px] font-mono whitespace-nowrap bg-black/20 border-b border-white/5">
               {activeFrequency === 'intraday' ? (
                 <>
                   <span className="text-yellow-500/90 flex items-center gap-2"><div className="w-2 h-0.5 bg-yellow-500/90"></div>分时价: {latestChartPoint ? displayNumber(Number(latestChartPoint.close || 0)) : '--'}</span>
                   <span className="text-violet-400/90 flex items-center gap-2"><div className="w-2 h-0.5 bg-violet-400/90"></div>均价: {latestChartPoint?.avgPrice ? displayNumber(Number(latestChartPoint.avgPrice)) : '--'}</span>
                   <span className="text-neutral-500 flex items-center gap-2"><div className="w-2 h-0.5 border-t border-dashed border-neutral-500"></div>昨收: {latestChartPoint?.referencePrice ? displayNumber(Number(latestChartPoint.referencePrice)) : '--'}</span>
                 </>
               ) : (
                 <>
                   <span className="text-yellow-500/90 flex items-center gap-2"><div className="w-2 h-0.5 bg-yellow-500/90"></div>MA5: {latestChartPoint?.ma5 ? displayNumber(Number(latestChartPoint.ma5)) : '--'}</span>
                   <span className="text-indigo-400/90 flex items-center gap-2"><div className="w-2 h-0.5 bg-indigo-400/90"></div>MA10: {latestChartPoint?.ma10 ? displayNumber(Number(latestChartPoint.ma10)) : '--'}</span>
                   <span className="text-emerald-400/90 flex items-center gap-2"><div className="w-2 h-0.5 bg-emerald-400/90"></div>MA20: {latestChartPoint?.ma20 ? displayNumber(Number(latestChartPoint.ma20)) : '--'}</span>
                 </>
               )}
               <span className="text-neutral-500 ml-auto">{priceBars.length ? `VOL: ${formatVolume(Number(latestChartPoint?.volume || 0))} · ${periodDataHint}` : '等待后端行情'}</span>
            </div>

             {/* Chart Area */}
             <div className="flex-1 p-5 bg-black/40 relative">
               {chartData.length === 0 && marketState !== 'ready' && (
                 <div className="absolute inset-0 z-10 flex items-center justify-center text-center text-xs text-neutral-500 bg-black/20">
                   {marketState === 'loading'
                     ? `正在同步 ${stockName} (${symbol}) 行情...`
                     : marketState === 'error'
                       ? '行情接口暂不可用，请点击刷新或稍后重试。'
                       : '暂无后端行情数据，请点击刷新或稍后重试。'}
                 </div>
               )}
               {chartData.length > 0 && (
                 <MarketChart
                   data={chartData}
                   frequency={activeFrequency}
                   activePeriod={activePeriod}
                   hoveredIndex={hoveredChartIndex}
                   onHover={setHoveredChartIndex}
                   onLeave={() => setHoveredChartIndex(null)}
                 />
               )}
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
                        {newsState === 'loading'
                          ? `正在同步 ${stockName} (${symbol}) 新闻...`
                          : newsState === 'error'
                            ? '新闻接口暂不可用，请点击刷新或稍后重试。'
                            : '暂无后端新闻数据，请点击刷新或稍后重试。'}
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
                       <span className={cn("text-2xl font-mono font-medium", toneTextClass(item.trend))}>
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
                 <motion.div key="quant" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full p-4 space-y-4">
                   {factorPanel.state === 'loading' || factorPanel.state === 'error' || factorPanel.state === 'empty' ? (
                     <div className="h-full min-h-[220px] flex items-center justify-center text-center text-xs text-neutral-500">
                       {factorPanel.message}
                     </div>
                   ) : (
                     <>
                       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                         {factorPanel.cards.map((item) => (
                           <div key={item.label} className="bg-white/[0.03] border border-white/5 p-4 rounded-xl">
                             <div className="flex items-center justify-between gap-3">
                               <span className="text-xs text-neutral-500">{item.label}</span>
                               <Settings2 className="w-3.5 h-3.5 text-neutral-600" />
                             </div>
                             <div className={cn("mt-2 text-2xl font-mono font-medium", toneTextClass(item.tone))}>{item.value}</div>
                             <div className="mt-1 text-[10px] leading-relaxed text-neutral-500">{item.detail}</div>
                           </div>
                         ))}
                       </div>
                       <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-4">
                         <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                           <div className="text-xs text-neutral-500 mb-3">样本量</div>
                           <div className="space-y-2">
                             {factorPanel.counts.map(item => (
                               <div key={item.label} className="flex items-center justify-between text-xs">
                                 <span className="text-neutral-500">{item.label}</span>
                                 <span className="font-mono text-neutral-200">{item.value}</span>
                               </div>
                             ))}
                           </div>
                         </div>
                         <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 min-w-0">
                           <div className="flex items-center justify-between gap-3 mb-3">
                             <span className="text-xs text-neutral-500">关键信号</span>
                             {factorPanel.computedAt && <span className="text-[10px] text-neutral-600 font-mono">{factorPanel.computedAt.slice(0, 19).replace('T', ' ')}</span>}
                           </div>
                           {factorPanel.signals.length ? (
                             <div className="space-y-2">
                               {factorPanel.signals.map((signal, index) => (
                                 <div key={`${signal.type}-${index}`} className="flex items-start gap-3 text-xs">
                                   <span className="shrink-0 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px]">{signal.type}</span>
                                   <div className="min-w-0">
                                     <div className="text-neutral-200 truncate">{signal.title}</div>
                                     <div className="text-[10px] text-neutral-500 mt-0.5">{signal.meta}</div>
                                   </div>
                                 </div>
                               ))}
                             </div>
                           ) : (
                             <div className="text-xs text-neutral-500">暂无可展示信号，后端样本量可能为 0。</div>
                           )}
                         </div>
                       </div>
                     </>
                   )}
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
            <button onClick={refreshPrices} title="刷新行情与面板数据" disabled={isRefreshingPrices} className="p-1.5 hover:bg-white/5 rounded-md text-neutral-500 transition-colors disabled:opacity-50">
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshingPrices && "animate-spin text-indigo-300")} />
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
