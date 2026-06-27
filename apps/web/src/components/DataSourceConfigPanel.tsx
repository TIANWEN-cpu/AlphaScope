/**
 * 付费/自定义数据源配置面板。
 * 在「设置 → 数据源健康」下方展示:
 * - 预置付费数据源目录 (Tushare/Choice/iFinD/聚宽/Wind/Finnhub/AlphaVantage)
 *   每个源: 特点说明 + "获取 Key"官网跳转 + 填 Key + 启停 + 权重
 * - 填 Key 弹窗 (加密存后端, 立即热生效)
 * - 权重/启停改完即落盘热重载
 */

import { useEffect, useState } from 'react';
import { ExternalLink, Key, Loader2, RefreshCw, ShieldCheck, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { fetchApi } from '../lib/api';
import { getErrorMessage } from '../lib/dataFetch';

interface PresetSource {
  name: string;
  label: string;
  types: string[];
  cost_tier: string;
  token_env: string;
  signup_url: string;
  doc_url?: string;
  description: string;
  advantages: string;
  has_key: boolean;
  key_masked?: string | null;
  enabled: boolean;
}

interface TestResult {
  name: string;
  status: string;
  consecutive_failures: number;
  avg_latency_ms: number;
  last_error: string;
  data_types: string[];
  markets: string[];
}

const COST_LABEL: Record<string, string> = {
  free: '免费',
  freemium: '免费额度+付费',
  paid: '付费',
};

export function DataSourceConfigPanel() {
  const [presets, setPresets] = useState<PresetSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyDialog, setKeyDialog] = useState<PresetSource | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, TestResult>>({});
  const [priorityDraft, setPriorityDraft] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<{ datasources: PresetSource[] }>('/api/datasources/presets');
      setPresets(data.datasources || []);
      // 初始化权重草稿 (按各源 types 的第一个数据类型, 默认 50; 真实值另由 GET config 提供)
      const draft: Record<string, number> = {};
      (data.datasources || []).forEach((s) => { draft[s.name] = 50; });
      setPriorityDraft(draft);
      // 拉真实配置覆盖
      try {
        const cfg = await fetchApi<Record<string, Record<string, { enabled: boolean; priority: number }>>>('/api/datasources/config');
        const realDraft: Record<string, number> = {};
        Object.entries(cfg || {}).forEach(([pname, types]) => {
          // 取该 provider 在其各 data_type 下的最高优先级作为代表值
          const maxP = Math.max(0, ...Object.values(types || {}).map((t) => t?.priority ?? 0));
          if (Number.isFinite(maxP)) realDraft[pname] = maxP;
        });
        setPriorityDraft(() => ({ ...draft, ...realDraft }));
      } catch { /* config 为空时忽略 */ }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openKeyDialog = (s: PresetSource) => {
    setKeyDialog(s);
    setKeyInput('');
    setKeyError(null);
  };

  const saveKey = async () => {
    if (!keyDialog || !keyInput.trim()) return;
    setSavingKey(true);
    setKeyError(null);
    try {
      await fetchApi('/api/datasources/credentials', {
        method: 'POST',
        body: JSON.stringify({ name: keyDialog.name, api_key: keyInput.trim() }),
      });
      setKeyDialog(null);
      await load();
    } catch (err) {
      setKeyError(getErrorMessage(err));
    } finally {
      setSavingKey(false);
    }
  };

  const deleteKey = async (s: PresetSource) => {
    if (!s.has_key) return;
    if (!confirm(`确认删除 ${s.label} 的已保存 Key？删除后该数据源将不可用。`)) return;
    setBusy(`del-${s.name}`);
    try {
      await fetchApi(`/api/datasources/credentials/${encodeURIComponent(s.name)}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const runTest = async (s: PresetSource) => {
    setTesting(s.name);
    try {
      const r = await fetchApi<TestResult>(`/api/datasources/credentials/${encodeURIComponent(s.name)}/test`, { method: 'POST' });
      setTestResult((prev) => ({ ...prev, [s.name]: r }));
    } catch (err) {
      setTestResult((prev) => ({ ...prev, [s.name]: { name: s.name, status: 'unhealthy', consecutive_failures: 0, avg_latency_ms: 0, last_error: getErrorMessage(err), data_types: [], markets: [] } }));
    } finally {
      setTesting(null);
    }
  };

  const savePriority = async (s: PresetSource) => {
    const val = priorityDraft[s.name];
    if (val === undefined) return;
    setBusy(`prio-${s.name}`);
    try {
      // 对该源支持的所有数据类型统一设同一优先级
      await Promise.all(s.types.map((dt) =>
        fetchApi('/api/datasources/config', {
          method: 'PUT',
          body: JSON.stringify({ provider: s.name, data_type: dt, enabled: true, priority: val }),
        }),
      ));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 p-6 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> 加载数据源配置…</div>;
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/5 bg-black/20 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-100">付费/自定义数据源接入</h3>
          <p className="mt-1 text-xs text-neutral-500">点击「获取 Key」跳转官网注册，拿到 Key 填回后即可启用并设权重，保存即热生效。</p>
        </div>
        <button onClick={() => void load()} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/[0.06]">
          <RefreshCw className="h-3.5 w-3.5" /> 刷新
        </button>
      </div>

      {error && <div className="mb-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>}

      <div className="space-y-3">
        {presets.map((s) => {
          const tr = testResult[s.name];
          const hasResult = !!tr;
          return (
            <div key={s.name} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-neutral-100">{s.label}</h4>
                    <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-mono', s.cost_tier === 'paid' ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300')}>{COST_LABEL[s.cost_tier] || s.cost_tier}</span>
                    {s.has_key ? (
                      <span className="flex items-center gap-1 rounded border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-300"><ShieldCheck className="h-3 w-3" />Key 已配 {s.key_masked && `(${s.key_masked})`}</span>
                    ) : (
                      <span className="flex items-center gap-1 rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-neutral-500"><XCircle className="h-3 w-3" />未配置 Key</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">{s.description}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-neutral-500"><span className="text-neutral-400">优势：</span>{s.advantages}</p>
                  <p className="mt-1 text-[10px] font-mono text-neutral-600">数据类型: {s.types.join(' / ')} · 环境变量: {s.token_env}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={s.signup_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20">
                    <ExternalLink className="h-3.5 w-3.5" /> 获取 Key
                  </a>
                  {s.doc_url && (
                    <a href={s.doc_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-neutral-400 hover:bg-white/[0.06]">文档</a>
                  )}
                  <button onClick={() => openKeyDialog(s)} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-white/[0.06]">
                    <Key className="h-3.5 w-3.5" /> {s.has_key ? '更新 Key' : '填入 Key'}
                  </button>
                  {s.has_key && (
                    <>
                      <button onClick={() => void runTest(s)} disabled={testing === s.name} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-white/[0.06] disabled:opacity-50">
                        {testing === s.name ? '测试中…' : '测试连通'}
                      </button>
                      <button onClick={() => void deleteKey(s)} disabled={busy === `del-${s.name}`} className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-2 py-1.5 text-xs text-rose-400 hover:bg-rose-500/15 disabled:opacity-50" title="删除已存 Key">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 权重 */}
              {s.has_key && (
                <div className="mt-3 flex items-center gap-3 border-t border-white/5 pt-3">
                  <span className="text-[11px] font-mono text-neutral-500">权重/优先级</span>
                  <input
                    type="range" min={0} max={100} value={priorityDraft[s.name] ?? 50}
                    onChange={(e) => setPriorityDraft((prev) => ({ ...prev, [s.name]: Number(e.target.value) }))}
                    className="flex-1 accent-indigo-500"
                  />
                  <span className="w-8 text-right font-mono text-xs text-indigo-300">{priorityDraft[s.name] ?? 50}</span>
                  <button onClick={() => void savePriority(s)} disabled={busy === `prio-${s.name}`} className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-neutral-300 hover:bg-white/[0.06] disabled:opacity-50">
                    {busy === `prio-${s.name}` ? '保存中' : '保存'}
                  </button>
                </div>
              )}

              {/* 测试结果 */}
              {hasResult && (
                <div className={cn('mt-2 flex items-center gap-2 text-xs', tr.status === 'healthy' ? 'text-emerald-300' : 'text-amber-300')}>
                  {tr.status === 'healthy' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  状态: {tr.status} · 延迟 {tr.avg_latency_ms}ms · 类型 {tr.data_types.join('/')}
                  {tr.last_error && <span className="text-rose-300">· {tr.last_error}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 填 Key 弹窗 */}
      <AnimatePresence>
        {keyDialog && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setKeyDialog(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b0b] p-6 shadow-2xl"
            >
              <h3 className="text-sm font-semibold text-white">{keyDialog.label} · API Key</h3>
              <p className="mt-1 text-xs text-neutral-500">Key 将用主密钥 AES-GCM 加密存本地数据库, 界面仅显示脱敏。保存后立即注入并热重载, 无需重启。</p>
              <div className="mt-3 flex items-center gap-2">
                <a href={keyDialog.signup_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-indigo-300 hover:underline">
                  <ExternalLink className="h-3 w-3" /> 去官网获取 Key
                </a>
              </div>
              <input
                type="password" autoFocus value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
                placeholder="粘贴 API Key / Token"
                className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-indigo-500/50"
              />
              {keyError && <p className="mt-2 text-xs text-rose-300">{keyError}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setKeyDialog(null)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-300 hover:bg-white/10">取消</button>
                <button onClick={() => void saveKey()} disabled={savingKey || !keyInput.trim()} className="rounded-lg border border-indigo-500/50 bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                  {savingKey ? '保存中…' : '加密保存并启用'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
