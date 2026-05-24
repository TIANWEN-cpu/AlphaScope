"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Settings,
  LineChart,
  Bookmark,
  Users,
  Activity,
  Newspaper,
  BarChart2,
  PieChart,
  Table,
  Brain,
  ListTodo,
  Zap,
  TrendingUp,
  Briefcase,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavView =
  | "dashboard"
  | "news"
  | "fundflow"
  | "fundamentals"
  | "data"
  | "agent"
  | "archive"
  | "expert"
  | "health"
  | "settings"
  | "tasks"
  | "quant"
  | "fund"
  | "portfolio";

interface SidebarRailProps {
  activeView: NavView;
  onNav: (view: NavView) => void;
}

const NAV_GROUPS = [
  {
    label: "AI 投研体系",
    items: [
      { view: "dashboard" as NavView, icon: LayoutDashboard, title: "工作台" },
      { view: "news" as NavView, icon: Newspaper, title: "资讯与研报" },
      { view: "fundflow" as NavView, icon: BarChart2, title: "资金流向" },
      { view: "fundamentals" as NavView, icon: PieChart, title: "基本面" },
      { view: "data" as NavView, icon: Table, title: "行情明细" },
      { view: "agent" as NavView, icon: Brain, title: "Agent分析" },
      { view: "expert" as NavView, icon: Users, title: "专家圆桌" },
      { view: "archive" as NavView, icon: Bookmark, title: "研究存档" },
    ],
  },
  {
    label: "金策智算引擎",
    items: [
      { view: "quant" as NavView, icon: Zap, title: "量化实验室" },
      { view: "fund" as NavView, icon: TrendingUp, title: "基金定投" },
      { view: "portfolio" as NavView, icon: Briefcase, title: "组合管理" },
      { view: "tasks" as NavView, icon: ListTodo, title: "任务中心" },
      { view: "health" as NavView, icon: Activity, title: "数据源" },
    ],
  },
];

export function SidebarRail({ activeView, onNav }: SidebarRailProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      animate={{ width: expanded ? 220 : 72 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="bg-[#050505] border-r border-white/5 flex flex-col z-20 flex-shrink-0 relative overflow-hidden"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-white/5 flex-shrink-0">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]">
          <LineChart size={18} strokeWidth={2.5} />
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="ml-3 text-sm font-display font-semibold text-white whitespace-nowrap"
            >
              AI-Finance
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-2">
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-5 py-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-600 whitespace-nowrap"
                >
                  {group.label}
                </motion.div>
              )}
            </AnimatePresence>
            {!expanded && <div className="h-px bg-white/5 mx-3 my-2" />}
            <div className="flex flex-col gap-0.5 px-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.view;
                return (
                  <button
                    key={item.view}
                    onClick={() => onNav(item.view)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group",
                      isActive
                        ? "text-indigo-400"
                        : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.05)]"
                        initial={false}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <Icon className="w-5 h-5 relative z-10 flex-shrink-0" />
                    <AnimatePresence>
                      {expanded && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="text-sm font-medium relative z-10 whitespace-nowrap"
                        >
                          {item.title}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="border-t border-white/5 p-2 flex-shrink-0">
        <button
          onClick={() => onNav("settings")}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 w-full relative",
            activeView === "settings"
              ? "text-indigo-400"
              : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]"
          )}
        >
          {activeView === "settings" && (
            <motion.div
              layoutId="sidebar-active"
              className="absolute inset-0 bg-indigo-500/10 rounded-xl border border-indigo-500/20"
              initial={false}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <Settings className="w-5 h-5 relative z-10 flex-shrink-0" />
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-sm font-medium relative z-10 whitespace-nowrap"
              >
                系统设置
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Expand/Collapse Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="absolute top-20 -right-3 w-6 h-6 bg-[#0a0a0f] border border-white/10 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-300 hover:bg-[#1a1a2e] transition-colors z-30"
      >
        {expanded ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>
    </motion.div>
  );
}
