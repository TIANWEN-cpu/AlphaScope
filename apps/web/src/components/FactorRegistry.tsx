import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Sigma, RefreshCcw, Play, TrendingUp, TrendingDown, Minus, Search } from 'lucide-react';
import { fetchApi } from '../lib/api';

interface FactorDef {
  id: string;
  name: string;
  category: string;
  direction: number;
  description: string;
  source: string;
  unit: string;
}

interface SymbolVector {
  symbol: string;
  asof: string;
  bar_count: number;
  factors: Record<string, number | null>;
}

interface Matrix {
  factors: string[];
  rows: Array<Record<string, any>>;
  count: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  technical: '技术',
  sentiment: '舆情',
  event: '事件',
  analyst: '评级',
  flow: '资金',
};

const directionIcon = (d: number) =>
  d > 0 ? <TrendingUp className="h-3 w-3 text-rose-400" /> : d < 0 ? <TrendingDown className="h-3 w-3 text-emerald-400" /> : <Minus className="h-3 w-3 text-neutral-500" />;

export const FactorRegistry: React.FC = () => {
  const [catalog, setCatalog] = useState<FactorDef[]>([]);
  const [symbol, setSymbol] = useState('');
  const [vector, setVector] = useState<SymbolVector | null>(null);
  const [matrixSymbols, setMatrixSymbols] = useState('');
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const data = await fetchApi<{ factors: FactorDef[] }>('/api/factor-registry/catalog');
      setCatalog(data.factors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取因子目录失败');
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const techDefs = useMemo(() => catalog.filter((c) => c.source === 'price'), [catalog]);
  const defById = useMemo(() => Object.fromEntries(catalog.map((c) => [c.id, c])), [catalog]);

  const computeSymbol = async () => {
    if (!symbol.trim()) return;
    setBusy(true);
    setError('');
    try {
      const data = await fetchApi<SymbolVector>(`/api/factor-registry/symbol/${encodeURIComponent(symbol.trim())}`);
      setVector(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '计算失败');
    } finally {
      setBusy(false);
    }
  };

  const computeMatrix = async () => {
    const symbols = matrixSymbols.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (symbols.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const data = await fetchApi<Matrix>('/api/factor-registry/matrix', {
        method: 'POST',
        body: JSON.stringify({ symbols }),
      });
      setMatrix(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '矩阵计算失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      key="factor-registry"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex h-full flex-col gap-4 overflow-y-auto p-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500/20">
            <Sigma className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-neutral-100">因子注册中心 · 研究流水线</h1>
            <p className="text-xs text-neutral-500">统一因子目录 + 确定性技术因子计算 + 跨标的因子矩阵</p>
          </div>
        </div>
        <button type="button" onClick={() => void loadCatalog()} className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-white/[0.06]">
          <RefreshCcw className="h-3.5 w-3.5" /> 刷新
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-200">{error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 单标的因子向量 */}
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <h3 className="mb-3 text-sm font-medium text-neutral-200">单标的因子向量</h3>
          <div className="flex gap-2">
            <input value={symbol} onChange={(e) => setSymbol(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && computeSymbol()} placeholder="股票代码,如 600519" className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-indigo-400/40" />
            <button type="button" disabled={busy} onClick={() => void computeSymbol()} className="flex items-center gap-1.5 rounded-lg border border-indigo-400/30 bg-indigo-500/15 px-3 py-2 text-xs text-indigo-200 hover:bg-indigo-500/25 disabled:opacity-50">
              <Search className="h-3.5 w-3.5" /> 计算
            </button>
          </div>
          {vector && (
            <div className="mt-3">
              <div className="mb-2 text-[11px] text-neutral-500">{vector.symbol} · 截面 {vector.asof} · {vector.bar_count} 根</div>
              <div className="flex flex-col gap-1.5">
                {techDefs.map((d, i) => {
                  const v = vector.factors[d.id];
                  return (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.25 }}
                      className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-1.5 text-xs"
                    >
                      <span className="flex items-center gap-1.5 text-neutral-300">
                        {directionIcon(d.direction)}
                        {d.name}
                      </span>
                      <span className="font-mono text-neutral-200">{v === null || v === undefined ? '—' : `${v}${d.unit}`}</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 批量因子矩阵 */}
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <h3 className="mb-3 text-sm font-medium text-neutral-200">批量因子矩阵(研究流水线)</h3>
          <textarea value={matrixSymbols} onChange={(e) => setMatrixSymbols(e.target.value)} rows={2} placeholder="多个代码,空格/逗号分隔:600519 000001 600036" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-indigo-400/40" />
          <button type="button" disabled={busy} onClick={() => void computeMatrix()} className="mt-2 flex items-center gap-1.5 rounded-lg border border-indigo-400/30 bg-indigo-500/15 px-3 py-1.5 text-xs text-indigo-200 hover:bg-indigo-500/25 disabled:opacity-50">
            <Play className="h-3.5 w-3.5" /> 生成矩阵
          </button>
        </div>
      </div>

      {/* 矩阵结果 */}
      {matrix && matrix.rows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
        >
          <h3 className="mb-3 text-sm font-medium text-neutral-200">因子矩阵 · {matrix.count} 只</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-neutral-500">
                  <th className="py-2 pr-3 font-normal">代码</th>
                  {matrix.factors.map((f) => (
                    <th key={f} className="py-2 pr-3 font-normal">{defById[f]?.name || f}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <tr key={row.symbol} className="border-b border-white/[0.03] text-neutral-300">
                    <td className="py-1.5 pr-3 font-medium text-neutral-200">{row.symbol}</td>
                    {matrix.factors.map((f) => (
                      <td key={f} className="py-1.5 pr-3 font-mono">{row[f] === null || row[f] === undefined ? '—' : row[f]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* 因子目录 */}
      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
        <h3 className="mb-3 text-sm font-medium text-neutral-200">因子目录 · {catalog.length} 个</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-neutral-500">
                <th className="py-2 pr-3 font-normal">因子</th>
                <th className="py-2 pr-3 font-normal">类别</th>
                <th className="py-2 pr-3 font-normal">方向</th>
                <th className="py-2 pr-3 font-normal">来源</th>
                <th className="py-2 pr-3 font-normal">口径</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((d) => (
                <tr key={d.id} className="border-b border-white/[0.03] text-neutral-300">
                  <td className="py-1.5 pr-3 font-medium text-neutral-200">{d.name}<span className="ml-1 text-[10px] text-neutral-600">{d.id}</span></td>
                  <td className="py-1.5 pr-3">{CATEGORY_LABEL[d.category] || d.category}</td>
                  <td className="py-1.5 pr-3">{directionIcon(d.direction)}</td>
                  <td className="py-1.5 pr-3 text-neutral-400">{d.source === 'price' ? '技术(本地算)' : '软因子'}</td>
                  <td className="py-1.5 pr-3 text-neutral-500">{d.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="pb-2 text-[11px] leading-relaxed text-neutral-600">
        因子是对历史量价/舆情结构的确定性度量,方向仅为口径标注(越大越偏多/偏空/中性),不据此给买卖指令、不预测、不构成选股建议。
      </p>
    </motion.div>
  );
};
