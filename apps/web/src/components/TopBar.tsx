import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Loader2, Search, Wallet, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { dispatchStockSelected, subscribeStockSelected } from '../lib/workspaceEvents';
import { findStockTarget, formatStockLabel, resolveStockTarget, searchStockTargets, searchStockTargetsRemote } from '../lib/stocks';
import type { StockTarget } from '../lib/stocks';
import { cn } from '../lib/utils';
import { fetchApi } from '../lib/api';

interface CostWindow {
  calls: number;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
}

interface CostSummary {
  windows: { today: CostWindow; last_7d: CostWindow; last_30d: CostWindow; total: CostWindow };
  by_model: { model: string; vendor: string; calls: number; cost_usd: number }[];
  as_of: number;
}

const fmtUsd = (n: number) => `$${(n ?? 0).toFixed((n ?? 0) < 1 ? 4 : 2)}`;

export function TopBar() {
  const [searchValue, setSearchValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [lastSelected, setLastSelected] = useState('贵州茅台 (600519.SH)');
  const [activeIndex, setActiveIndex] = useState(0);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [remoteSuggestions, setRemoteSuggestions] = useState<StockTarget[]>([]);
  const [cost, setCost] = useState<CostSummary | null>(null);
  const [costOpen, setCostOpen] = useState(false);

  const localSuggestions = useMemo(() => searchStockTargets(searchValue, 6), [searchValue]);
  const suggestions = remoteSuggestions.length ? remoteSuggestions : localSuggestions;

  useEffect(() => {
    return subscribeStockSelected(({ stock }) => {
      const resolved = findStockTarget(stock.symbol) ?? stock;
      setLastSelected(formatStockLabel(resolved));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchApi<CostSummary>('/api/diagnostics/cost-summary')
        .then((data) => {
          if (!cancelled) setCost(data);
        })
        .catch(() => {
          /* 成本展示为非关键信息，取数失败静默处理 */
        });
    };
    load();
    const timer = window.setInterval(load, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchValue]);

  useEffect(() => {
    let cancelled = false;
    const keyword = searchValue.trim();
    setRemoteSuggestions([]);
    if (!keyword) return undefined;

    const timer = window.setTimeout(() => {
      setIsResolving(true);
      void searchStockTargetsRemote(keyword, 8)
        .then((items) => {
          if (!cancelled) {
            setRemoteSuggestions(items);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsResolving(false);
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchValue]);

  const selectStock = async (value: string | StockTarget) => {
    setIsResolving(true);
    const stock = typeof value === 'string' ? await resolveStockTarget(value) : value;
    setIsResolving(false);
    if (!stock) return;

    const label = formatStockLabel(stock);
    setSearchValue(label);
    setLastSelected(label);
    setIsOpen(false);
    dispatchStockSelected(stock, 'topbar');
  };

  const clearSearch = () => {
    setSearchValue('');
    setIsOpen(true);
  };

  return (
    <header className="relative z-[80] h-[60px] flex-shrink-0 overflow-visible border-b border-white/[0.04] bg-[#06070c]/95 px-6 text-neutral-400 shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl">
      <div className="flex h-full items-center justify-between gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="group relative z-[90] flex w-[min(42vw,36rem)] min-w-[20rem] max-w-[36rem] items-center">
            <Search className="w-4 h-4 absolute left-3.5 text-neutral-500 group-focus-within:text-indigo-400 transition-colors" />
            <input 
              data-testid="global-stock-search"
              type="text" 
              value={searchValue}
              onFocus={() => setIsOpen(true)}
              onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setIsOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setIsOpen(true);
                  setActiveIndex((index) => Math.min(index + 1, Math.max(0, suggestions.length - 1)));
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIndex((index) => Math.max(0, index - 1));
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void selectStock(searchValue);
                }
                if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
              placeholder="搜索标的 / 贵州茅台 (600519)" 
              className="w-full bg-white/[0.03] border border-white/[0.05] rounded-lg pl-10 pr-10 py-2 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all text-neutral-200 placeholder:text-neutral-500 shadow-inner"
            />
            {searchValue && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearSearch}
                className="absolute right-2 rounded-md p-1 text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-300"
                title="清空搜索"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {isResolving && (
              <Loader2 className="absolute right-9 h-3.5 w-3.5 animate-spin text-indigo-300" />
            )}
            {isOpen && suggestions.length > 0 && (
              <div className="custom-scrollbar absolute left-0 top-[calc(100%+0.75rem)] z-[120] max-h-[min(68vh,28rem)] w-full overflow-y-auto rounded-xl border border-indigo-500/25 bg-[#0b0c12] shadow-[0_24px_80px_rgba(0,0,0,0.72)] ring-1 ring-black/70">
                <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500 border-b border-white/5">
                  选择后同步到 K线、多模态与研报模块
                </div>
                {suggestions.map((stock, index) => (
                  <button
                    key={stock.symbol}
                    data-testid={`stock-suggestion-${stock.symbol}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => void selectStock(stock)}
                    className={cn(
                      "w-full px-3 py-2.5 flex items-center justify-between gap-3 text-left transition-colors",
                      activeIndex === index ? "bg-indigo-500/10" : "hover:bg-white/[0.05]"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm text-neutral-200 font-medium">{stock.name}</span>
                      <span className="block text-[10px] text-neutral-500 font-mono">{stock.sector} · {stock.market}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-mono text-xs text-indigo-300">{stock.symbol}</span>
                      {stock.source === 'symbol-fallback' && (
                        <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-200">
                          待解析
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {isOpen && searchValue && !isResolving && suggestions.length === 0 && (
              <div className="absolute left-0 top-[calc(100%+0.75rem)] z-[120] w-full rounded-xl border border-amber-500/25 bg-[#0b0c12] px-3 py-3 text-xs text-amber-100 shadow-[0_24px_80px_rgba(0,0,0,0.72)] ring-1 ring-black/70">
                未找到匹配标的。可直接输入 6 位 A 股代码继续解析，也可以输入简称、行业或别名，例如 600519、301666、大微普、银行。
              </div>
            )}
          </div>
          <div className="h-5 w-px bg-white/10 mx-1"></div>
          <span className="hidden shrink-0 items-center gap-2 text-sm font-medium tracking-wide text-neutral-400 md:flex">
            A股 研究工作台
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">PRO</span>
          </span>
          <span className="hidden xl:flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            已同步 {lastSelected}
          </span>
        </div>
        <div className="relative flex shrink-0 items-center gap-5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setCostOpen((open) => !open)}
              title="LLM 调用成本(估算)"
              className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-500/15"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">今日</span>
              <span className="font-mono">{fmtUsd(cost?.windows?.today?.cost_usd ?? 0)}</span>
            </button>
            <AnimatePresence>
              {costOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  className="absolute right-0 top-11 z-[120] w-72 rounded-2xl border border-white/10 bg-[#0b0c12] p-4 shadow-2xl ring-1 ring-black/70"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-100">LLM 调用成本</h3>
                    <button
                      type="button"
                      onClick={() => setCostOpen(false)}
                      className="rounded-md p-1 text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {([['今日', 'today'], ['近7天', 'last_7d'], ['近30天', 'last_30d'], ['累计', 'total']] as const).map(
                      ([label, key]) => (
                        <div key={key} className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2">
                          <div className="text-neutral-500">{label}</div>
                          <div className="mt-0.5 font-mono text-amber-300">{fmtUsd(cost?.windows?.[key]?.cost_usd ?? 0)}</div>
                          <div className="text-[10px] text-neutral-600">{cost?.windows?.[key]?.calls ?? 0} 次调用</div>
                        </div>
                      ),
                    )}
                  </div>
                  {cost?.by_model?.length ? (
                    <div className="mt-3 border-t border-white/5 pt-2">
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-neutral-500">按模型(累计)</div>
                      {cost.by_model.slice(0, 4).map((m) => (
                        <div key={`${m.vendor}/${m.model}`} className="flex items-center justify-between py-0.5 text-[11px]">
                          <span className="truncate text-neutral-300">{m.model}</span>
                          <span className="ml-2 shrink-0 font-mono text-amber-300/90">{fmtUsd(m.cost_usd)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 border-t border-white/5 pt-2 text-[11px] text-neutral-500">暂无调用记录</div>
                  )}
                  <div className="mt-2 text-[10px] leading-relaxed text-neutral-600">估算值,基于各模型公开单价</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setNoticeOpen((open) => !open)}
            className="relative p-2 hover:bg-white/5 rounded-lg transition-colors text-neutral-500 hover:text-neutral-300"
            title="查看系统通知"
          >
            <Bell className="w-[18px] h-[18px]" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-[#050505]"></span>
          </motion.button>
          <AnimatePresence>
            {noticeOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                className="absolute right-24 top-11 z-[120] w-80 rounded-2xl border border-white/10 bg-[#0b0c12] p-4 shadow-2xl ring-1 ring-black/70"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-100">系统通知</h3>
                  <button
                    type="button"
                    onClick={() => setNoticeOpen(false)}
                    className="rounded-md p-1 text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {[
                  ['数据源', '腾讯行情与东财数据中心已纳入降级链路。'],
                  ['任务队列', '重复股票分析会复用已有任务，避免重复运行。'],
                  ['提示', `当前全局标的：${lastSelected}`],
                ].map(([title, text]) => (
                  <div key={title} className="mb-2 rounded-xl border border-white/5 bg-white/[0.03] p-3">
                    <p className="text-xs font-medium text-neutral-200">{title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{text}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
            <span className="text-[11px] font-medium tracking-wider">系统在线</span>
          </div>
        </div>
      </div>
    </header>
  );
}
