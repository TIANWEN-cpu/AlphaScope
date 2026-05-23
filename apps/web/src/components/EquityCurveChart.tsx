"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Line,
} from "recharts";

interface EquityCurveChartProps {
  equityCurve: number[];
  dates: string[];
  initialCapital?: number;
  trades?: Array<{ timestamp: string; side: string; price: number }>;
}

export function EquityCurveChart({
  equityCurve,
  dates,
  initialCapital,
  trades,
}: EquityCurveChartProps) {
  const data = equityCurve.map((value, i) => ({
    date: dates[i] || `Day ${i + 1}`,
    equity: Math.round(value * 100) / 100,
  }));

  const base = initialCapital ?? equityCurve[0] ?? 100000;

  // Buy/sell markers
  const buyDates = new Set(
    (trades ?? []).filter((t) => t.side === "buy").map((t) => t.timestamp)
  );
  const sellDates = new Set(
    (trades ?? []).filter((t) => t.side === "sell").map((t) => t.timestamp)
  );

  const markerData = data.map((d) => ({
    ...d,
    buy: buyDates.has(d.date) ? d.equity : undefined,
    sell: sellDates.has(d.date) ? d.equity : undefined,
  }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={markerData}>
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="date"
            stroke="#52525b"
            tick={{ fontSize: 10, fontFamily: "monospace" }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#52525b"
            tick={{ fontSize: 10, fontFamily: "monospace" }}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#171717",
              borderColor: "#262626",
              borderRadius: "6px",
              fontSize: "12px",
              fontFamily: "monospace",
            }}
            itemStyle={{ color: "#e5e5e5" }}
          />
          <ReferenceLine
            y={base}
            stroke="#52525b"
            strokeDasharray="3 3"
            label={{
              value: "初始资金",
              fill: "#737373",
              fontSize: 10,
              fontFamily: "monospace",
            }}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="#6366f1"
            fill="url(#equityGrad)"
            strokeWidth={2}
            name="权益"
          />
          <Line
            type="monotone"
            dataKey="buy"
            stroke="#22c55e"
            strokeWidth={0}
            dot={{ r: 4, fill: "#22c55e", stroke: "#052e16", strokeWidth: 1 }}
            name="买入"
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="sell"
            stroke="#ef4444"
            strokeWidth={0}
            dot={{ r: 4, fill: "#ef4444", stroke: "#450a0a", strokeWidth: 1 }}
            name="卖出"
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
