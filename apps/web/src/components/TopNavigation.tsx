"use client";

import { useState, useEffect } from "react";
import { Search, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { getHealth } from "@/lib/api";

interface StockInfo {
  symbol: string;
  name: string;
}

const PRESET_STOCKS: StockInfo[] = [
  { symbol: "600519", name: "贵州茅台" },
  { symbol: "300750", name: "宁德时代" },
  { symbol: "000858", name: "五粮液" },
  { symbol: "601318", name: "中国平安" },
  { symbol: "000001", name: "平安银行" },
  { symbol: "600036", name: "招商银行" },
];

interface TopNavigationProps {
  activeSymbol: string;
  activeName: string;
  onSelectStock: (symbol: string, name: string) => void;
}

export function TopNavigation({
  activeSymbol,
  activeName,
  onSelectStock,
}: TopNavigationProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [apiStatus, setApiStatus] = useState<"online" | "offline" | "checking">(
    "checking"
  );

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await getHealth();
        setApiStatus("online");
      } catch {
        setApiStatus("offline");
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-12 bg-[#09090b] border-b border-zinc-800/50 px-4 flex items-center justify-between flex-shrink-0 z-30 relative">
      <div className="flex items-center gap-4 flex-1">
        {/* Stock Selector Dropdown */}
        <div
          className="relative group"
          onMouseLeave={() => setShowDropdown(false)}
        >
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            placeholder={`${activeName} (${activeSymbol})`}
            onFocus={() => setShowDropdown(true)}
            readOnly
            className="bg-[#18181b] border border-zinc-800 cursor-pointer text-zinc-100 text-xs rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 w-56 transition-all"
          />
          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-[#18181b] border border-zinc-700/80 rounded-lg shadow-2xl z-50 overflow-hidden animate-fade-in">
              <div className="text-[10px] text-zinc-500 px-3 py-2 font-medium bg-[#09090b] border-b border-zinc-800">
                切换标的 (点击选择)
              </div>
              {PRESET_STOCKS.map((stock) => (
                <div
                  key={stock.symbol}
                  onClick={() => {
                    onSelectStock(stock.symbol, stock.name);
                    setShowDropdown(false);
                  }}
                  className={`px-3 py-2.5 cursor-pointer flex justify-between text-xs transition-colors ${
                    activeSymbol === stock.symbol
                      ? "bg-blue-500/10 text-blue-400"
                      : "hover:bg-zinc-800 text-zinc-300"
                  }`}
                >
                  <span className="font-medium">{stock.name}</span>
                  <span className="font-mono opacity-60">{stock.symbol}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-zinc-800" />

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-zinc-500">A股</span>
          <span className="text-zinc-300">研究工作台</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 text-[10px] border px-2 py-1 rounded ${
            apiStatus === "online"
              ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
              : apiStatus === "offline"
              ? "text-red-500 bg-red-500/10 border-red-500/20"
              : "text-zinc-500 bg-zinc-500/10 border-zinc-500/20"
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              apiStatus === "online"
                ? "bg-emerald-500 animate-pulse"
                : apiStatus === "offline"
                ? "bg-red-500"
                : "bg-zinc-500 animate-pulse"
            }`}
          />
          {apiStatus === "online"
            ? "API 在线"
            : apiStatus === "offline"
            ? "API 离线"
            : "检测中..."}
        </div>
      </div>
    </div>
  );
}
