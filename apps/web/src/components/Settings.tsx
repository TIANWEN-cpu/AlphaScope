import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings2,
  Key,
  Shield,
  Server,
  Database,
  Globe,
  Monitor,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  Activity,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api, normalizeDisplayError, ProviderRecord } from '../lib/api';

const SETTING_TABS = [
  { id: 'general', label: '基础设置', icon: Settings2 },
  { id: 'api', label: 'API 密钥', icon: Key },
  { id: 'network', label: '网络节点', icon: Globe },
  { id: 'security', label: '安全组', icon: Shield },
  { id: 'data', label: '数据管理', icon: Database },
];

type ApiStatus = 'online' | 'error' | 'checking';
type NoticeType = 'info' | 'success' | 'warning' | 'error';

interface Notice {
  type: NoticeType;
  text: string;
}

interface ProviderForm {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  api_key_masked: string;
  enabled: boolean;
  dirty: boolean;
  isNew: boolean;
}

const DEFAULT_PROVIDER_FORMS: ProviderForm[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    base_url: 'https://api.deepseek.com/v1',
    api_key: '',
    api_key_masked: '',
    enabled: true,
    dirty: true,
    isNew: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    api_key: '',
    api_key_masked: '',
    enabled: false,
    dirty: true,
    isNew: true,
  },
];

const emptyProviderForm = (): ProviderForm => ({
  id: '',
  name: '',
  base_url: '',
  api_key: '',
  api_key_masked: '',
  enabled: true,
  dirty: true,
  isNew: true,
});

const looksMojibake = (value: string) => /[ÃÂ�]|[\u00c0-\u00ff]{2,}/.test(value);

const providerDisplayName = (provider: ProviderRecord) => {
  const rawName = String(provider.name || '').trim();
  if (rawName && !looksMojibake(rawName)) return rawName;
  const id = String(provider.id || '').trim();
  const baseUrl = String(provider.base_url || '').toLowerCase();
  if (baseUrl.includes('sensenova')) return 'SenseNova';
  if (baseUrl.includes('deepseek')) return 'DeepSeek';
  if (baseUrl.includes('openai')) return 'OpenAI';
  return id || 'Unnamed Provider';
};

const mapProviderToForm = (provider: ProviderRecord): ProviderForm => ({
  id: String(provider.id || ''),
  name: providerDisplayName(provider),
  base_url: String(provider.base_url || ''),
  api_key: '',
  api_key_masked: String(provider.api_key_masked || ''),
  enabled: provider.enabled !== false,
  dirty: false,
  isNew: false,
});

