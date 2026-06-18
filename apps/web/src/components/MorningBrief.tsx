import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Plus, RefreshCcw, Sunrise, X } from 'lucide-react';
import { fetchApi } from '../lib/api';
import { dispatchStockSelected, getPersistedStock, subscribeStockSelected } from '../lib/workspaceEvents';
import type { StockTarget } from '../lib/stocks';

/**
 * 自选晨报面板(纯新增模块)。
 *
 * 自选列表存于 localStorage;为自选标的聚合最新价/涨跌幅/近期新闻(GET /api/brief)。
 * 「加入自选」添加当前选中标的。不改动任何现有功能。
 */

const WL_KEY = 'alphascope:watchlist';

interface WatchItem {
  symbol: string;
  name: string;
}

interface BriefItem {
  symbol: string;
  close?: number | null;
  change_pct?: number | null;
  date?: string | null;
  news?: Array<{ title: string; published_at?: string; url?: string }>;
  news_count?: number;
}

function loadWatchlist(): WatchItem[] {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(WL_KEY) : null;
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => x && x.symbol) : [];
  } catch {
    return [];
  }
}

function saveWatchlist(wl: WatchItem[]) {
  try {
    window.localStorage.setItem(WL_KEY, JSON.stringify(wl));
  } catch {
    /* ignore */
  }
}

const fmtPct = (n?: number | null) =>
  n === undefined || n === null ? '—' : `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}%`;

export function MorningBrief() {
  const [watchlist, setWatchlist] = useState<WatchItem[]>(() => loadWatchlist());
  const [current, setCurrent] = useState<StockTarget | null>(() => getPersistedStock() ?? null);
  const [briefs, setBriefs] = useState<Record<string, BriefItem>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeStockSelected(({ stock }) => setCurrent(stock)), []);

  const loadBrief = (wl: WatchItem[]) => {
    const symbols = wl.map((w) => w.symbol).join(',');
    if (!symbols) {
      setBriefs({});
      return;
    }
    setLoading(true);
    void fetchApi<{ items: BriefItem[]; count: number }>(`/api/brief?symbols=${encodeURIComponent(symbols)}`)
      .then((d) => {
        const map: Record<string, BriefItem> = {};
        for (const it of d?.items ?? []) map[it.symbol] = it;
        setBriefs(map);
      })
      .catch(() => {
        /* 取数失败保持已有 */
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBrief(watchlist);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCurrent = () => {
    if (!current?.symbol) return;
    if (watchlist.some((w) => w.symbol === current.symbol)) return;
    const next = [...watchlist, { symbol: current.symbol, name: current.name ?? current.symbol }];
    setWatchlist(next);
    saveWatchlist(next);
    loadBrief(next);
  };

  const remove = (symbol: string) => {
    const next = watchlist.filter((w) => w.symbol !== symbol);
    setWatchlist(next);
    saveWatchlist(next);
    loadBrief(next);
  };

  return (
    <motion.div
      key="brief"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mx-auto max-w-5xl px-6 py-6"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
            <Sunrise className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-neutral-100">自选晨报</h1>
            <p className="text-[12px] text-neutral-500">{watchlist.length} 只自选 · 最新价/涨跌幅/近期新闻</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addCurrent}
            disabled={!current || watchlist.some((w) => w.symbol === current?.symbol)}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-[12px] text-indigo-300 transition-colors hover:bg-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            title={current ? `加入 ${current.name}` : '先在顶部选择标的'}
          >
            <Plus className="h-3.5 w-3.5" /> 加入自选{current ? ` (${current.name})` : ''}
          </button>
          <button
            type="button"
            onClick={() => loadBrief(watchlist)}
            disabled={loading || !watchlist.length}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[12px] text-neutral-300 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            刷新
          </button>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-sm text-neutral-500">
          <Sunrise className="mx-auto mb-3 h-8 w-8 text-neutral-600" />
          自选为空。在顶部搜索选择一只股票后,点「加入自选」即可每天看它发生了什么。
        </div>
      ) : (
        <div className="space-y-3">
          {watchlist.map((w) => {
            const b = briefs[w.symbol];
            const up = (b?.change_pct ?? 0) >= 0;
            return (
              <div key={w.symbol} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="cursor-pointer text-sm font-medium text-neutral-100 hover:text-indigo-300"
                      onClick={() => dispatchStockSelected({ symbol: w.symbol, name: w.name } as StockTarget, 'system')}
                      title="设为当前标的"
                    >
                      {w.name}
                    </span>
                    <span className="font-mono text-[11px] text-neutral-500">{w.symbol}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {b?.close !== undefined && b?.close !== null ? (
                      <div className="text-right">
                        <span className="font-mono text-sm text-neutral-100">¥{b.close}</span>
                        <span className={`ml-2 font-mono text-[12px] ${up ? 'text-rose-300' : 'text-emerald-300'}`}>
                          {fmtPct(b?.change_pct)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-neutral-600">暂无本地行情</span>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(w.symbol)}
                      className="rounded-md p-1 text-neutral-600 transition-colors hover:bg-white/5 hover:text-neutral-400"
                      title="移出自选"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {b?.news && b.news.length > 0 ? (
                  <ul className="mt-2 space-y-1 border-t border-white/5 pt-2">
                    {b.news.slice(0, 3).map((n, i) => (
                      <li key={i} className="truncate text-[11px] text-neutral-400">
                        · {n.title}
                        {n.published_at ? <span className="ml-1 text-neutral-600">{String(n.published_at).slice(0, 10)}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-2 border-t border-white/5 pt-2 text-[11px] text-neutral-600">近期无本地新闻</div>
                )}
              </div>
            );
          })}
          <p className="text-[10px] leading-relaxed text-neutral-600">
            数据取自本地已缓存的行情与新闻(在对应模块查询过该股后会更全);不构成投资建议。
          </p>
        </div>
      )}
    </motion.div>
  );
}
