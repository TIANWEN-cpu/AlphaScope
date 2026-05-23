"use client";

import { TrendingUp, TrendingDown, Shield, Target, BarChart, Percent } from "lucide-react";

interface RiskMetricsPanelProps {
  metrics: {
    total_return: number;
    annualized_return: number;
    max_drawdown: number;
    sharpe_ratio: number;
    sortino_ratio: number;
    calmar_ratio: number;
    win_rate: number;
    profit_factor: number;
    total_trades: number;
    initial_capital: number;
    final_equity: number;
    trading_days: number;
  };
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}

function MetricCard({ label, value, icon, color, sub }: MetricCardProps) {
  return (
    <div className="glass glass-hover rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${color}`}>{icon}</div>
        <span className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-xl font-mono text-neutral-100">{value}</div>
      {sub && <div className="text-[10px] font-mono text-neutral-500">{sub}</div>}
    </div>
  );
}

export function RiskMetricsPanel({ metrics }: RiskMetricsPanelProps) {
  const fmt = (v: number, suffix = "%") =>
    `${v >= 0 ? "+" : ""}${v.toFixed(2)}${suffix}`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <MetricCard
        label="总收益率"
        value={fmt(metrics.total_return)}
        icon={<TrendingUp className="w-4 h-4" />}
        color={
          metrics.total_return >= 0
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-red-500/10 text-red-400"
        }
        sub={`${metrics.trading_days} 个交易日`}
      />
      <MetricCard
        label="年化收益"
        value={fmt(metrics.annualized_return)}
        icon={<Percent className="w-4 h-4" />}
        color="bg-indigo-500/10 text-indigo-400"
      />
      <MetricCard
        label="最大回撤"
        value={fmt(metrics.max_drawdown)}
        icon={<TrendingDown className="w-4 h-4" />}
        color="bg-red-500/10 text-red-400"
      />
      <MetricCard
        label="Sharpe 比率"
        value={metrics.sharpe_ratio.toFixed(2)}
        icon={<Shield className="w-4 h-4" />}
        color="bg-amber-500/10 text-amber-400"
        sub={metrics.sharpe_ratio >= 1 ? "良好" : "偏低"}
      />
      <MetricCard
        label="Sortino 比率"
        value={metrics.sortino_ratio.toFixed(2)}
        icon={<Shield className="w-4 h-4" />}
        color="bg-cyan-500/10 text-cyan-400"
      />
      <MetricCard
        label="Calmar 比率"
        value={metrics.calmar_ratio.toFixed(2)}
        icon={<BarChart className="w-4 h-4" />}
        color="bg-violet-500/10 text-violet-400"
      />
      <MetricCard
        label="胜率"
        value={fmt(metrics.win_rate)}
        icon={<Target className="w-4 h-4" />}
        color="bg-emerald-500/10 text-emerald-400"
        sub={`${metrics.total_trades} 笔交易`}
      />
      <MetricCard
        label="盈亏比"
        value={metrics.profit_factor.toFixed(2)}
        icon={<BarChart className="w-4 h-4" />}
        color="bg-blue-500/10 text-blue-400"
        sub={`初始 ${metrics.initial_capital.toLocaleString()} → 终值 ${metrics.final_equity.toLocaleString()}`}
      />
    </div>
  );
}