const validateProvider = (provider: ProviderForm): string | null => {
  if (!provider.id.trim()) return '请填写 Provider ID。';
  if (!provider.name.trim()) return '请填写 Provider 名称。';
  if (!provider.base_url.trim()) return '请填写 Base URL。';
  if (!/^https?:\/\//.test(provider.base_url.trim())) return 'Base URL 必须以 http:// 或 https:// 开头。';
  if (!provider.api_key_masked && !provider.api_key.trim()) return '首次保存 Provider 时必须填写 API Key。';
  return null;
};

export function Settings() {
  const [activeTab, setActiveTab] = useState('api');
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [providerForms, setProviderForms] = useState<ProviderForm[]>(DEFAULT_PROVIDER_FORMS);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>({
    type: 'info',
    text: '正在同步后端 Provider 配置...',
  });

  const loadSettings = useCallback(async () => {
    setIsLoadingProviders(true);
    setApiStatus('checking');
    setNotice({ type: 'info', text: '正在同步后端 Provider 配置...' });

    const [healthResult, providersResult] = await Promise.allSettled([api.health(), api.providers()]);

    setApiStatus(healthResult.status === 'fulfilled' && healthResult.value.success ? 'online' : 'error');

    if (providersResult.status === 'fulfilled' && providersResult.value.success) {
      const loadedProviders = providersResult.value.data?.providers || [];
      setProviders(loadedProviders);
      setProviderForms(loadedProviders.length ? loadedProviders.map(mapProviderToForm) : DEFAULT_PROVIDER_FORMS);
      setNotice({
        type: 'success',
        text: loadedProviders.length ? `已加载 ${loadedProviders.length} 个 Provider。` : '后端暂无 Provider，已提供默认模板。',
      });
    } else {
      setProviders([]);
      setProviderForms(DEFAULT_PROVIDER_FORMS);
      setNotice({
        type: 'error',
        text: providersResult.status === 'fulfilled'
          ? normalizeDisplayError(providersResult.value.error, '加载 Provider 配置失败。')
          : '后端连接失败，无法加载 Provider 配置。',
      });
    }

    setIsLoadingProviders(false);
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateProviderForm = (index: number, patch: Partial<ProviderForm>) => {
    setProviderForms(prev => prev.map((provider, currentIndex) => (
      currentIndex === index ? { ...provider, ...patch, dirty: true } : provider
    )));
  };

  const handleAddProvider = () => {
    setProviderForms(prev => [...prev, emptyProviderForm()]);
    setNotice({ type: 'info', text: '已添加空 Provider 表单，请填写后保存。' });
  };

  const handleSaveProvider = async (provider: ProviderForm) => {
    const validationError = validateProvider(provider);
    if (validationError) {
      setNotice({ type: 'warning', text: validationError });
      return;
    }

    const id = provider.id.trim();
    setSavingId(id);
    setNotice({ type: 'info', text: `正在保存 ${provider.name.trim()}...` });

    const result = await api.providerSave({
      id,
      name: provider.name.trim(),
      base_url: provider.base_url.trim(),
      api_key: provider.api_key.trim(),
      enabled: provider.enabled,
    });

    setSavingId(null);
    if (result.success) {
      setNotice({ type: 'success', text: `${provider.name.trim()} 已保存，配置已同步到模型网关。` });
      await loadSettings();
    } else {
      setNotice({ type: 'error', text: normalizeDisplayError(result.error, '保存 Provider 失败。') });
    }
  };

  const handleTestProvider = async (provider: ProviderForm) => {
    if (provider.isNew || provider.dirty) {
      setNotice({ type: 'warning', text: '请先保存 Provider，再测试连接。' });
      return;
    }

    const id = provider.id.trim();
    setTestingId(id);
    setNotice({ type: 'info', text: `正在测试 ${provider.name} 连接...` });

    const result = await api.providerTest(id);
    setTestingId(null);

    if (result.success && result.data?.success) {
      const models = result.data.models?.slice(0, 5).join(', ');
      setNotice({
        type: 'success',
        text: models ? `${result.data.message || '连接成功'}：${models}` : result.data.message || '连接成功。',
      });
    } else {
      setNotice({
        type: 'error',
        text: normalizeDisplayError(result.data?.error || result.error, '连接测试失败。'),
      });
    }
  };

  const handleDeleteProvider = async (provider: ProviderForm, index: number) => {
    if (provider.isNew) {
      setProviderForms(prev => prev.filter((_, currentIndex) => currentIndex !== index));
      setNotice({ type: 'info', text: '已移除未保存的 Provider 表单。' });
      return;
    }

    if (!window.confirm(`确认删除 Provider「${provider.name || provider.id}」？`)) return;

    const id = provider.id.trim();
    setDeletingId(id);
    setNotice({ type: 'info', text: `正在删除 ${provider.name}...` });

    const result = await api.providerDelete(id);
    setDeletingId(null);
    if (result.success) {
      setNotice({ type: 'success', text: `${provider.name} 已删除。` });
      await loadSettings();
    } else {
      setNotice({ type: 'error', text: normalizeDisplayError(result.error, '删除 Provider 失败。') });
    }
  };

  const noticeClass = {
    info: 'text-neutral-400 bg-white/[0.03] border-white/10',
    success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    error: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  }[notice.type];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex p-6 lg:p-8 max-w-[1200px] mx-auto text-neutral-300 gap-8"
    >
      <div className="w-64 flex flex-col gap-8 flex-shrink-0 relative z-10">
        <div>
          <h2 className="text-3xl font-display font-medium tracking-tight text-white mb-2">系统设置</h2>
          <p className="text-sm text-neutral-400 font-mono">SYSTEM PREFERENCES</p>
        </div>

        <nav className="flex flex-col gap-1">
          {SETTING_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative group font-medium text-sm',
                  isActive
                    ? 'text-indigo-400'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="settings-active"
                    className="absolute inset-0 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.05)]"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className="w-5 h-5 relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 relative z-10 bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-3xl shadow-xl overflow-hidden flex flex-col">
        <div className="h-2 bg-gradient-to-r from-indigo-500/40 via-emerald-500/40 to-transparent"></div>

        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'api' && (
              <motion.div
                key="api"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-4xl"
              >
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-medium text-neutral-100 flex items-center gap-2 mb-2">
                      <Key className="w-5 h-5 text-indigo-400" />
                      API 密钥管理
                    </h3>
                    <p className="text-sm text-neutral-400">配置分析引擎及外部模型 Provider。密钥由后端加密保存，前端只显示脱敏占位。</p>
                  </div>
                  <button
                    onClick={handleAddProvider}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors border border-indigo-500 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> 新增 Provider
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-black/20 border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-medium text-neutral-200">后端连接状态</h4>
                        <p className="text-xs text-neutral-500 mt-1 font-mono">{api.baseUrl}</p>
                      </div>
                      <span className={cn(
                        'text-[10px] font-mono px-2 py-0.5 rounded border',
                        apiStatus === 'online'
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : apiStatus === 'checking'
                            ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                            : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                      )}>
                        {apiStatus === 'online' ? 'ONLINE' : apiStatus === 'checking' ? 'CHECKING' : 'ERROR'}
                      </span>
                    </div>

                    <div className={cn('text-xs font-mono border rounded-xl px-3 py-2 mb-4', noticeClass)}>
                      {notice.text}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {providerForms.slice(0, 6).map((provider, index) => (
                        <div key={`${provider.id || 'new'}-${index}`} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="text-xs text-neutral-200 font-medium truncate">{provider.name || provider.id || 'New Provider'}</div>
                            <div className="text-[10px] text-neutral-500 font-mono truncate">{provider.base_url || 'Base URL 未配置'}</div>
                          </div>
                          <span className={cn(
                            'text-[9px] font-mono px-1.5 py-0.5 rounded border',
                            provider.enabled === false
                              ? 'text-neutral-500 bg-white/5 border-white/10'
                              : provider.api_key_masked || provider.api_key
                                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                          )}>
                            {provider.enabled === false ? 'DISABLED' : provider.api_key_masked || provider.api_key ? 'KEY SET' : 'REQUIRED'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {providerForms.map((provider, index) => {
                      const providerKey = provider.id || `new-${index}`;
                      const isBusy = savingId === provider.id || testingId === provider.id || deletingId === provider.id;

                      return (
                        <form
                          key={`${providerKey}-${index}`}
                          className="space-y-4 p-5 rounded-2xl bg-black/20 border border-white/5"
                          onSubmit={(event) => event.preventDefault()}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <h4 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
                                <Monitor className="w-4 h-4 text-indigo-400" />
                                {provider.name || '新 Provider'}
                              </h4>
                              <p className="text-xs text-neutral-500 mt-1">测试连接前请先保存配置。</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateProviderForm(index, { enabled: !provider.enabled })}
                              className={cn(
                                'text-[10px] font-mono px-2 py-1 rounded border transition-colors',
                                provider.enabled
                                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                  : 'text-neutral-500 bg-white/5 border-white/10'
                              )}
                            >
                              {provider.enabled ? 'ENABLED' : 'DISABLED'}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="space-y-2">
                              <span className="text-xs text-neutral-400">Provider ID</span>
                              <input
                                value={provider.id}
                                readOnly={!provider.isNew}
                                onChange={(event) => updateProviderForm(index, { id: event.target.value })}
                                placeholder="deepseek"
                                className={cn(
                                  'w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-indigo-500 transition-all placeholder:text-neutral-700',
                                  !provider.isNew && 'text-neutral-500 cursor-not-allowed'
                                )}
                              />
                            </label>

                            <label className="space-y-2">
                              <span className="text-xs text-neutral-400">显示名称</span>
                              <input
                                value={provider.name}
                                onChange={(event) => updateProviderForm(index, { name: event.target.value })}
                                placeholder="DeepSeek"
                                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all placeholder:text-neutral-700"
                              />
                            </label>
                          </div>

                          <label className="space-y-2 block">
                            <span className="text-xs text-neutral-400">Base URL</span>
                            <input
                              value={provider.base_url}
                              onChange={(event) => updateProviderForm(index, { base_url: event.target.value })}
                              placeholder="https://api.example.com/v1"
                              className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-indigo-500 transition-all placeholder:text-neutral-700"
                            />
                          </label>

                          <label className="space-y-2 block">
                            <span className="text-xs text-neutral-400">API Key</span>
                            <input
                              type="password"
                              name={`api_key_${provider.id || index}`}
                              autoComplete="new-password"
                              value={provider.api_key}
                              onChange={(event) => updateProviderForm(index, { api_key: event.target.value })}
                              placeholder={provider.api_key_masked || 'sk-...'}
                              className="w-full bg-white/[0.03] border border-indigo-500/30 rounded-lg px-4 py-2.5 text-sm text-white font-mono shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] focus:border-indigo-500 focus:bg-white/[0.05] focus:outline-none transition-all placeholder:text-neutral-600"
                            />
                            <span className="text-[11px] text-neutral-500">
                              {provider.api_key_masked ? `当前密钥：${provider.api_key_masked}。留空保存会保留旧密钥。` : '首次保存需要填写 API Key。'}
                            </span>
                          </label>

                          <div className="flex flex-wrap justify-end gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteProvider(provider, index)}
                              disabled={isBusy}
                              className="px-4 py-2 bg-white/5 hover:bg-rose-500/10 text-neutral-300 hover:text-rose-300 rounded-xl text-xs font-medium transition-colors border border-white/5 hover:border-rose-500/20 flex items-center gap-2 disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              {deletingId === provider.id ? '删除中...' : provider.isNew ? '移除' : '删除'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTestProvider(provider)}
                              disabled={isBusy}
                              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl text-xs font-medium transition-colors border border-white/5 flex items-center gap-2 disabled:opacity-50"
                            >
                              <Activity className="w-4 h-4" />
                              {testingId === provider.id ? '测试中...' : '测试连接'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveProvider(provider)}
                              disabled={isBusy}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors border border-indigo-500 flex items-center gap-2 disabled:opacity-50"
                            >
                              <Save className="w-4 h-4" />
                              {savingId === provider.id ? '保存中...' : '保存'}
                            </button>
                          </div>
                        </form>
                      );
                    })}
                  </div>

                  <div className="pt-4 flex justify-end gap-3">
                    <button
                      onClick={() => void loadSettings()}
                      disabled={isLoadingProviders}
                      className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl text-sm font-medium transition-colors border border-white/5 shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      <RefreshCw className={cn('w-4 h-4', isLoadingProviders && 'animate-spin')} />
                      放弃更改 / 重载配置
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab !== 'api' && (
              <motion.div
                key="other"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto"
              >
                <div className="w-16 h-16 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                  <Server className="w-8 h-8 text-neutral-500" />
                </div>
                <h3 className="text-lg font-medium text-neutral-200 mb-2">配置项暂未接入</h3>
                <p className="text-sm text-neutral-400">
                  {SETTING_TABS.find(t => t.id === activeTab)?.label} 面板当前没有对应后端持久化接口，暂不开放编辑。
                </p>
                <button disabled className="mt-8 px-5 py-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-neutral-500 font-mono cursor-not-allowed">
                  暂未开放
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
