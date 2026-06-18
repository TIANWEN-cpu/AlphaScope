import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Search, Users } from 'lucide-react';
import { fetchApi } from '../lib/api';

/**
 * 投资人库面板(纯新增模块)。
 *
 * 展示 config/experts.yaml 中的投资人 persona(GET /api/experts),支持搜索过滤。
 * 只读浏览,不改动既有功能。
 */

interface Expert {
  id: string;
  name?: string;
  style?: string;
  icon?: string;
  focus_dims?: string[];
  preview?: string;
  model?: string;
}

export function ExpertPanel() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetchApi<{ experts: Expert[]; total: number }>('/api/experts')
      .then((d) => {
        if (!cancelled) setExperts(d?.experts ?? []);
      })
      .catch(() => {
        /* 取数失败保持空列表 */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return experts;
    return experts.filter((e) =>
      `${e.name ?? ''} ${e.style ?? ''} ${(e.focus_dims ?? []).join(' ')} ${e.preview ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [experts, query]);

  return (
    <motion.div
      key="investors"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mx-auto max-w-6xl px-6 py-6"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-neutral-100">投资人库</h1>
            <p className="text-[12px] text-neutral-500">
              {loading ? '加载中…' : `${experts.length} 位投资大佬 · 价值/成长/宏观/趋势/游资 各派`}
            </p>
          </div>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索 巴菲特 / 段永平 / 游资 / 护城河…"
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-indigo-500/50 focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-indigo-300">
          <Loader2 className="h-5 w-5 animate-spin" /> 正在加载投资人库…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-sm text-neutral-500">
          没有匹配的投资人。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <div key={e.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 transition-colors hover:border-indigo-500/30">
              <div className="flex items-center gap-2">
                <span className="text-xl">{e.icon ?? '📊'}</span>
                <span className="text-sm font-medium text-neutral-100">{e.name ?? e.id}</span>
                {e.style && (
                  <span className="ml-auto rounded border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-300">
                    {e.style}
                  </span>
                )}
              </div>
              {e.focus_dims && e.focus_dims.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {e.focus_dims.slice(0, 5).map((d, i) => (
                    <span key={i} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-400">
                      {d}
                    </span>
                  ))}
                </div>
              )}
              {e.preview && <p className="mt-2 line-clamp-4 text-[11px] leading-relaxed text-neutral-500">{e.preview}</p>}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
