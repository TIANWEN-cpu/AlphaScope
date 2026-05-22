"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { getPrices, fetchPrices, type PriceBar } from "@/lib/api";

interface KLinePanelProps {
  symbol: string;
  stockName: string;
}

type Timeframe = "分时" | "日K" | "周K" | "月K";

export function KLinePanel({ symbol, stockName }: KLinePanelProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("日K");
  const [data, setData] = useState<PriceBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [crosshair, setCrosshair] = useState<{
    x: number;
    y: number;
    item: PriceBar;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      let bars: PriceBar[] = [];
      try {
        const res = await getPrices(symbol, "1d", 250);
        bars = res.bars || [];
      } catch {
        // No data, try fetching
        await fetchPrices(symbol, 60);
        const res = await getPrices(symbol, "1d", 250);
        bars = res.bars || [];
      }
      setData(bars);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [symbol]);

  // Compute MA lines
  const ma5 = useMemo(
    () =>
      data.map((_, i) =>
        i < 4
          ? null
          : data.slice(i - 4, i + 1).reduce((a, d) => a + d.close, 0) / 5
      ),
    [data]
  );

  const ma10 = useMemo(
    () =>
      data.map((_, i) =>
        i < 9
          ? null
          : data.slice(i - 9, i + 1).reduce((a, d) => a + d.close, 0) / 10
      ),
    [data]
  );

  const ma20 = useMemo(
    () =>
      data.map((_, i) =>
        i < 19
          ? null
          : data.slice(i - 19, i + 1).reduce((a, d) => a + d.close, 0) / 20
      ),
    [data]
  );

  if (data.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#0d0d0f] items-center justify-center">
        {loading ? (
          <div className="text-zinc-500 text-sm flex items-center gap-2">
            <RefreshCw size={14} className="animate-spin" />
            加载行情数据...
          </div>
        ) : (
          <div className="text-center">
            <div className="text-zinc-600 text-sm mb-2">
              暂无 {stockName} 的行情数据
            </div>
            <button
              onClick={loadData}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              点击获取行情
            </button>
          </div>
        )}
      </div>
    );
  }

  const last = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : last;
  const isUp = last.close >= prev.close;
  const changePct =
    prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0;

  const minP = Math.min(...data.map((d) => d.low));
  const maxP = Math.max(...data.map((d) => d.high));
  const range = maxP - minP || 1;
  const maxVol = Math.max(...data.map((d) => d.volume)) || 1;

  const SVG_W = 1000;
  const SVG_H = 260;
  const VOL_H = 80;
  const PAD = 15;

  const getY = (p: number) =>
    SVG_H - PAD - ((p - minP) / range) * (SVG_H - PAD * 2);
  const getX = (i: number) =>
    (i / data.length) * SVG_W + SVG_W / data.length / 2;
  const candleW = (SVG_W / data.length) * 0.6;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const vX = (x / rect.width) * SVG_W;
    const itemIndex = Math.min(
      data.length - 1,
      Math.max(0, Math.floor(vX / (SVG_W / data.length)))
    );

    setCrosshair({
      x: (x / rect.width) * SVG_W,
      y: (y / rect.height) * (SVG_H + VOL_H),
      item: data[itemIndex],
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f] relative group">
      {/* Header */}
      <div className="px-4 py-3 flex items-start justify-between border-b border-zinc-800/80 bg-[#18181b]/50 absolute top-0 w-full z-10 backdrop-blur-md">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-bold text-zinc-100 font-sans tracking-tight">
              {stockName}
            </h1>
            <span className="text-zinc-500 font-mono text-sm">{symbol}</span>
            <div
              className={`flex items-center gap-1 border px-2 rounded ml-2 ${
                isUp
                  ? "bg-red-500/10 border-red-500/20 text-red-500"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
              }`}
            >
              <span className="font-mono text-lg font-semibold">
                {last.close.toFixed(2)}
              </span>
              {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              <span className="font-mono text-xs">
                {changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="flex gap-4 text-[10px] font-mono text-zinc-400 mt-1">
            <span>
              MA5:{" "}
              <span className="text-yellow-500">
                {ma5[ma5.length - 1]?.toFixed(2) ?? "--"}
              </span>
            </span>
            <span>
              MA10:{" "}
              <span className="text-purple-500">
                {ma10[ma10.length - 1]?.toFixed(2) ?? "--"}
              </span>
            </span>
            <span>
              MA20:{" "}
              <span className="text-cyan-500">
                {ma20[ma20.length - 1]?.toFixed(2) ?? "--"}
              </span>
            </span>
            <span>VOL: {last.volume.toFixed(0)}</span>
          </div>
        </div>

        {/* Timeframe toggles */}
        <div className="flex bg-[#09090b] rounded-lg border border-zinc-800 p-1 text-xs">
          {(["分时", "日K", "周K", "月K"] as Timeframe[]).map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1 rounded-md transition-colors focus:outline-none ${
                timeframe === t
                  ? "bg-zinc-800 text-zinc-100 font-medium shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 relative mt-[70px] cursor-crosshair overflow-hidden">
        <svg
          key={`${symbol}-${timeframe}`}
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H + VOL_H}`}
          preserveAspectRatio="none"
          className="w-full h-full block animate-fade-in"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setCrosshair(null)}
        >
          {/* Grid */}
          <g className="text-zinc-800/30">
            <line
              x1="0"
              y1={SVG_H / 4}
              x2={SVG_W}
              y2={SVG_H / 4}
              stroke="currentColor"
              strokeDasharray="2 4"
              strokeWidth="1"
            />
            <line
              x1="0"
              y1={SVG_H / 2}
              x2={SVG_W}
              y2={SVG_H / 2}
              stroke="currentColor"
              strokeDasharray="2 4"
              strokeWidth="1"
            />
            <line
              x1="0"
              y1={SVG_H * 0.75}
              x2={SVG_W}
              y2={SVG_H * 0.75}
              stroke="currentColor"
              strokeDasharray="2 4"
              strokeWidth="1"
            />
            <line
              x1="0"
              y1={SVG_H}
              x2={SVG_W}
              y2={SVG_H}
              stroke="#27272a"
              strokeWidth="1"
            />
          </g>

          {/* MA lines */}
          <polyline
            points={ma5
              .map((v, i) => (v !== null ? `${getX(i)},${getY(v)}` : ""))
              .filter(Boolean)
              .join(" ")}
            fill="none"
            stroke="#eab308"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <polyline
            points={ma10
              .map((v, i) => (v !== null ? `${getX(i)},${getY(v)}` : ""))
              .filter(Boolean)
              .join(" ")}
            fill="none"
            stroke="#a855f7"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <polyline
            points={ma20
              .map((v, i) => (v !== null ? `${getX(i)},${getY(v)}` : ""))
              .filter(Boolean)
              .join(" ")}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* Candles */}
          {data.map((d, i) => {
            const isRed = d.close >= d.open;
            const color = isRed ? "#ef4444" : "#10b981";
            const x = getX(i);
            const yTop = getY(Math.max(d.open, d.close));
            const yBot = getY(Math.min(d.open, d.close));
            const yHigh = getY(d.high);
            const yLow = getY(d.low);
            const volH = (d.volume / maxVol) * (VOL_H - 10);
            const volY = SVG_H + VOL_H - volH;

            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={yHigh}
                  x2={x}
                  y2={yLow}
                  stroke={color}
                  strokeWidth="1"
                />
                <rect
                  x={x - candleW / 2}
                  y={yTop}
                  width={candleW}
                  height={Math.max(yBot - yTop, 1)}
                  fill={isRed ? "#0d0d0f" : color}
                  stroke={color}
                  strokeWidth="1"
                />
                <rect
                  x={x - candleW / 2}
                  y={volY}
                  width={candleW}
                  height={volH}
                  fill={color}
                  opacity={isRed ? 0.3 : 0.7}
                />
              </g>
            );
          })}

          {/* Crosshair */}
          {crosshair && (
            <g className="pointer-events-none">
              <line
                x1={crosshair.x}
                y1="0"
                x2={crosshair.x}
                y2={SVG_H + VOL_H}
                stroke="#71717a"
                strokeWidth="0.5"
                strokeDasharray="4 4"
              />
              <line
                x1="0"
                y1={crosshair.y}
                x2={SVG_W}
                y2={crosshair.y}
                stroke="#71717a"
                strokeWidth="0.5"
                strokeDasharray="4 4"
              />
              {crosshair.y <= SVG_H && (
                <g>
                  <rect
                    x={SVG_W - 55}
                    y={crosshair.y - 10}
                    width="55"
                    height="20"
                    fill="#27272a"
                  />
                  <text
                    x={SVG_W - 27}
                    y={crosshair.y + 4}
                    fill="#fafafa"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {(
                      minP +
                      ((SVG_H - PAD - crosshair.y) / (SVG_H - PAD * 2)) * range
                    ).toFixed(2)}
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>

        {/* Price scale */}
        <div className="absolute right-0 top-0 bottom-[80px] w-12 border-l border-zinc-800/30 flex flex-col justify-between py-[15px] pointer-events-none">
          <div className="text-[10px] text-zinc-500 font-mono text-center bg-[#0d0d0f]/80">
            {maxP.toFixed(2)}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono text-center bg-[#0d0d0f]/80">
            {((maxP + minP) / 2).toFixed(2)}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono text-center bg-[#0d0d0f]/80">
            {minP.toFixed(2)}
          </div>
        </div>

        {/* Tooltip */}
        {crosshair && crosshair.item && (
          <div className="absolute top-2 right-14 bg-[#18181b]/95 border border-zinc-700 p-2 rounded shadow-xl text-[10px] font-mono pointer-events-none backdrop-blur z-20 flex gap-4 text-zinc-300">
            <div className="text-blue-400 font-bold">
              {crosshair.item.date}
            </div>
            <div>
              开:
              <span
                className={
                  crosshair.item.open < crosshair.item.close
                    ? "text-emerald-400"
                    : "text-red-400"
                }
              >
                {crosshair.item.open.toFixed(2)}
              </span>
            </div>
            <div>
              收:
              <span
                className={
                  crosshair.item.close >= crosshair.item.open
                    ? "text-red-400"
                    : "text-emerald-400"
                }
              >
                {crosshair.item.close.toFixed(2)}
              </span>
            </div>
            <div>高:{crosshair.item.high.toFixed(2)}</div>
            <div>低:{crosshair.item.low.toFixed(2)}</div>
            <div>量:{crosshair.item.volume.toFixed(0)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
