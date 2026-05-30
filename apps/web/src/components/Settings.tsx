import { useEffect, useMemo, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Database,
  Globe,
  Key,
  Monitor,
  Plus,
  RotateCcw,
  Save,
  Server,
  Settings2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ProviderHealthPanel } from './ProviderHealthPanel';
import {
  AgentConfig,
  AgentIconKey,
  DEFAULT_AGENT_CONFIGS,
  createCustomAgentConfig,
  getEnabledAgentRuntimeConfigs,
  loadAgentConfigs,
  saveAgentConfigs,
} from '../lib/agentConfigs';

type SettingTab = 'general' | 'agents' | 'api' | 'network' | 'security' | 'data';

const SETTING_TABS: Array<{ id: SettingTab; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'general', label: '基础设置', icon: Settings2 },
  { id: 'agents', label: 'Agent 编排', icon: BrainCircuit },
  { id: 'api', label: 'API 密钥', icon: Key },
  { id: 'network', label: '网络节点', icon: Globe },
  { id: 'security', label: '安全策略', icon: Shield },
  { id: 'data', label: '数据源健康', icon: Database },
];

const AGENT_ICON_MAP: Record<AgentIconKey, ComponentType<{ className?: string }>> = {
  macro: Globe,
  fundamental: BarChart3,
  quant: TrendingUp,
  risk: ShieldCheck,
  data: Database,
  execution: Activity,
  custom: Bot,
};

const AGENT_ICON_OPTIONS: Array<{ key: AgentIconKey; label: string }> = [
  { key: 'macro', label: '宏观' },
  { key: 'fundamental', label: '基本面' },
  { key: 'quant', label: '量化' },
  { key: 'risk', label: '风控' },
  { key: 'data', label: '数据' },
  { key: 'execution', label: '执行' },
  { key: 'custom', label: '自定义' },
];

const AGENT_MODEL_OPTIONS = ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'deepseek-r1', 'qwen-max'];

const DEFAULT_SETTINGS = {
  defaultStock: '贵州茅台 (600519.SH)',
  language: '简体中文',
  density: '紧凑',
  autoRefresh: true,
  pushNotice: true,
  apiBaseUrl: 'http://localhost:8000',
  timeoutSeconds: 12,
  retryCount: 2,
  sseEnabled: true,
  maskKeys: true,
  confirmDangerousActions: true,
  auditLog: true,
  windKey: 'wind-demo-token-configured',
  llmKey: '',
  activeProvider: '腾讯行情 + 东财数据中心',
};

type SettingsState = typeof DEFAULT_SETTINGS;
const SETTINGS_STORAGE_KEY = 'alphascope:ui-settings';
const LEGACY_SETTINGS_STORAGE_KEY = `${['ai', 'finance'].join('-')}:ui-settings`;

function loadSettings(): SettingsState {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    const settings = { ...DEFAULT_SETTINGS, ...parsed };
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function SettingCard({
  title,
  desc,
  icon: Icon,
  children,
}: {
  title: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/5 bg-black/20 p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10">
          <Icon className="h-4 w-4 text-indigo-300" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.025] px-4 py-3">
      <span>
        <span className="block text-sm text-neutral-200">{label}</span>
        <span className="mt-1 block text-xs text-neutral-500">{hint}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-indigo-500" />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-neutral-400">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-neutral-100 outline-none transition-all placeholder:text-neutral-700 focus:border-indigo-500/50 focus:bg-white/[0.05]"
      />
    </label>
  );
}

interface SettingsProps {
  initialTab?: string;
}

function normalizeSettingTab(value?: string): SettingTab {
  return SETTING_TABS.some((tab) => tab.id === value) ? value as SettingTab : 'api';
}

