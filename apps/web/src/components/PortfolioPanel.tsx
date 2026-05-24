"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Trash2,
} from "lucide-react";
import {
  listPortfolios,
  createPortfolio,
  deletePortfolio,
  rebalancePortfolio,
  type FundPortfolio,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type ViewState = "loading" | "ready" | "error";

export function PortfolioPanel() {
  const [state, setState] = useState<ViewState>("loading");
  const [portfolios, setPortfolios] = useState<FundPortfolio[]>([]);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const p = await listPortfolios();
      setPortfolios(p);
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold font-display text-neutral-100 flex items-center gap-2">
          <Briefcase size={20} className="text-purple-400" />
          组合管理
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-1"
          >
            <Plus size={12} />
            新建
          </button>
          <button
            onClick={load}
            className="px-3 py-1.5 text-xs bg-black/40 hover:bg-white/[0.02] rounded-xl border border-white/5 text-neutral-300 flex items-center gap-1"
          >
            <RefreshCw size={12} />
            刷新
          </button>
        </div>
      </div>

      {showCreate && (
        <CreatePortfolioForm
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {state === "loading" && (
        <div className="flex-1 flex items-center justify-center text-neutral-500">
          <Loader2 size={24} className="animate-spin mr-2" />
          加载中...
        </div>
      )}

      {state === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-500">
          <AlertTriangle size={32} className="text-rose-500" />
          <p className="text-sm text-rose-400">{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 bg-black/40 hover:bg-white/[0.02] text-neutral-300 rounded-xl text-sm"
          >
            重试
          </button>
        </div>
      )}

      {state === "ready" && (
        <PortfolioList
          portfolios={portfolios}
          onRefresh={load}
        />
      )}
    </div>
  );
}

function PortfolioList({
  portfolios,
  onRefresh,
}: {
  portfolios: FundPortfolio[];
  onRefresh: () => void;
}) {
  if (portfolios.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-500">
        <Briefcase size={32} className="text-neutral-600" />
        <p className="text-sm">暂无投资组合</p>
        <p className="text-xs text-neutral-600 font-mono">点击「新建」创建第一个组合</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {portfolios.map((p) => (
        <PortfolioCard key={p.id} portfolio={p} onRefresh={onRefresh} />
      ))}
    </div>
  );
}

function PortfolioCard({
  portfolio,
  onRefresh,
}: {
  portfolio: FundPortfolio;
  onRefresh: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  const [trades, setTrades] = useState<
    { fund_code: string; action: string; weight_change: number }[] | null
  >(null);

  const handleDelete = async () => {
    if (!confirm(`确认删除组合"${portfolio.name}"?`)) return;
    setDeleting(true);
    try {
      await deletePortfolio(portfolio.id);
      onRefresh();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  const handleRebalance = async () => {
    if (portfolio.holdings.length === 0) return;
    setRebalancing(true);
    try {
      const weights: Record<string, number> = {};
      for (const h of portfolio.holdings) {
        weights[h.fund_code] = h.weight;
      }
      const result = await rebalancePortfolio(portfolio.id, weights);
      setTrades(result.trades);
    } catch {
      setTrades(null);
    } finally {
      setRebalancing(false);
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-medium font-display text-neutral-200">
            {portfolio.name}
          </span>
          {portfolio.description && (
            <span className="text-xs text-neutral-500 ml-2 font-mono">
              {portfolio.description}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleRebalance}
            disabled={rebalancing || portfolio.holdings.length === 0}
            title="再平衡"
            className="p-1.5 rounded-xl hover:bg-white/[0.02] text-neutral-400 hover:text-indigo-400 disabled:opacity-50"
          >
            {rebalancing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Scale size={14} />
            )}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="删除"
            className="p-1.5 rounded-xl hover:bg-white/[0.02] text-neutral-400 hover:text-rose-400 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        </div>
      </div>

      {portfolio.holdings.length === 0 ? (
        <div className="text-xs text-neutral-600 font-mono py-2">无持仓</div>
      ) : (
        <div className="grid gap-1">
          {portfolio.holdings.map((h, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-black/20 rounded-xl px-2 py-1.5"
            >
              <span className="text-xs font-mono text-neutral-300">
                {h.fund_name || h.fund_code}
              </span>
              <span className="text-xs font-mono text-neutral-500">
                {(h.weight * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {trades && trades.length > 0 && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <h4 className="text-xs font-medium text-neutral-400 mb-2">
            再平衡建议
          </h4>
          <div className="grid gap-1">
            {trades.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-black/20 rounded-xl px-2 py-1.5"
              >
                <span className="text-xs font-mono text-neutral-300">{t.fund_code}</span>
                <span
                  className={cn(
                    "text-xs font-mono",
                    t.action === "buy"
                      ? "text-emerald-400"
                      : "text-rose-400"
                  )}
                >
                  {t.action === "buy" ? "买入" : "卖出"}{" "}
                  {(Math.abs(t.weight_change) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {trades && trades.length === 0 && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="text-xs text-emerald-400">组合已平衡，无需调整</p>
        </div>
      )}
    </div>
  );
}

function CreatePortfolioForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [holdings, setHoldings] = useState<
    { fund_code: string; weight: number }[]
  >([]);
  const [fundCode, setFundCode] = useState("");
  const [weight, setWeight] = useState("50");
  const [saving, setSaving] = useState(false);

  const addHolding = () => {
    if (!fundCode.trim()) return;
    const w = parseFloat(weight) / 100;
    if (isNaN(w) || w <= 0) return;
    setHoldings([...holdings, { fund_code: fundCode, weight: w }]);
    setFundCode("");
    setWeight("50");
  };

  const removeHolding = (idx: number) => {
    setHoldings(holdings.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createPortfolio({
        name,
        description,
        holdings,
      });
      onCreated();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/5 p-4">
      <h3 className="text-sm font-medium font-display text-neutral-300 mb-3">
        新建投资组合
      </h3>
      <div className="grid gap-2 mb-3">
        <div>
          <label className="text-xs text-neutral-500 mb-1 block font-mono">组合名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：稳健型基金组合"
            className="w-full bg-black/20 border border-white/5 rounded-xl px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1 block font-mono">
            描述（可选）
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="组合说明"
            className="w-full bg-black/20 border border-white/5 rounded-xl px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs text-neutral-500 mb-1 block font-mono">添加持仓</label>
        <div className="flex gap-2">
          <input
            value={fundCode}
            onChange={(e) => setFundCode(e.target.value)}
            placeholder="基金代码"
            className="flex-1 bg-black/20 border border-white/5 rounded-xl px-2 py-1.5 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
          />
          <div className="flex items-center gap-1">
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="权重"
              className="w-16 bg-black/20 border border-white/5 rounded-xl px-2 py-1.5 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
            />
            <span className="text-xs text-neutral-500 font-mono">%</span>
          </div>
          <button
            onClick={addHolding}
            className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.08] text-neutral-200 rounded-xl text-sm"
          >
            +
          </button>
        </div>
      </div>

      {holdings.length > 0 && (
        <div className="mb-3 grid gap-1">
          {holdings.map((h, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-black/20 rounded-xl px-2 py-1.5"
            >
              <span className="text-xs font-mono text-neutral-300">{h.fund_code}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-neutral-500">
                  {(h.weight * 100).toFixed(0)}%
                </span>
                <button
                  onClick={() => removeHolding(i)}
                  className="text-xs text-neutral-600 hover:text-rose-400"
                >
                  x
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm flex items-center justify-center gap-1"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Plus size={14} />
          )}
          创建组合
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-black/40 hover:bg-white/[0.02] text-neutral-300 rounded-xl text-sm"
        >
          取消
        </button>
      </div>
    </div>
  );
}
