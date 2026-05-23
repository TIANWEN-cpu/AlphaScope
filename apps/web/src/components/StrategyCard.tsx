"use client";

import { Play, Settings2 } from "lucide-react";

interface StrategyCardProps {
  name: string;
  description: string;
  defaultParams: Record<string, number>;
  selected?: boolean;
  onSelect?: () => void;
  onRun?: () => void;
}

export function StrategyCard({
  name,
  description,
  defaultParams,
  selected,
  onSelect,
  onRun,
}: StrategyCardProps) {
  const displayName = name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      onClick={onSelect}
      className={`glass glass-hover rounded-2xl p-6 cursor-pointer transition-all duration-300 ${
        selected ? "border-indigo-500/50 glow-indigo" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-neutral-200">{displayName}</h3>
        {selected && (
          <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
            已选
          </span>
        )}
      </div>

      <p className="text-xs text-neutral-400 mb-4 line-clamp-2">{description}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(defaultParams).map(([key, val]) => (
          <span
            key={key}
            className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-neutral-400 border border-white/5 font-mono"
          >
            {key}={val}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
          className="flex-1 px-3 py-1.5 glass rounded-lg text-[10px] font-mono uppercase text-neutral-400 hover:text-neutral-200 transition-colors flex items-center justify-center gap-1"
        >
          <Settings2 className="w-3 h-3" /> 参数
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRun?.();
          }}
          className="flex-1 px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-500 rounded-lg text-[10px] font-mono uppercase text-white transition-colors flex items-center justify-center gap-1"
        >
          <Play className="w-3 h-3 fill-current" /> 运行
        </button>
      </div>
    </div>
  );
}
