import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, KeyRound, Loader2, Rocket, X } from 'lucide-react';
import { fetchApi } from '../lib/api';

/**
 * 首次引导向导(纯新增,可跳过)。
 *
 * 自判断显示:仅当尚未配置任何模型 Provider 且用户未跳过时弹出。
 * 引导用户:选预设 → 填 API Key → 保存 → 测试连接 → 开始使用。
 * 复用既有端点 /api/settings/providers(保存)与 .../{id}/test(测试),不改动任何现有功能。
 */

const ONBOARDED_KEY = 'alphascope:onboarded';
// 用户从引导里点了「先用 Demo 体验」时标记,供 App 顶部展示一条"当前为 Demo 演示样本"提示。
export const DEMO_BANNER_KEY = 'alphascope:demo-banner';

interface ProviderPreset {
  id: string;
  name: string;
  base_url: string;
  hint?: string;
}

const PRESETS: ProviderPreset[] = [
  { id: 'deepseek', name: 'DeepSeek', base_url: 'https://api.deepseek.com', hint: '国内直连 · 便宜 · OpenAI 兼容(推荐)' },
  { id: 'moonshot', name: 'Moonshot / Kimi', base_url: 'https://api.moonshot.cn/v1' },
  { id: 'zhipu', name: '智谱 GLM', base_url: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'dashscope', name: '通义千问 (DashScope)', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'openai', name: 'OpenAI', base_url: 'https://api.openai.com/v1' },
  { id: 'custom', name: '自定义 / 其它', base_url: '' },
];

type Status = 'idle' | 'saving' | 'testing' | 'ok' | 'error';

export function Onboarding() {
  const [show, setShow] = useState(false);
  const [presetId, setPresetId] = useState('deepseek');
  const [providerId, setProviderId] = useState('deepseek');
  const [name, setName] = useState('DeepSeek');
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  // 检测:无已配置 Provider 且未跳过 → 展示
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem(ONBOARDED_KEY)) return;
    let cancelled = false;
    void fetchApi<{ providers?: Array<{ id: string }> }>('/api/settings/providers')
      .then((data) => {
        const configured = (data?.providers ?? []).length > 0;
        if (!cancelled && !configured) setShow(true);
      })
      .catch(() => {
        /* 取数失败不打扰用户 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyPreset = (id: string) => {
    setPresetId(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p && id !== 'custom') {
      setProviderId(p.id);
      setName(p.name);
      setBaseUrl(p.base_url);
    } else if (id === 'custom') {
      setProviderId('');
      setName('');
      setBaseUrl('');
    }
  };

  const dismiss = () => {
    if (typeof window !== 'undefined') window.localStorage.setItem(ONBOARDED_KEY, '1');
    setShow(false);
  };

  // 跳过配 Key,直接用内置 Demo 数据体验(后端 demo_provider/demo_fallback 自动兜底)。
  // 仅写"已引导"标记并关闭弹窗,不改动任何后端配置。
  const startDemo = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ONBOARDED_KEY, '1');
      window.localStorage.setItem(DEMO_BANNER_KEY, '1');
    }
    setShow(false);
  };

  const saveAndTest = async () => {
    const pid = providerId.trim();
    const url = baseUrl.trim();
    const key = apiKey.trim();
    if (!pid || !url || !key) {
      setStatus('error');
      setMessage('请填写 Provider、Base URL 和 API Key');
      return;
    }
    try {
      setStatus('saving');
      setMessage('正在保存配置…');
      await fetchApi('/api/settings/providers', {
        method: 'POST',
        body: JSON.stringify({
          id: pid,
          name: name.trim() || pid,
          base_url: url,
          api_key: key,
          enabled: true,
        }),
      });
      setStatus('testing');
      setMessage('正在测试连接…');
      await fetchApi(`/api/settings/providers/${encodeURIComponent(pid)}/test`, { method: 'POST' });
      if (typeof window !== 'undefined') window.localStorage.setItem(ONBOARDED_KEY, '1');
      setStatus('ok');
      setMessage('连接成功!配置已保存,可以开始使用了。');
    } catch (e) {
      // 配置已保存(provider 列表已非空),仅测试失败:提示但允许继续
      const msg = e instanceof Error ? e.message : String(e);
      setStatus('error');
      setMessage(`测试未通过:${msg.slice(0, 160)}。可检查 Key / Base URL 后重试,或先跳过稍后在「设置」里调整。`);
    }
  };

  if (!show) return null;

  const busy = status === 'saving' || status === 'testing';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0c12] p-6 shadow-2xl ring-1 ring-black/70">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-100">欢迎使用 研策中枢 AlphaScope</h2>
              <p className="mt-0.5 text-[12px] text-neutral-500">配置一个大模型 Provider 即可开始(用你自己的 API Key)。</p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            title="稍后再说"
            className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === 'ok' ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">{message}</span>
            </div>
            <button
              type="button"
              onClick={() => setShow(false)}
              className="mt-4 w-full rounded-lg bg-indigo-500 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
            >
              开始使用
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] text-neutral-500">选择模型服务商</label>
              <select
                value={presetId}
                onChange={(e) => applyPreset(e.target.value)}
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-neutral-200 focus:border-indigo-500/50 focus:outline-none"
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0b0c12]">
                    {p.name}
                  </option>
                ))}
              </select>
              {PRESETS.find((p) => p.id === presetId)?.hint && (
                <p className="mt-1 text-[10px] text-emerald-400/80">{PRESETS.find((p) => p.id === presetId)?.hint}</p>
              )}
            </div>

            {presetId === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  placeholder="Provider ID (如 deepseek)"
                  className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-indigo-500/50 focus:outline-none"
                />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="显示名称"
                  className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-indigo-500/50 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-[11px] text-neutral-500">API Base URL</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.deepseek.com"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-indigo-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] text-neutral-500">
                <KeyRound className="h-3 w-3" /> API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="粘贴你的 API Key"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-indigo-500/50 focus:outline-none"
              />
            </div>

            {message && status === 'error' && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{message}</span>
              </div>
            )}
            {busy && (
              <div className="flex items-center gap-2 text-[12px] text-indigo-300">
                <Loader2 className="h-4 w-4 animate-spin" /> {message}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={dismiss}
                className="text-[12px] text-neutral-500 transition-colors hover:text-neutral-300"
              >
                稍后再说
              </button>
              <button
                type="button"
                onClick={() => void saveAndTest()}
                disabled={busy}
                className="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                保存并测试
              </button>
            </div>

            <div className="flex items-center gap-2 pt-2 text-[11px] text-neutral-500">
              <span className="text-neutral-600">还没准备好 Key?</span>
              <button
                type="button"
                onClick={startDemo}
                className="inline-flex items-center gap-1 text-emerald-400 transition-colors hover:text-emerald-300"
              >
                <FlaskConical className="h-3 w-3" />
                先用 Demo 体验(内置 10 只股票示例数据,无需 Key)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
