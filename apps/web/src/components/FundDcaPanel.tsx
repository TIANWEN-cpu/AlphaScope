"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  searchFunds,
  getFundMetrics,
  simulateDca,
  listDcaPlans,
  createDcaPlan,
  type FundInfo,
  type DCAPlan,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Tab = "search" | "simulate" | "plans";

export function FundDcaPanel() {
  const [tab, setTab] = useState<Tab>("search");
  const [plans, setPlans] = useState<DCAPlan[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);

  const loadPlans = useCallback(async () => {
    try {
      const p = await listDcaPlans();
      setPlans(p);
    } catch {
      // ignore
    } finally {
      setPlansLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold font-display text-neutral-100 flex items-center gap-2">
          <TrendingUp size={20} className="text-emerald-400" />
          基金定投
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl backdrop-blur-md p-1">
        {[
          { id: "search" as Tab, label: "基金搜索" },
          { id: "simulate" as Tab, label: "定投模拟" },
          { id: "plans" as Tab, label: `定投计划 (${plans.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 py-1.5 text-xs rounded transition-colors",
              tab === t.id
                ? "bg-indigo-500/80 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "search" && <FundSearchTab />}
      {tab === "simulate" && <DCASimulateTab onPlanCreated={loadPlans} />}
      {tab === "plans" && (
        <PlansTab plans={plans} loaded={plansLoaded} onRefresh={loadPlans} />
      )}
    </div>
  );
}

function FundSearchTab() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<FundInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedFund, setSelectedFund] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const funds = await searchFunds(keyword);
      setResults(funds);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewMetrics = async (code: string) => {
    setSelectedFund(code);
    setMetricsLoading(true);
    try {
      const m = await getFundMetrics(code);
      setMetrics(m);
    } catch {
      setMetrics(null);
    } finally {
      setMetricsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="输入基金名称或代码..."
          className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : "搜索"}
        </button>
      </div>

      {searched && !loading && results.length === 0 && (
        <div className="py-8 text-center text-neutral-600 text-sm">
          未找到匹配的基金
        </div>
      )}

      {results.length > 0 && (
        <div className="grid gap-2">
          {results.map((f) => (
            <div
              key={f.code}
              className={cn(
                "bg-black/40 backdrop-blur-md rounded-xl border p-3 cursor-pointer transition-colors",
                selectedFund === f.code
                  ? "border-indigo-500/50"
                  : "border-white/5 hover:border-white/10"
              )}
              onClick={() => handleViewMetrics(f.code)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-neutral-200">{f.name}</span>
                  <span className="text-xs font-mono text-neutral-500 ml-2">{f.code}</span>
                </div>
                {f.fund_type && (
                  <span className="text-xs bg-neutral-700 text-neutral-400 px-1.5 py-0.5 rounded">
                    {f.fund_type}
                  </span>
                )}
              </div>
              {f.manager && (
                <div className="text-xs text-neutral-500 mt-1">
                  {f.manager} / {f.company}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedFund && (
        <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/5 p-4">
          <h3 className="text-sm font-medium text-neutral-300 mb-3">
            {selectedFund} 指标
          </h3>
          {metricsLoading ? (
            <div className="flex items-center gap-2 text-neutral-500 text-sm">
              <Loader2 size={14} className="animate-spin" /> 计算中...
            </div>
          ) : metrics ? (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "总收益", key: "total_return", fmt: "pct" },
                { label: "年化收益", key: "annualized_return", fmt: "pct" },
                { label: "夏普比率", key: "sharpe_ratio", fmt: "num" },
                { label: "最大回撤", key: "max_drawdown", fmt: "pct" },
                { label: "波动率", key: "volatility", fmt: "pct" },
                { label: "胜率", key: "win_rate", fmt: "pct" },
              ].map(({ label, key, fmt }) => (
                <div
                  key={key}
                  className="bg-black/20 rounded-xl p-2 flex justify-between"
                >
                  <span className="text-xs font-mono text-neutral-500">{label}</span>
                  <span className="text-xs font-mono text-neutral-200">
                    {metrics[key] != null
                      ? fmt === "pct"
                        ? `${(metrics[key] * 100).toFixed(2)}%`
                        : metrics[key].toFixed(4)
                      : "-"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-neutral-600">无数据</div>
          )}
        </div>
      )}
    </div>
  );
}

function DCASimulateTab({ onPlanCreated }: { onPlanCreated: () => void }) {
  const [fundCode, setFundCode] = useState("");
  const [amount, setAmount] = useState("1000");
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState("2023-01-01");
  const [endDate, setEndDate] = useState("2024-12-31");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSimulate = async () => {
    if (!fundCode.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await simulateDca({
        fund_code: fundCode,
        amount: parseFloat(amount) || 1000,
        frequency,
        start_date: startDate,
        end_date: endDate,
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "模拟失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async () => {
    try {
      await createDcaPlan({
        fund_code: fundCode,
        amount: parseFloat(amount) || 1000,
        frequency,
        start_date: startDate,
      });
      onPlanCreated();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <InputField label="基金代码" value={fundCode} onChange={setFundCode} />
        <InputField label="每期金额" value={amount} onChange={setAmount} />
        <div>
          <label className="text-xs font-mono text-neutral-500 mb-1 block">频率</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-2 py-1.5 text-sm text-neutral-200"
          >
            <option value="weekly">每周</option>
            <option value="biweekly">每两周</option>
            <option value="monthly">每月</option>
            <option value="quarterly">每季度</option>
          </select>
        </div>
        <InputField label="开始日期" value={startDate} onChange={setStartDate} />
        <InputField label="结束日期" value={endDate} onChange={setEndDate} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSimulate}
          disabled={loading || !fundCode.trim()}
          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm flex items-center justify-center gap-1"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Play size={14} />
          )}
          模拟定投
        </button>
        {result && (
          <button
            onClick={handleSavePlan}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm flex items-center gap-1"
          >
            <Plus size={14} />
            保存计划
          </button>
        )}
      </div>

      {error && (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-400 flex items-center gap-2">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {result && <DCAResultCard result={result} />}
    </div>
  );
}

function DCAResultCard({ result }: { result: Record<string, unknown> }) {
  const totalInvested = (result.total_invested as number) || 0;
  const finalValue = (result.final_value as number) || 0;
  const totalReturn = (result.total_return as number) || 0;
  const maxDrawdown = (result.max_drawdown as number) || 0;
  const count = (result.investment_count as number) || 0;

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/5 p-4">
      <h3 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-1">
        <Wallet size={14} />
        模拟结果
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="总投入" value={`¥${totalInvested.toLocaleString()}`} />
        <Metric label="最终市值" value={`¥${finalValue.toLocaleString()}`} />
        <Metric
          label="总收益率"
          value={`${(totalReturn * 100).toFixed(2)}%`}
          color={totalReturn >= 0 ? "emerald" : "red"}
        />
        <Metric label="最大回撤" value={`${(maxDrawdown * 100).toFixed(2)}%`} color="red" />
        <Metric label="定投次数" value={String(count)} />
        <Metric
          label="盈亏"
          value={`¥${(finalValue - totalInvested).toLocaleString()}`}
          color={finalValue >= totalInvested ? "emerald" : "red"}
        />
      </div>
    </div>
  );
}

function PlansTab({
  plans,
  loaded,
  onRefresh,
}: {
  plans: DCAPlan[];
  loaded: boolean;
  onRefresh: () => void;
}) {
  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-500">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-500">
        <Clock size={32} className="text-neutral-600" />
        <p className="text-sm">暂无定投计划</p>
        <p className="text-xs text-neutral-600">
          在「定投模拟」标签中创建计划
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onRefresh}
        className="self-end px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1"
      >
        <RefreshCw size={10} />
        刷新
      </button>
      {plans.map((p) => (
        <div
          key={p.id}
          className="bg-black/40 backdrop-blur-md rounded-xl border border-white/5 p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-200">
              {p.fund_name || p.fund_code}
            </span>
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                p.status === "active"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-neutral-700 text-neutral-400"
              )}
            >
              {p.status}
            </span>
          </div>
          <div className="text-xs font-mono text-neutral-500 mt-1">
            ¥{p.amount} / {p.frequency} / 起始 {p.start_date}
          </div>
        </div>
      ))}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-mono text-neutral-500 mb-1 block">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black/20 border border-white/10 rounded-xl px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
      />
    </div>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-black/20 rounded-xl p-2 flex justify-between">
      <span className="text-xs font-mono text-neutral-500">{label}</span>
      <span
        className={cn(
          "text-xs font-mono",
          color === "emerald"
            ? "text-emerald-400"
            : color === "red"
              ? "text-rose-400"
              : "text-neutral-200"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Play({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}
