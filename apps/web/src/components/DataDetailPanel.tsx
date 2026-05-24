"use client";

import { useState, useEffect } from "react";
import { Table, RefreshCw } from "lucide-react";
import { getPrices, type PriceBar } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DataDetailPanelProps {
  symbol: string;
  stockName: string;
}

export function DataDetailPanel({ symbol, stockName }: DataDetailPanelProps) {
  const [data, setData] = useState<PriceBar[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getPrices(symbol, "1d", 30);
        setData(res.bars || []);
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [symbol]);

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6 gap-4 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-medium text-white flex items-center gap-3">
          <Table size={22} className="text-indigo-400" />
          行情明细
          <span className="text-xs text-neutral-500 font-mono font-normal ml-2">
            {stockName} ({symbol}) · 近30个交易日
          </span>
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
          <RefreshCw size={14} className="animate-spin mr-2" />
          加载行情数据...
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-neutral-600">
          <Table size={32} className="opacity-20 mb-2" />
          <p className="text-sm">暂无行情数据</p>
        </div>
      ) : (
        <div className="bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-black/20">
                  <th className="px-4 py-2.5 text-left text-neutral-500 font-mono font-normal">日期</th>
                  <th className="px-4 py-2.5 text-right text-neutral-500 font-mono font-normal">开盘</th>
                  <th className="px-4 py-2.5 text-right text-neutral-500 font-mono font-normal">最高</th>
                  <th className="px-4 py-2.5 text-right text-neutral-500 font-mono font-normal">最低</th>
                  <th className="px-4 py-2.5 text-right text-neutral-500 font-mono font-normal">收盘</th>
                  <th className="px-4 py-2.5 text-right text-neutral-500 font-mono font-normal">涨跌%</th>
                  <th className="px-4 py-2.5 text-right text-neutral-500 font-mono font-normal">成交量</th>
                  <th className="px-4 py-2.5 text-right text-neutral-500 font-mono font-normal">成交额</th>
                  <th className="px-4 py-2.5 text-right text-neutral-500 font-mono font-normal">换手%</th>
                </tr>
              </thead>
              <tbody>
                {data.map((bar, i) => {
                  const changePct = bar.open > 0
                    ? ((bar.close - bar.open) / bar.open) * 100
                    : 0;
                  return (
                    <tr
                      key={i}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-2 text-neutral-400 font-mono">{bar.date}</td>
                      <td className="px-4 py-2 text-right text-neutral-300 font-mono">{bar.open.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-neutral-300 font-mono">{bar.high.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-neutral-300 font-mono">{bar.low.toFixed(2)}</td>
                      <td className={cn(
                        "px-4 py-2 text-right font-mono font-medium",
                        changePct >= 0 ? "text-rose-400" : "text-emerald-400"
                      )}>
                        {bar.close.toFixed(2)}
                      </td>
                      <td className={cn(
                        "px-4 py-2 text-right font-mono",
                        changePct >= 0 ? "text-rose-400" : "text-emerald-400"
                      )}>
                        {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2 text-right text-neutral-400 font-mono">
                        {bar.volume >= 10000
                          ? `${(bar.volume / 10000).toFixed(0)}万`
                          : bar.volume.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right text-neutral-400 font-mono">
                        {(bar as unknown as Record<string, unknown>).amount
                          ? Number((bar as unknown as Record<string, unknown>).amount) >= 100000000
                            ? `${(Number((bar as unknown as Record<string, unknown>).amount) / 100000000).toFixed(2)}亿`
                            : Number((bar as unknown as Record<string, unknown>).amount) >= 10000
                            ? `${(Number((bar as unknown as Record<string, unknown>).amount) / 10000).toFixed(0)}万`
                            : Number((bar as unknown as Record<string, unknown>).amount).toLocaleString()
                          : "--"}
                      </td>
                      <td className="px-4 py-2 text-right text-neutral-400 font-mono">
                        {(bar as unknown as Record<string, unknown>).turnover
                          ? `${Number((bar as unknown as Record<string, unknown>).turnover).toFixed(2)}%`
                          : "--"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
