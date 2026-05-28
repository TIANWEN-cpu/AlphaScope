import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings2,
  Key,
  Shield,
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
import { api, AppPreferences, normalizeDisplayError, ProviderRecord } from '../lib/api';

const SETTING_TABS = [
  { id: 'general', label: '基础设置', icon: Settings2 },
  { id: 'api', label: 'API 密钥', icon: Key },
  { id: 'network', label: '网络节点', icon: Globe },
  { id: 'security', label: '安全组', icon: Shield },
  { id: 'data', label: '数据管理', icon: Database },
] as const;

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

type PreferenceTabId = Exclude<(typeof SETTING_TABS)[number]['id'], 'api'>;

type PreferenceDraft = AppPreferences;

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

const DEFAULT_PREFERENCES: PreferenceDraft = {
  general: {
    language: 'zh-CN',
    theme: 'dark',
    default_symbol: '600519',
    auto_refresh: true,
    refresh_interval: 60,
  },
  network: {
    api_base_url: api.baseUrl,
    request_timeout_ms: 12000,
    retry_count: 1,
    proxy_url: '',
  },
  security: {
    mask_api_keys: true,
    confirm_deletes: true,
    allow_external_links: true,
    audit_log: true,
  },
  data: {
    news_limit: 30,
    price_cache_days: 180,
    prefer_local_cache: true,
    auto_fetch_missing: true,
  },
};

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

const mergePreferences = (preferences?: Partial<AppPreferences> | null): PreferenceDraft => ({
  general: { ...DEFAULT_PREFERENCES.general, ...(preferences?.general || {}) },
  network: { ...DEFAULT_PREFERENCES.network, ...(preferences?.network || {}) },
  security: { ...DEFAULT_PREFERENCES.security, ...(preferences?.security || {}) },
  data: { ...DEFAULT_PREFERENCES.data, ...(preferences?.data || {}) },
});

