"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getHealth } from "@/lib/api";

interface StockInfo {
  symbol: string;
  name: string;
  market: string;
}

const PRESET_STOCKS: StockInfo[] = [
  { symbol: "600519", name: "贵州茅台", market: "SH" },
  { symbol: "300750", name: "宁德时代", market: "SZ" },
  { symbol: "000858", name: "五粮液", market: "SZ" },
  { symbol: "601318", name: "中国平安", market: "SH" },
  { symbol: "000001", name: "平安银行", market: "SZ" },
  { symbol: "600036", name: "招商银行", market: "SH" },
];

interface TopBarProps {
  activeSymbol: string;
  activeName: string;
  onSelectStock: (symbol: string, name: string) => void;
}

export function TopBar({
  activeSymbol,
  activeName,
  onSelectStock,
}: TopBarProps) {
  const [searchValue, setSearchValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [apiStatus, setApiStatus] = useState<"online" | "offline" | "checking">(
    "checking"
  );

  const filteredStocks = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return PRESET_STOCKS;
    return PRESET_STOCKS.filter(
      (stock) =>
        stock.symbol.includes(query) ||
        stock.name.toLowerCase().includes(query)
    );
  }, [searchValue]);

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
    const timer = window.setInterval(checkHealth, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const selectStock = (stock: StockInfo) => {
    onSelectStock(stock.symbol, stock.name);
    setSearchValue("");
    setShowDropdown(false);
  };

  const submitSearch = () => {
    const query = searchValue.trim();
    if (!query) return;
    const match = filteredStocks[0];
    if (match) {
      selectStock(match);
      return;
    }
    if (/^\d{6}$/.test(query)) {
      onSelectStock(query, query);
      setSearchValue("");
      setShowDropdown(false);
    }
  };

  return (
    <header className="h-[60px] bg-black/20 border-b border-white/[0.02] backdrop-blur-md flex items-center justify-between px-6 text-neutral-400 z-10 flex-shrink-0">
      <div className="flex items-center gap-6 flex-1">
        <div className="flex items-center gap-4">
          <div
            className="relative w-72 flex items-center group"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setShowDropdown(false);
              }
            }}
          >
            <Search className="w-4 h-4 absolute left-3.5 text-neutral-500 group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitSearch();
                }
              }}
              placeholder={`${activeName} (${activeSymbol})`}
              className="w-full bg-white/[0.03] border border-white/[0.05] rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all text-neutral-200 placeholder:text-neutral-500 shadow-inner"
            />
            {showDropdown && (
              <div className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0f]/95 shadow-2xl backdrop-blur-xl">
                <div className="border-b border-white/5 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                  标的选择
                </div>
                {filteredStocks.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-neutral-500">
                    输入 6 位股票代码后按 Enter 添加
                  </div>
                ) : (
                  filteredStocks.map((stock) => (
                    <button
                      key={stock.symbol}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectStock(stock)}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2.5 text-xs transition-colors",
                        activeSymbol === stock.symbol
                          ? "bg-indigo-500/10 text-indigo-300"
                          : "text-neutral-300 hover:bg-white/[0.04]"
                      )}
                    >
                      <span className="font-medium">{stock.name}</span>
                      <span className="font-mono text-neutral-500">
                        {stock.market} {stock.symbol}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="h-5 w-px bg-white/10 mx-1" />
          <span className="text-sm text-neutral-400 font-medium tracking-wide flex items-center gap-2">
            A股 研究工作台
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
              PRO
            </span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="relative p-2 hover:bg-white/5 rounded-lg transition-colors text-neutral-500 hover:text-neutral-300"
        >
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-[#050505]" />
        </motion.button>
        <div
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5",
            apiStatus === "online" &&
              "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
            apiStatus === "offline" &&
              "border-rose-500/20 bg-rose-500/10 text-rose-400",
            apiStatus === "checking" &&
              "border-white/10 bg-white/[0.03] text-neutral-400"
          )}
        >
          <div
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              apiStatus === "online" &&
                "animate-pulse bg-emerald-400 shadow-[0_0_5px_rgba(16,185,129,0.5)]",
              apiStatus === "offline" && "bg-rose-400",
              apiStatus === "checking" && "animate-pulse bg-neutral-500"
            )}
          />
          <span className="text-[11px] font-medium tracking-wider">
            {apiStatus === "online"
              ? "API 在线"
              : apiStatus === "offline"
                ? "API 离线"
                : "检测中"}
          </span>
        </div>
      </div>
    </header>
  );
}
