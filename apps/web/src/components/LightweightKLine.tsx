import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from 'lightweight-charts';

/**
 * 专业 K 线渲染器 (TradingView Lightweight Charts)。
 *
 * 相比 recharts 自绘蜡烛,提供真·缩放/平移/十字光标/价格刻度对齐,适合密集 K 线。
 * 作为「交互K线」页的**专业渲染模式**接入,与原 recharts「经典」模式并存(只增不替)。
 *
 * 输入沿用既有 KLinePoint 形状(date/open/high/low/close + 可选 ma5/ma20),无需新取数。
 * A 股配色:涨红 / 跌绿。
 */

export interface KLineBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  ma5?: number;
  ma20?: number;
}

interface Props {
  data: KLineBar[];
  showMA?: boolean;
}

const UP = '#f43f5e'; // 涨红
const DOWN = '#10b981'; // 跌绿

/** 'YYYY-MM-DD' 或 'YYYY-MM-DD HH:MM' → UTC 秒(lightweight-charts 要求时间唯一且升序)。 */
function toTime(date: string): UTCTimestamp {
  const ms = Date.parse(date.replace(' ', 'T'));
  return Math.floor((Number.isNaN(ms) ? 0 : ms) / 1000) as UTCTimestamp;
}

export function LightweightKLine({ data, showMA = true }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ma5Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);

  // 建图一次(挂载时)。autoSize 让图表自适应容器宽高。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'rgba(0,0,0,0)' },
        textColor: '#a3a3a3',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: false, secondsVisible: false },
    });

    const candle = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    const ma5 = chart.addLineSeries({ color: '#facc15', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const ma20 = chart.addLineSeries({ color: '#38bdf8', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });

    chartRef.current = chart;
    candleRef.current = candle;
    ma5Ref.current = ma5;
    ma20Ref.current = ma20;

    // 十字光标移动时在左上角显示该根 K 线的 OHLC。
    chart.subscribeCrosshairMove((param) => {
      const legend = legendRef.current;
      if (!legend) return;
      const c = param.seriesData.get(candle) as CandlestickData | undefined;
      if (!c) {
        legend.textContent = '';
        return;
      }
      const up = c.close >= c.open;
      legend.textContent = `开 ${c.open}　高 ${c.high}　低 ${c.low}　收 ${c.close}　${up ? '▲' : '▼'}`;
      legend.style.color = up ? UP : DOWN;
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      ma5Ref.current = null;
      ma20Ref.current = null;
    };
  }, []);

  // 数据变化时刷新(去重 + 升序;均线仅取有限正值,避免预热段 NaN)。
  useEffect(() => {
    const candle = candleRef.current;
    const chart = chartRef.current;
    if (!candle || !chart) return;

    const seen = new Map<number, CandlestickData>();
    const byTime = new Map<number, KLineBar>();
    for (const b of data || []) {
      const t = toTime(b.date);
      seen.set(t, { time: t as UTCTimestamp, open: b.open, high: b.high, low: b.low, close: b.close });
      byTime.set(t, b);
    }
    const candles = [...seen.values()].sort((a, b) => (a.time as number) - (b.time as number));

    const m5: LineData[] = [];
    const m20: LineData[] = [];
    for (const c of candles) {
      const t = c.time as number;
      const b = byTime.get(t);
      if (!b) continue;
      if (typeof b.ma5 === 'number' && Number.isFinite(b.ma5) && b.ma5 > 0) m5.push({ time: t as UTCTimestamp, value: b.ma5 });
      if (typeof b.ma20 === 'number' && Number.isFinite(b.ma20) && b.ma20 > 0) m20.push({ time: t as UTCTimestamp, value: b.ma20 });
    }

    candle.setData(candles);
    ma5Ref.current?.setData(showMA ? m5 : []);
    ma20Ref.current?.setData(showMA ? m20 : []);
    chart.timeScale().fitContent();
  }, [data, showMA]);

  return (
    <div className="relative h-full w-full" style={{ minHeight: 220 }}>
      <div ref={legendRef} className="pointer-events-none absolute left-2 top-1.5 z-10 font-mono text-[10px]" />
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