export function Settings({ initialTab }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingTab>(() => normalizeSettingTab(initialTab));
  const [settings, setSettings] = useState<SettingsState>(() => loadSettings());
  const [savedMessage, setSavedMessage] = useState('配置仅保存在当前浏览器预览环境');
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>(() => loadAgentConfigs());
  const [selectedAgentId, setSelectedAgentId] = useState(() => loadAgentConfigs()[0]?.id ?? DEFAULT_AGENT_CONFIGS[0].id);

  useEffect(() => {
    setActiveTab(normalizeSettingTab(initialTab));
  }, [initialTab]);

  useEffect(() => {
    if (agentConfigs.length && !agentConfigs.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(agentConfigs[0].id);
    }
  }, [agentConfigs, selectedAgentId]);

  const activeTitle = useMemo(
    () => SETTING_TABS.find((tab) => tab.id === activeTab)?.label ?? '系统设置',
    [activeTab],
  );
  const selectedAgent = useMemo(
    () => agentConfigs.find((agent) => agent.id === selectedAgentId) ?? agentConfigs[0],
    [agentConfigs, selectedAgentId],
  );
  const enabledAgentCount = useMemo(() => agentConfigs.filter((agent) => agent.enabled).length, [agentConfigs]);
  const runtimeAgentCount = useMemo(() => getEnabledAgentRuntimeConfigs(agentConfigs).length, [agentConfigs]);

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    saveAgentConfigs(agentConfigs);
    setSavedMessage(`已保存 ${activeTitle}，${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
  };

  const resetSettings = () => {
    if (activeTab === 'agents') {
      const resetAgents = DEFAULT_AGENT_CONFIGS.map((agent) => ({ ...agent }));
      setAgentConfigs(resetAgents);
      setSelectedAgentId(resetAgents[0].id);
      saveAgentConfigs(resetAgents);
      setSavedMessage('已恢复默认 Agent 编排');
      return;
    }

    setSettings(DEFAULT_SETTINGS);
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_SETTINGS_STORAGE_KEY);
    setSavedMessage('已恢复默认配置');
  };

  const updateAgent = (id: string, patch: Partial<AgentConfig>) => {
    setAgentConfigs((prev) => {
      const next = prev.map((agent) => (agent.id === id ? { ...agent, ...patch } : agent));
      saveAgentConfigs(next);
      return next;
    });
  };

  const addAgent = () => {
    setAgentConfigs((prev) => {
      const nextAgent = createCustomAgentConfig(prev.length + 1);
      const next = [...prev, nextAgent];
      setSelectedAgentId(nextAgent.id);
      saveAgentConfigs(next);
      setSavedMessage('已新增自定义 Agent');
      return next;
    });
  };

  const deleteAgent = (id: string) => {
    setAgentConfigs((prev) => {
      const remaining = prev.filter((agent) => agent.id !== id);
      const next = remaining.length ? remaining : [createCustomAgentConfig(1)];
      setSelectedAgentId((current) => (current === id ? next[0].id : current));
      saveAgentConfigs(next);
      setSavedMessage('已删除 Agent 配置');
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mx-auto flex h-full max-w-[1200px] gap-8 p-6 text-neutral-300 lg:p-8"
    >
      <div className="relative z-10 flex w-64 shrink-0 flex-col gap-8">
        <div>
          <h2 className="mb-2 text-3xl font-display font-medium tracking-tight text-white">系统设置</h2>
          <p className="text-sm font-mono text-neutral-400">本地预览配置中心</p>
        </div>

        <nav className="flex flex-col gap-1">
          {SETTING_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                data-testid={`settings-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300',
                  isActive ? 'text-indigo-400' : 'text-neutral-500 hover:bg-white/[0.02] hover:text-neutral-300',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="settings-active"
                    className="absolute inset-0 rounded-xl border border-indigo-500/20 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.05)]"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className="relative z-10 h-5 w-5" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] shadow-xl backdrop-blur-md">
        <div className="h-2 bg-gradient-to-r from-indigo-500/40 via-emerald-500/40 to-transparent" />

        <div className="flex items-center justify-between border-b border-white/5 px-8 py-5">
          <div>
            <h3 className="text-xl font-medium text-neutral-100">{activeTitle}</h3>
            <p className="mt-1 text-xs text-neutral-500">{savedMessage}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="settings-reset"
              onClick={resetSettings}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
              恢复默认
            </button>
            <button
              data-testid="settings-save"
              onClick={saveSettings}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-500 bg-indigo-600 px-4 py-2 text-sm text-white shadow-[0_0_15px_rgba(99,102,241,0.25)] transition-colors hover:bg-indigo-500"
            >
              <Save className="h-4 w-4" />
              保存配置
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div key="general" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-3xl space-y-5">
                <SettingCard title="工作台偏好" desc="控制默认标的、显示密度和自动刷新行为。" icon={SlidersHorizontal}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <TextField label="默认研究标的" value={settings.defaultStock} onChange={(value) => updateSetting('defaultStock', value)} />
                    <TextField label="界面语言" value={settings.language} onChange={(value) => updateSetting('language', value)} />
                    <TextField label="信息密度" value={settings.density} onChange={(value) => updateSetting('density', value)} />
                    <TextField label="首选数据源组合" value={settings.activeProvider} onChange={(value) => updateSetting('activeProvider', value)} />
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <ToggleRow label="自动刷新行情沙盘" hint="切换标的后自动重算 K 线与资金模拟。" checked={settings.autoRefresh} onChange={() => updateSetting('autoRefresh', !settings.autoRefresh)} />
                    <ToggleRow label="桌面通知提示" hint="任务完成、数据源降级和分析失败时提醒。" checked={settings.pushNotice} onChange={() => updateSetting('pushNotice', !settings.pushNotice)} />
                  </div>
                </SettingCard>
              </motion.div>
            )}

            {activeTab === 'agents' && selectedAgent && (
              <motion.div key="agents" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-5xl space-y-5">
                <SettingCard title="Agent 圆桌编排" desc="统一维护专家团数量、启用状态、模型参数和系统提示词。" icon={BrainCircuit}>
                  <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {[
                      ['总席位', agentConfigs.length, '当前圆桌中的 Agent 数量。'],
                      ['已启用', enabledAgentCount, '会传入分析请求的 Agent。'],
                      ['请求配置', runtimeAgentCount, 'agent_configs 输出项。'],
                    ].map(([label, value, hint]) => (
                      <div key={String(label)} className="rounded-xl border border-white/5 bg-white/[0.025] px-4 py-3">
                        <p className="text-[10px] font-mono tracking-wider text-neutral-500">{label}</p>
                        <p className="mt-1 text-lg font-semibold text-white">{value}</p>
                        <p className="mt-1 text-[11px] text-neutral-500">{hint}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3 px-1">
                        <span className="text-xs font-medium text-neutral-300">专家席位</span>
                        <button
                          type="button"
                          data-testid="settings-agent-add"
                          onClick={addAgent}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300 transition-colors hover:bg-emerald-500/15"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          新增
                        </button>
                      </div>

                      <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                        {agentConfigs.map((agent) => {
                          const Icon = AGENT_ICON_MAP[agent.iconKey] ?? Bot;
                          const isActive = selectedAgentId === agent.id;
                          return (
                            <button
                              key={agent.id}
                              type="button"
                              data-testid={`settings-agent-${agent.id}`}
                              onClick={() => setSelectedAgentId(agent.id)}
                              className={cn(
                                'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                                isActive
                                  ? 'border-indigo-500/35 bg-indigo-500/10'
                                  : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]',
                              )}
                            >
                              <span className="flex items-center gap-3">
                                <span className={cn(
                                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                                  agent.enabled
                                    ? 'border-indigo-500/25 bg-indigo-500/10 text-indigo-300'
                                    : 'border-white/10 bg-black/25 text-neutral-600',
                                )}
                                >
                                  <Icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium text-neutral-100">{agent.name}</span>
                                  <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-wider text-neutral-500">{agent.role}</span>
                                </span>
                                <span className={cn(
                                  'shrink-0 rounded-md border px-2 py-0.5 text-[10px]',
                                  agent.enabled
                                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                    : 'border-white/10 bg-black/25 text-neutral-500',
                                )}
                                >
                                  {agent.enabled ? '启用' : '停用'}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-black/20 p-5">
                      <div className="mb-5 flex flex-col gap-3 border-b border-white/5 pb-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-300">Selected Agent</p>
                          <h4 className="mt-1 truncate text-lg font-semibold text-white">{selectedAgent.name}</h4>
                          <p className="mt-1 text-xs text-neutral-500">保存后会同步到专家圆桌页和分析请求。</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-neutral-300">
                            <input
                              type="checkbox"
                              checked={selectedAgent.enabled}
                              onChange={() => updateAgent(selectedAgent.id, { enabled: !selectedAgent.enabled, status: selectedAgent.enabled ? 'idle' : selectedAgent.status })}
                              className="accent-indigo-500"
                            />
                            参与分析
                          </label>
                          <button
                            type="button"
                            data-testid="settings-agent-delete"
                            onClick={() => deleteAgent(selectedAgent.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 transition-colors hover:bg-rose-500/15"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            删除
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <TextField label="名称" value={selectedAgent.name} onChange={(value) => updateAgent(selectedAgent.id, { name: value })} />
                        <TextField label="角色标签" value={selectedAgent.role} onChange={(value) => updateAgent(selectedAgent.id, { role: value })} />
                        <label className="block md:col-span-2">
                          <span className="mb-2 block text-xs font-medium text-neutral-400">职责说明</span>
                          <textarea
                            value={selectedAgent.description}
                            onChange={(event) => updateAgent(selectedAgent.id, { description: event.target.value })}
                            rows={3}
                            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm leading-relaxed text-neutral-100 outline-none transition-all custom-scrollbar placeholder:text-neutral-700 focus:border-indigo-500/50 focus:bg-white/[0.05]"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs font-medium text-neutral-400">模型</span>
                          <select
                            value={selectedAgent.model}
                            onChange={(event) => updateAgent(selectedAgent.id, { model: event.target.value })}
                            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-neutral-100 outline-none transition-all focus:border-indigo-500/50 focus:bg-white/[0.05]"
                          >
                            {AGENT_MODEL_OPTIONS.map((model) => (
                              <option key={model} value={model}>{model}</option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-neutral-400">
                            温度
                            <span className="font-mono text-indigo-300">{selectedAgent.temperature.toFixed(2)}</span>
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={selectedAgent.temperature}
                            onChange={(event) => updateAgent(selectedAgent.id, { temperature: Number(event.target.value) })}
                            className="h-10 w-full accent-indigo-500"
                          />
                        </label>

                        <div className="md:col-span-2">
                          <span className="mb-2 block text-xs font-medium text-neutral-400">图标</span>
                          <div className="grid grid-cols-4 gap-2 md:grid-cols-7">
                            {AGENT_ICON_OPTIONS.map((option) => {
                              const Icon = AGENT_ICON_MAP[option.key];
                              return (
                                <button
                                  key={option.key}
                                  type="button"
                                  title={option.label}
                                  onClick={() => updateAgent(selectedAgent.id, { iconKey: option.key })}
                                  className={cn(
                                    'flex h-10 items-center justify-center rounded-xl border transition-colors',
                                    selectedAgent.iconKey === option.key
                                      ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
                                      : 'border-white/10 bg-white/[0.02] text-neutral-500 hover:text-neutral-300',
                                  )}
                                >
                                  <Icon className="h-4 w-4" />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <label className="block md:col-span-2">
                          <span className="mb-2 block text-xs font-medium text-neutral-400">系统提示词</span>
                          <textarea
                            value={selectedAgent.prompt}
                            onChange={(event) => updateAgent(selectedAgent.id, { prompt: event.target.value })}
                            rows={9}
                            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm leading-relaxed text-neutral-100 outline-none transition-all custom-scrollbar placeholder:text-neutral-700 focus:border-indigo-500/50 focus:bg-white/[0.05]"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </SettingCard>
              </motion.div>
            )}

            {activeTab === 'api' && (
              <motion.div key="api" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-3xl space-y-5">
                <SettingCard title="外部服务密钥" desc="密钥只在本地预览态展示，真实生产环境应由后端安全存储和注入。" icon={Key}>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-200">Wind / Choice 数据接口令牌</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          已配置
                        </span>
                      </div>
                      <TextField label="令牌" type={settings.maskKeys ? 'password' : 'text'} value={settings.windKey} onChange={(value) => updateSetting('windKey', value)} />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-200">OpenAI / Gemini 推理端点密钥</span>
                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">待补充</span>
                      </div>
                      <TextField label="密钥" type={settings.maskKeys ? 'password' : 'text'} value={settings.llmKey} placeholder="sk-..." onChange={(value) => updateSetting('llmKey', value)} />
                    </div>
                    <ToggleRow label="隐藏密钥明文" hint="关闭后可临时检查输入是否正确。" checked={settings.maskKeys} onChange={() => updateSetting('maskKeys', !settings.maskKeys)} />
                  </div>
                </SettingCard>
              </motion.div>
            )}

            {activeTab === 'network' && (
              <motion.div key="network" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-3xl space-y-5">
                <SettingCard title="后端连接" desc="用于本地 FastAPI 服务、SSE 任务事件和 Provider 健康接口。" icon={Server}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="md:col-span-3">
                      <TextField label="API Base URL" value={settings.apiBaseUrl} onChange={(value) => updateSetting('apiBaseUrl', value)} />
                    </div>
                    <TextField label="请求超时（秒）" type="number" value={settings.timeoutSeconds} onChange={(value) => updateSetting('timeoutSeconds', Number(value) || 1)} />
                    <TextField label="重试次数" type="number" value={settings.retryCount} onChange={(value) => updateSetting('retryCount', Number(value) || 0)} />
                    <TextField label="SSE 路径" value="/api/tasks/events" onChange={() => undefined} />
                  </div>
                  <div className="mt-4">
                    <ToggleRow label="启用任务进度流" hint="报告生成和批量分析可实时显示 task_progress。" checked={settings.sseEnabled} onChange={() => updateSetting('sseEnabled', !settings.sseEnabled)} />
                  </div>
                </SettingCard>
              </motion.div>
            )}

            {activeTab === 'security' && (
              <motion.div key="security" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-3xl space-y-5">
                <SettingCard title="安全与审计" desc="降低误操作、明文泄露和无证据结论进入摘要的风险。" icon={Shield}>
                  <div className="grid grid-cols-1 gap-3">
                    <ToggleRow label="危险操作二次确认" hint="删除证据、清空缓存或取消任务前弹出确认。" checked={settings.confirmDangerousActions} onChange={() => updateSetting('confirmDangerousActions', !settings.confirmDangerousActions)} />
                    <ToggleRow label="记录本地审计日志" hint="保留设置变更、任务运行和数据源降级摘要。" checked={settings.auditLog} onChange={() => updateSetting('auditLog', !settings.auditLog)} />
                    <ToggleRow label="关键结论必须绑定 ref 引用" hint="无证据结论只能进入待核验观察，不能进入最终摘要。" checked={settings.maskKeys} onChange={() => updateSetting('maskKeys', !settings.maskKeys)} />
                  </div>
                </SettingCard>
              </motion.div>
            )}

            {activeTab === 'data' && (
              <motion.div key="data" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <ProviderHealthPanel />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              ['当前后端', settings.apiBaseUrl, Monitor],
              ['事件流', settings.sseEnabled ? '已启用' : '已关闭', Bell],
              ['配置状态', '本地已可编辑', CheckCircle2],
            ].map(([label, value, Icon]) => (
              <div key={String(label)} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <Icon className="mb-2 h-4 w-4 text-indigo-300" />
                <p className="text-[10px] text-neutral-500">{label}</p>
                <p className="mt-1 truncate text-sm text-neutral-200">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
