"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Loader2,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PortfolioSummary {
  id: string;
  name: string;
  equity: number;
  cash: number;
  positions_count: number;
  total_trades: number;
}

interface PositionData {
  shares: number;
  avg_cost: number;
  current_price: number;
}

interface PortfolioDetail {
  id: string;
  name: string;
  initial_capital: number;
  cash: number;
  equity: number;
  total_return_pct: number;
  positions: Record<string, PositionData>;
  trades: Array<{
    symbol: string;
    side: string;
    shares: number;
    price: number;
    commission: number;
    pnl: number;
    timestamp: string;
  }>;
}

export function PortfolioView() {
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detail, setDetail] = useState<PortfolioDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCapital, setNewCapital] = useState(100000);
  const [showTrade, setShowTrade] = useState(false);
  const [tradeSymbol, setTradeSymbol] = useState("");
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [tradeShares, setTradeShares] = useState(100);
  const [tradePrice, setTradePrice] = useState(100);

  const loadPortfolios = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/portfolio`);
      const data = await res.json();
      if (data.success) {
        setPortfolios(data.data);
        if (data.data.length > 0 && !selectedId) {
          setSelectedId(data.data[0].id);
        }
      }
    } catch {}
  }, [selectedId]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/portfolio/${id}`);
      const data = await res.json();
      if (data.success) setDetail(data.data);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPortfolios(); }, [loadPortfolios]);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId, loadDetail]);

  const handleCreate = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/portfolio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, initial_capital: newCapital }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setNewName("");
        setSelectedId(data.data.id);
        loadPortfolios();
      }
    } catch {}
  };

  const handleTrade = async () => {
    if (!selectedId || !tradeSymbol) return;
    try {
      const res = await fetch(`${API_BASE}/api/portfolio/${selectedId}/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: tradeSymbol,
          side: tradeSide,
          shares: tradeShares,
          price: tradePrice,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowTrade(false);
        setTradeSymbol("");
        loadDetail(selectedId);
      }
    } catch {}
  };

  const positions = detail
    ? Object.entries(detail.positions).map(([sym, pos]) => ({
        symbol: sym,
        shares: pos.shares,
        avgCost: pos.avg_cost,
        currentPrice: pos.current_price,
        pnl: (pos.current_price - pos.avg_cost) * pos.shares,
        pnlPercent: pos.avg_cost > 0
          ? ((pos.current_price - pos.avg_cost) / pos.avg_cost) * 100
          : 0,
      }))
    : [];

  const allocationData = positions.map((p) => ({
    name: p.symbol,
    value: p.shares * p.currentPrice,
  }));

  const totalValue = detail?.equity ?? 0;
  const totalPnl = detail ? detail.equity - detail.initial_capital : 0;
  const totalPnlPercent = detail?.total_return_pct ?? 0;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-medium text-neutral-100 flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-indigo-500" />
            投资组合
          </h2>
          <p className="text-sm font-mono text-neutral-500 mt-1">实时资产追踪与持仓管理</p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500/50"
          >
            <option value="">选择组合...</option>
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 glass glass-hover rounded-lg text-xs font-mono text-neutral-300 flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> 新建
          </button>
          <button
            onClick={() => setShowTrade(true)}
            disabled={!selectedId}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-mono flex items-center gap-2"
          >
            交易
          </button>
        </div>
      </div>

      {/* Create Portfolio Modal */}
      {showCreate && (
        <div className="glass rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-medium text-neutral-200 mb-4">新建组合</h3>
          <div className="flex gap-4">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="组合名称"
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500/50"
            />
            <input
              type="number"
              value={newCapital}
              onChange={(e) => setNewCapital(Number(e.target.value))}
              className="w-36 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500/50"
            />
            <button onClick={handleCreate} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-mono">创建</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 glass rounded-lg text-xs font-mono text-neutral-400">取消</button>
          </div>
        </div>
      )}

      {/* Trade Modal */}
      {showTrade && (
        <div className="glass rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-medium text-neutral-200 mb-4">记录交易</h3>
          <div className="flex flex-wrap gap-4">
            <input
              value={tradeSymbol}
              onChange={(e) => setTradeSymbol(e.target.value)}
              placeholder="股票代码"
              className="w-32 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500/50"
            />
            <select
              value={tradeSide}
              onChange={(e) => setTradeSide(e.target.value as "buy" | "sell")}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500/50"
            >
              <option value="buy">买入</option>
              <option value="sell">卖出</option>
            </select>
            <input
              type="number"
              value={tradeShares}
              onChange={(e) => setTradeShares(Number(e.target.value))}
              className="w-28 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500/50"
            />
            <input
              type="number"
              value={tradePrice}
              onChange={(e) => setTradePrice(Number(e.target.value))}
              className="w-32 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500/50"
            />
            <button onClick={handleTrade} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-mono">提交</button>
            <button onClick={() => setShowTrade(false)} className="px-4 py-2 glass rounded-lg text-xs font-mono text-neutral-400">取消</button>
          </div>
        </div>
      )}

      {!detail && !loading && (
        <div className="glass rounded-2xl p-12 text-center">
          <Briefcase className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <p className="text-neutral-500">请创建或选择一个投资组合</p>
        </div>
      )}

      {loading && (
        <div className="glass rounded-2xl p-12 text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 mx-auto mb-4 animate-spin" />
          <p className="text-neutral-500">加载中...</p>
        </div>
      )}

      {detail && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="glass rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-indigo-300">
                <DollarSign className="w-20 h-20 stroke-[0.5]" />
              </div>
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 mb-2">总资产</h3>
              <h2 className="text-3xl font-mono font-medium text-white">
                ¥{totalValue.toLocaleString()}
              </h2>
              <p className={`text-xs font-mono flex items-center gap-1 mt-2 ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {totalPnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {totalPnl >= 0 ? "+" : ""}¥{totalPnl.toLocaleString()} ({totalPnlPercent.toFixed(2)}%)
              </p>
            </div>

            <div className="glass rounded-2xl p-6">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">持仓数量</h3>
              <h2 className="text-3xl font-mono font-medium text-neutral-100">{positions.length}</h2>
              <p className="text-xs font-mono text-emerald-400 mt-2">
                {positions.filter((p) => p.pnl > 0).length} 盈利, {positions.filter((p) => p.pnl < 0).length} 亏损
              </p>
            </div>

            <div className="glass rounded-2xl p-6">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">可用现金</h3>
              <h2 className="text-3xl font-mono font-medium text-neutral-100">¥{detail.cash.toLocaleString()}</h2>
              <p className="text-xs font-mono text-neutral-500 mt-2">
                交易 {detail.trades.length} 笔
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Allocation Pie Chart */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-6 pb-3 border-b border-white/5">
                资产配置
              </h3>
              {allocationData.length > 0 ? (
                <div className="h-64 flex items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {allocationData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "#171717",
                          borderColor: "#262626",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontFamily: "monospace",
                        }}
                        itemStyle={{ color: "#e5e5e5" }}
                        formatter={(value: number) => `¥${value.toLocaleString()}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-1/2 ml-4">
                    {allocationData.map((item, i) => (
                      <div key={item.name} className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-neutral-400">{item.name}</span>
                        </div>
                        <span className="text-xs font-mono text-neutral-200">
                          ¥{(item.value / 10000).toFixed(1)}万
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-500 text-center py-8">暂无持仓</p>
              )}
            </div>

            {/* Positions Table */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/5">
                <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400">持仓明细</h3>
              </div>
              {positions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-neutral-500">股票</th>
                        <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest text-neutral-500">持仓</th>
                        <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest text-neutral-500">成本</th>
                        <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest text-neutral-500">现价</th>
                        <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest text-neutral-500">盈亏</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p) => (
                        <tr key={p.symbol} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-sm font-mono text-neutral-200">{p.symbol}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-neutral-300">{p.shares}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-neutral-400">¥{p.avgCost.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-neutral-200">¥{p.currentPrice.toFixed(2)}</td>
                          <td className={`px-4 py-3 text-right font-mono text-sm ${p.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            <div>{p.pnl >= 0 ? "+" : ""}¥{p.pnl.toLocaleString()}</div>
                            <div className="text-[10px]">{p.pnlPercent >= 0 ? "+" : ""}{p.pnlPercent.toFixed(2)}%</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-neutral-500 text-center py-8 p-6">暂无持仓，请记录一笔交易</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