export function Settings() {
  const [activeTab, setActiveTab] = useState('api');
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [providerForms, setProviderForms] = useState<ProviderForm[]>(DEFAULT_PROVIDER_FORMS);
  const [preferences, setPreferences] = useState<PreferenceDraft>(DEFAULT_PREFERENCES);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
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

    const [healthResult, providersResult, preferencesResult] = await Promise.allSettled([
      api.health(),
      api.providers(),
      api.preferences(),
    ]);

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

    if (preferencesResult.status === 'fulfilled' && preferencesResult.value.success) {
      setPreferences(mergePreferences(preferencesResult.value.data?.preferences));
    } else if (preferencesResult.status === 'fulfilled') {
      setPreferences(DEFAULT_PREFERENCES);
      setNotice({
        type: 'warning',
        text: normalizeDisplayError(preferencesResult.value.error, '系统偏好设置接口不可用，已使用本地默认值。'),
      });
    } else {
      setPreferences(DEFAULT_PREFERENCES);
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

  const updatePreference = <TSection extends keyof PreferenceDraft>(
    section: TSection,
    patch: Partial<PreferenceDraft[TSection]>,
  ) => {
    setPreferences(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...patch,
      },
    }));
  };

  const handleSavePreferences = async (section?: PreferenceTabId) => {
    setIsSavingPreferences(true);
    setNotice({
      type: 'info',
      text: section ? `正在保存 ${SETTING_TABS.find(tab => tab.id === section)?.label || '偏好设置'}...` : '正在保存系统偏好设置...',
    });

    const payload = (section ? { [section]: preferences[section] } : preferences) as Partial<AppPreferences>;
    const result = await api.preferencesSave(payload);
    setIsSavingPreferences(false);
    if (result.success && result.data?.preferences) {
      setPreferences(mergePreferences(result.data.preferences));
      setNotice({ type: 'success', text: '系统偏好设置已保存。' });
    } else {
      setNotice({ type: 'error', text: normalizeDisplayError(result.error, '保存系统偏好设置失败。') });
    }
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

  const renderSaveBar = (section: PreferenceTabId) => (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/20 p-4">
      <div>
        <div className="text-xs font-medium text-neutral-200">保存到后端配置库</div>
        <div className="mt-1 text-[11px] text-neutral-500">刷新页面或重启前端后仍会保留这些设置。</div>
      </div>
      <button
        type="button"
        onClick={() => void handleSavePreferences(section)}
        disabled={isSavingPreferences}
        className="flex items-center gap-2 rounded-xl border border-indigo-500 bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {isSavingPreferences ? '保存中...' : '保存设置'}
      </button>
    </div>
  );

  const renderTextField = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder = '',
    help = '',
  ) => (
    <label className="space-y-2">
      <span className="text-xs text-neutral-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none transition-all placeholder:text-neutral-700 focus:border-indigo-500"
      />
      {help && <span className="block text-[11px] leading-relaxed text-neutral-500">{help}</span>}
    </label>
  );

  const renderNumberField = (
    label: string,
    value: number,
    onChange: (value: number) => void,
    min: number,
    max: number,
    step = 1,
    help = '',
  ) => (
    <label className="space-y-2">
      <span className="text-xs text-neutral-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 font-mono text-sm text-white outline-none transition-all focus:border-indigo-500"
      />
      {help && <span className="block text-[11px] leading-relaxed text-neutral-500">{help}</span>}
    </label>
  );

  const renderSelectField = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: Array<{ value: string; label: string }>,
    help = '',
  ) => (
    <label className="space-y-2">
      <span className="text-xs text-neutral-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-indigo-500"
      >
        {options.map(option => (
          <option key={option.value} value={option.value} className="bg-neutral-900">
            {option.label}
          </option>
        ))}
      </select>
      {help && <span className="block text-[11px] leading-relaxed text-neutral-500">{help}</span>}
    </label>
  );

  const renderToggle = (
    label: string,
    checked: boolean,
    onChange: (value: boolean) => void,
    help = '',
  ) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex min-h-[72px] items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.05]"
    >
      <span>
        <span className="block text-sm font-medium text-neutral-200">{label}</span>
        {help && <span className="mt-1 block text-[11px] leading-relaxed text-neutral-500">{help}</span>}
      </span>
      <span className={cn(
        'relative h-6 w-11 shrink-0 rounded-full border transition-colors',
        checked ? 'border-emerald-500/40 bg-emerald-500/30' : 'border-white/10 bg-black/40',
      )}>
        <span className={cn(
          'absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )} />
      </span>
    </button>
  );

  const renderPreferencePanel = (section: PreferenceTabId) => {
    const currentTab = SETTING_TABS.find(tab => tab.id === section);
    const Icon = currentTab?.icon || Settings2;

    return (
      <motion.div
        key={section}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="max-w-4xl"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-xl font-medium text-neutral-100">
              <Icon className="h-5 w-5 text-indigo-400" />
              {currentTab?.label}
            </h3>
            <p className="text-sm text-neutral-400">
              {section === 'general' && '配置界面语言、默认标的与自动刷新节奏。'}
              {section === 'network' && '配置前端访问后端时使用的连接参数和重试策略。'}
              {section === 'security' && '配置密钥展示、删除确认、外链打开和审计记录策略。'}
              {section === 'data' && '配置新闻拉取数量、行情缓存窗口和缺失数据补齐策略。'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSettings()}
            disabled={isLoadingProviders}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-neutral-300 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', isLoadingProviders && 'animate-spin')} />
            重载
          </button>
        </div>

        <div className={cn('mb-6 rounded-xl border px-3 py-2 text-xs font-mono', noticeClass)}>
          {notice.text}
        </div>

        {section === 'general' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {renderSelectField('界面语言', preferences.general.language, value => updatePreference('general', { language: value }), [
              { value: 'zh-CN', label: '简体中文' },
              { value: 'en-US', label: 'English' },
            ])}
            {renderSelectField('主题模式', preferences.general.theme, value => updatePreference('general', { theme: value }), [
              { value: 'dark', label: '深色' },
              { value: 'light', label: '浅色' },
              { value: 'system', label: '跟随系统' },
            ])}
            {renderTextField('默认标的', preferences.general.default_symbol, value => updatePreference('general', { default_symbol: value }), '600519', '进入工作台时优先加载的股票代码。')}
            {renderNumberField('自动刷新间隔（秒）', preferences.general.refresh_interval, value => updatePreference('general', { refresh_interval: value }), 10, 3600, 5)}
            <div className="md:col-span-2">
              {renderToggle('启用自动刷新', preferences.general.auto_refresh, value => updatePreference('general', { auto_refresh: value }), '用于新闻、行情和回测状态的定时刷新。')}
            </div>
          </div>
        )}

        {section === 'network' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              {renderTextField('后端 API 地址', preferences.network.api_base_url, value => updatePreference('network', { api_base_url: value }), 'http://127.0.0.1:8000', '当前构建仍以环境变量中的地址发请求，这里保存的是可见配置与后续启动检查依据。')}
            </div>
            {renderNumberField('请求超时（毫秒）', preferences.network.request_timeout_ms, value => updatePreference('network', { request_timeout_ms: value }), 3000, 120000, 1000)}
            {renderNumberField('失败重试次数', preferences.network.retry_count, value => updatePreference('network', { retry_count: value }), 0, 5, 1)}
            <div className="md:col-span-2">
              {renderTextField('代理地址', preferences.network.proxy_url, value => updatePreference('network', { proxy_url: value }), 'http://127.0.0.1:7890', '留空表示不使用代理。')}
            </div>
          </div>
        )}

        {section === 'security' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {renderToggle('隐藏 API Key 明文', preferences.security.mask_api_keys, value => updatePreference('security', { mask_api_keys: value }), '设置页只展示脱敏密钥，避免误泄露。')}
            {renderToggle('删除前二次确认', preferences.security.confirm_deletes, value => updatePreference('security', { confirm_deletes: value }), '删除 Provider、归档和证据条目前弹出确认。')}
            {renderToggle('允许打开外部原文', preferences.security.allow_external_links, value => updatePreference('security', { allow_external_links: value }), '新闻与公告原文按钮会打开外部链接。')}
            {renderToggle('记录配置审计日志', preferences.security.audit_log, value => updatePreference('security', { audit_log: value }), '为后续诊断保留配置变更痕迹。')}
          </div>
        )}

        {section === 'data' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {renderNumberField('新闻拉取数量', preferences.data.news_limit, value => updatePreference('data', { news_limit: value }), 5, 100, 5)}
            {renderNumberField('行情缓存天数', preferences.data.price_cache_days, value => updatePreference('data', { price_cache_days: value }), 30, 3650, 30)}
            {renderToggle('优先使用本地缓存', preferences.data.prefer_local_cache, value => updatePreference('data', { prefer_local_cache: value }), '已有缓存足够时减少外部数据源请求。')}
            {renderToggle('自动补齐缺失行情', preferences.data.auto_fetch_missing, value => updatePreference('data', { auto_fetch_missing: value }), '分析或回测发现数据不足时尝试自动抓取。')}
          </div>
        )}

        {renderSaveBar(section)}
      </motion.div>
    );
  };

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

            {activeTab !== 'api' && renderPreferencePanel(activeTab as PreferenceTabId)}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
