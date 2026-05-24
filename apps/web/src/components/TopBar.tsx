"use client";

import { useState } from "react";
import { Search, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function TopBar() {
  const [searchValue, setSearchValue] = useState("");

  return (
    <header className="h-[60px] bg-black/20 border-b border-white/[0.02] backdrop-blur-md flex items-center justify-between px-6 text-neutral-400 z-10 flex-shrink-0">
      <div className="flex items-center gap-6 flex-1">
        <div className="flex items-center gap-4">
          <div className="relative w-72 flex items-center group">
            <Search className="w-4 h-4 absolute left-3.5 text-neutral-500 group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="搜索标的 / 贵州茅台 (600519)"
              className="w-full bg-white/[0.03] border border-white/[0.05] rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all text-neutral-200 placeholder:text-neutral-500 shadow-inner"
            />
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
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
          <span className="text-[11px] font-medium tracking-wider">系统在线</span>
        </div>
      </div>
    </header>
  );
}
