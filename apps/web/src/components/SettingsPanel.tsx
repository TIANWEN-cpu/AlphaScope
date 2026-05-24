"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  RefreshCw,
  CheckCircle,
  XCircle,
  Cpu,
  Users,
  Zap,
  Plus,
  Trash2,
  TestTube,
  Save,
  Edit,
  X,
  Server,
  ListTodo,
  DollarSign,
  Activity,
  BarChart3,
} from "lucide-react";
import {
  listAgents,
  listAgentModels,
  listProviders,
  listModes,
  getCosts,
  listSettingsProviders,
  saveSettingsProvider,
  deleteSettingsProvider,
  testSettingsProvider,
  listSettingsModels,
  listManageAgents,
  saveManageAgent,
  deleteManageAgent,
  listManageTeams,
  saveManageTeam,
  deleteManageTeam,
  SettingsProvider,
  ManageAgent,
  ManageTeam,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const INPUT_CLS =
  "bg-black/20 border border-white/10 text-neutral-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/50 w-full";
const BTN_PRIMARY =
  "flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/[0.02] disabled:text-neutral-600 text-white text-xs rounded-xl transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)]";
const BTN_DANGER =
  "flex items-center gap-1 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 text-xs rounded-xl transition-colors border border-rose-500/30";
const BTN_SECONDARY =
  "flex items-center gap-1 px-3 py-1.5 bg-white/[0.02] hover:bg-white/[0.04] text-neutral-300 text-xs rounded-xl transition-colors border border-white/5";

export function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<
    "agents" | "providers" | "modes" | "costs"
  >("agents");
  const [modes, setModes] = useState<Record<string, unknown>[]>([]);
  const [costs, setCosts] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);

  // Providers CRUD state
  const [settingsProviders, setSettingsProviders] = useState<
    SettingsProvider[]
  >([]);
  const [editingProvider, setEditingProvider] = useState<Partial<SettingsProvider> | null>(null);
  const [providerForm, setProviderForm] = useState({
    id: "",
    name: "",
    base_url: "",
    api_key: "",
    enabled: true,
  });
  const [testResult, setTestResult] = useState<
    Record<string, { success: boolean; message: string }>
  >({});
  const [providerModels, setProviderModels] = useState<
    Record<string, string[]>
  >({});

  // Agents CRUD state
  const [manageAgents, setManageAgents] = useState<ManageAgent[]>([]);
  const [manageTeams, setManageTeams] = useState<ManageTeam[]>([]);
  const [editingAgent, setEditingAgent] = useState<Partial<ManageAgent> | null>(null);
  const [agentForm, setAgentForm] = useState({
    id: "",
    name: "",
    description: "",
    system_prompt: "",
    provider: "deepseek",
    model: "deepseek-chat",
    temperature: 0.3,
    max_tokens: 400,
    enabled: true,
  });
  const [editingTeam, setEditingTeam] = useState<Partial<ManageTeam> | null>(null);
  const [teamForm, setTeamForm] = useState({
    id: "",
    name: "",
    description: "",
    member_ids: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  const loadSettingsProviders = useCallback(async () => {
    try {
      const res = await listSettingsProviders().catch(() => ({
        providers: [],
      }));
      setSettingsProviders(res.providers || []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadManageAgents = useCallback(async () => {
    try {
      const [aRes, tRes] = await Promise.all([
        listManageAgents().catch(() => ({ agents: [] })),
        listManageTeams().catch(() => ({ teams: [] })),
      ]);
      setManageAgents(aRes.agents || []);
      setManageTeams(tRes.teams || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [modesRes, costsRes] = await Promise.all([
          listModes().catch(() => ({ modes: [] })),
          getCosts().catch(() => ({})),
        ]);
        setModes(modesRes.modes || []);
        setCosts(costsRes);
        await Promise.all([loadSettingsProviders(), loadManageAgents()]);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loadSettingsProviders, loadManageAgents]);

  // --- Provider CRUD handlers ---
  const handleSaveProvider = async () => {
    setSaving(true);
    try {
      await saveSettingsProvider(providerForm);
      setEditingProvider(null);
      setProviderForm({
        id: "",
        name: "",
        base_url: "",
        api_key: "",
        enabled: true,
      });
      await loadSettingsProviders();
    } catch (err) {
      alert(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm(`确定删除供应商 "${id}" ?`)) return;
    try {
      await deleteSettingsProvider(id);
      await loadSettingsProviders();
    } catch (err) {
      alert(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleTestProvider = async (id: string) => {
    setTestResult((prev) => ({
      ...prev,
      [id]: { success: false, message: "测试中..." },
    }));
    try {
      const res = await testSettingsProvider(id);
      setTestResult((prev) => ({
        ...prev,
        [id]: {
          success: res.success,
          message: res.success
            ? `连接成功 (${res.models?.length ?? 0} 模型)`
            : res.message || "连接失败",
        },
      }));
      // Auto-fetch full model list on success
      if (res.success) {
        try {
          const modelsRes = await listSettingsModels(id);
          setProviderModels((prev) => ({
            ...prev,
            [id]: (modelsRes.models || []).map((m: { id: string }) => m.id),
          }));
        } catch {
          // fallback: use models from test result
          if (res.models?.length) {
            setProviderModels((prev) => ({ ...prev, [id]: res.models as string[] }));
          }
        }
      }
    } catch (err) {
      setTestResult((prev) => ({
        ...prev,
        [id]: {
          success: false,
          message: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  };

  // --- Agent CRUD handlers ---
  const handleSaveAgent = async () => {
    setSaving(true);
    try {
      await saveManageAgent(agentForm);
      setEditingAgent(null);
      setAgentForm({
        id: "",
        name: "",
        description: "",
        system_prompt: "",
        provider: "deepseek",
        model: "deepseek-chat",
        temperature: 0.3,
        max_tokens: 400,
        enabled: true,
      });
      await loadManageAgents();
    } catch (err) {
      alert(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm(`确定删除 Agent "${id}" ?`)) return;
    try {
      await deleteManageAgent(id);
      await loadManageAgents();
    } catch (err) {
      alert(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // --- Team CRUD handlers ---
  const handleSaveTeam = async () => {
    setSaving(true);
    try {
      await saveManageTeam(teamForm);
      setEditingTeam(null);
      setTeamForm({ id: "", name: "", description: "", member_ids: [] });
      await loadManageAgents();
    } catch (err) {
      alert(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm(`确定删除团队 "${id}" ?`)) return;
    try {
      await deleteManageTeam(id);
      await loadManageAgents();
    } catch (err) {
      alert(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const tabs = [
    { id: "agents" as const, label: "Agent 配置", icon: <Cpu size={14} /> },
    {
      id: "providers" as const,
      label: "模型供应商",
      icon: <Server size={14} />,
    },
    { id: "modes" as const, label: "分析模式", icon: <Zap size={14} /> },
    { id: "costs" as const, label: "成本统计", icon: <ListTodo size={14} /> },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 gap-4 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-medium text-white flex items-center gap-3">
          <Settings size={22} className="text-indigo-400" />
          设置中心
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs rounded-xl border transition-colors ${
              activeTab === tab.id
                ? "border-indigo-500/50 text-indigo-400 bg-indigo-500/10"
                : "border-white/5 text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]/30"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
          <RefreshCw size={14} className="animate-spin mr-2" />
          加载中...
        </div>
      ) : (
        <>
          {/* ====== PROVIDERS TAB ====== */}
          {activeTab === "providers" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-neutral-300">
                  模型供应商管理
                </h3>
                <button
                  className={BTN_PRIMARY}
                  onClick={() => {
                    setEditingProvider({});
                    setProviderForm({
                      id: "",
                      name: "",
                      base_url: "",
                      api_key: "",
                      enabled: true,
                    });
                  }}
                >
                  <Plus size={14} /> 添加供应商
                </button>
              </div>

              {/* Provider Form */}
              {editingProvider !== null && (
                <div className="bg-white/[0.02] rounded-xl border border-indigo-500/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm text-neutral-200 font-medium">
                      {editingProvider.id ? "编辑供应商" : "添加供应商"}
                    </h4>
                    <button
                      className="p-1 text-neutral-500 hover:text-neutral-300"
                      onClick={() => setEditingProvider(null)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-neutral-500 mb-1 block">
                        ID
                      </label>
                      <input
                        className={INPUT_CLS}
                        value={providerForm.id}
                        onChange={(e) =>
                          setProviderForm((f) => ({ ...f, id: e.target.value }))
                        }
                        placeholder="my-provider"
                        disabled={!!editingProvider.id}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-500 mb-1 block">
                        名称
                      </label>
                      <input
                        className={INPUT_CLS}
                        value={providerForm.name}
                        onChange={(e) =>
                          setProviderForm((f) => ({
                            ...f,
                            name: e.target.value,
                          }))
                        }
                        placeholder="My Provider"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-neutral-500 mb-1 block">
                        Base URL
                      </label>
                      <input
                        className={INPUT_CLS}
                        value={providerForm.base_url}
                        onChange={(e) =>
                          setProviderForm((f) => ({
                            ...f,
                            base_url: e.target.value,
                          }))
                        }
                        placeholder="https://api.openai.com/v1"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-neutral-500 mb-1 block">
                        API Key
                      </label>
                      <input
                        className={INPUT_CLS}
                        type="password"
                        value={providerForm.api_key}
                        onChange={(e) =>
                          setProviderForm((f) => ({
                            ...f,
                            api_key: e.target.value,
                          }))
                        }
                        placeholder="sk-... (留空则不更新)"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-neutral-400">
                      <input
                        type="checkbox"
                        checked={providerForm.enabled}
                        onChange={(e) =>
                          setProviderForm((f) => ({
                            ...f,
                            enabled: e.target.checked,
                          }))
                        }
                        className="rounded"
                      />
                      启用
                    </label>
                    <div className="flex-1" />
                    <button
                      className={BTN_SECONDARY}
                      onClick={() => setEditingProvider(null)}
                    >
                      取消
                    </button>
                    <button
                      className={BTN_PRIMARY}
                      onClick={handleSaveProvider}
                      disabled={
                        saving ||
                        !providerForm.id ||
                        !providerForm.name ||
                        !providerForm.base_url
                      }
                    >
                      <Save size={14} />
                      {saving ? "保存中..." : "保存"}
                    </button>
                  </div>
                </div>
              )}

              {/* Provider List */}
              {settingsProviders.length === 0 ? (
                <div className="text-neutral-600 text-sm text-center py-8">
                  暂无供应商配置
                </div>
              ) : (
                settingsProviders.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white/[0.02] rounded-xl border border-white/5 p-3 backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-neutral-200 font-medium">
                            {p.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-white/[0.02] text-neutral-500">
                            {p.id}
                          </span>
                          {p.enabled ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                              启用
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/5 text-neutral-500 bg-white/[0.02]">
                              禁用
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-600 font-mono mt-1">
                          {p.base_url}
                        </div>
                        {p.api_key_masked && (
                          <div className="text-[10px] text-neutral-600 font-mono">
                            Key: {p.api_key_masked}
                          </div>
                        )}
                        {providerModels[p.id] && providerModels[p.id].length > 0 && (
                          <div className="mt-2">
                            <div className="text-[10px] text-neutral-500 mb-1">
                              可用模型 ({providerModels[p.id].length})
                            </div>
                            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                              {providerModels[p.id].map((m) => (
                                <span
                                  key={m}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {testResult[p.id] && (
                          <span
                            className={`text-[10px] px-2 py-1 rounded ${
                              testResult[p.id].success
                                ? "text-emerald-400 bg-emerald-500/10"
                                : "text-rose-400 bg-red-500/10"
                            }`}
                          >
                            {testResult[p.id].message}
                          </span>
                        )}
                        <button
                          className="p-1.5 rounded-xl text-neutral-400 hover:bg-white/[0.02] hover:text-neutral-200 transition-colors border border-transparent hover:border-white/5"
                          title="测试连接"
                          onClick={() => handleTestProvider(p.id)}
                        >
                          <TestTube size={14} />
                        </button>
                        <button
                          className="p-1.5 rounded-xl text-neutral-400 hover:bg-white/[0.02] hover:text-neutral-200 transition-colors border border-transparent hover:border-white/5"
                          title="编辑"
                          onClick={() => {
                            setEditingProvider(p);
                            setProviderForm({
                              id: p.id,
                              name: p.name,
                              base_url: p.base_url,
                              api_key: "",
                              enabled: p.enabled,
                            });
                          }}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/30"
                          title="删除"
                          onClick={() => handleDeleteProvider(p.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ====== AGENTS TAB ====== */}
          {activeTab === "agents" && (
            <div className="space-y-6">
              {/* Agents Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-neutral-300">
                    Agent 管理
                  </h3>
                  <button
                    className={BTN_PRIMARY}
                    onClick={() => {
                      setEditingAgent({});
                      setAgentForm({
                        id: "",
                        name: "",
                        description: "",
                        system_prompt: "",
                        provider: "deepseek",
                        model: "deepseek-chat",
                        temperature: 0.3,
                        max_tokens: 400,
                        enabled: true,
                      });
                    }}
                  >
                    <Plus size={14} /> 添加 Agent
                  </button>
                </div>

                {/* Agent Form */}
                {editingAgent !== null && (
                  <div className="bg-white/[0.02] rounded-xl border border-indigo-500/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm text-neutral-200 font-medium">
                        {editingAgent.id ? "编辑 Agent" : "添加 Agent"}
                      </h4>
                      <button
                        className="p-1 text-neutral-500 hover:text-neutral-300"
                        onClick={() => setEditingAgent(null)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-neutral-500 mb-1 block">
                          ID
                        </label>
                        <input
                          className={INPUT_CLS}
                          value={agentForm.id}
                          onChange={(e) =>
                            setAgentForm((f) => ({
                              ...f,
                              id: e.target.value,
                            }))
                          }
                          placeholder="my-agent"
                          disabled={!!editingAgent.id}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-500 mb-1 block">
                          名称
                        </label>
                        <input
                          className={INPUT_CLS}
                          value={agentForm.name}
                          onChange={(e) =>
                            setAgentForm((f) => ({
                              ...f,
                              name: e.target.value,
                            }))
                          }
                          placeholder="自定义分析师"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-neutral-500 mb-1 block">
                          描述
                        </label>
                        <input
                          className={INPUT_CLS}
                          value={agentForm.description}
                          onChange={(e) =>
                            setAgentForm((f) => ({
                              ...f,
                              description: e.target.value,
                            }))
                          }
                          placeholder="Agent 功能描述"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-500 mb-1 block">
                          Provider
                        </label>
                        <input
                          className={INPUT_CLS}
                          value={agentForm.provider}
                          onChange={(e) =>
                            setAgentForm((f) => ({
                              ...f,
                              provider: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-500 mb-1 block">
                          Model
                        </label>
                        <input
                          className={INPUT_CLS}
                          value={agentForm.model}
                          onChange={(e) =>
                            setAgentForm((f) => ({
                              ...f,
                              model: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-500 mb-1 block">
                          Temperature
                        </label>
                        <input
                          className={INPUT_CLS}
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          value={agentForm.temperature}
                          onChange={(e) =>
                            setAgentForm((f) => ({
                              ...f,
                              temperature: parseFloat(e.target.value) || 0.3,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-500 mb-1 block">
                          Max Tokens
                        </label>
                        <input
                          className={INPUT_CLS}
                          type="number"
                          min="100"
                          max="8000"
                          value={agentForm.max_tokens}
                          onChange={(e) =>
                            setAgentForm((f) => ({
                              ...f,
                              max_tokens: parseInt(e.target.value) || 400,
                            }))
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-neutral-500 mb-1 block">
                          System Prompt
                        </label>
                        <textarea
                          className={`${INPUT_CLS} min-h-[80px] resize-y`}
                          value={agentForm.system_prompt}
                          onChange={(e) =>
                            setAgentForm((f) => ({
                              ...f,
                              system_prompt: e.target.value,
                            }))
                          }
                          placeholder="你是一位专业的金融分析师..."
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-neutral-400">
                        <input
                          type="checkbox"
                          checked={agentForm.enabled}
                          onChange={(e) =>
                            setAgentForm((f) => ({
                              ...f,
                              enabled: e.target.checked,
                            }))
                          }
                          className="rounded"
                        />
                        启用
                      </label>
                      <div className="flex-1" />
                      <button
                        className={BTN_SECONDARY}
                        onClick={() => setEditingAgent(null)}
                      >
                        取消
                      </button>
                      <button
                        className={BTN_PRIMARY}
                        onClick={handleSaveAgent}
                        disabled={saving || !agentForm.id || !agentForm.name}
                      >
                        <Save size={14} />
                        {saving ? "保存中..." : "保存"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Agent List */}
                {manageAgents.length === 0 ? (
                  <div className="text-neutral-600 text-sm text-center py-4">
                    暂无自定义 Agent
                  </div>
                ) : (
                  manageAgents.map((a) => (
                    <div
                      key={a.id}
                      className="bg-white/[0.02] rounded-xl border border-white/5 p-3 backdrop-blur-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-neutral-200 font-medium">
                              {a.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-white/[0.02] text-neutral-500">
                              {a.id}
                            </span>
                            {a.enabled ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                                启用
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/5 text-neutral-500 bg-white/[0.02]">
                                禁用
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-600 font-mono mt-1">
                            {a.provider} / {a.model}
                            {a.description && ` — ${a.description}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            className="p-1.5 rounded-xl text-neutral-400 hover:bg-white/[0.02] hover:text-neutral-200 transition-colors border border-transparent hover:border-white/5"
                            title="编辑"
                            onClick={() => {
                              setEditingAgent(a);
                              setAgentForm({
                                id: a.id,
                                name: a.name,
                                description: a.description || "",
                                system_prompt: a.system_prompt || "",
                                provider: a.provider,
                                model: a.model,
                                temperature: a.temperature ?? 0.3,
                                max_tokens: a.max_tokens ?? 400,
                                enabled: a.enabled,
                              });
                            }}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/30"
                            title="删除"
                            onClick={() => handleDeleteAgent(a.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Teams Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-neutral-300">
                    团队管理
                  </h3>
                  <button
                    className={BTN_PRIMARY}
                    onClick={() => {
                      setEditingTeam({});
                      setTeamForm({
                        id: "",
                        name: "",
                        description: "",
                        member_ids: [],
                      });
                    }}
                  >
                    <Plus size={14} /> 添加团队
                  </button>
                </div>

                {/* Team Form */}
                {editingTeam !== null && (
                  <div className="bg-white/[0.02] rounded-xl border border-indigo-500/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm text-neutral-200 font-medium">
                        {editingTeam.id ? "编辑团队" : "添加团队"}
                      </h4>
                      <button
                        className="p-1 text-neutral-500 hover:text-neutral-300"
                        onClick={() => setEditingTeam(null)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-neutral-500 mb-1 block">
                          ID
                        </label>
                        <input
                          className={INPUT_CLS}
                          value={teamForm.id}
                          onChange={(e) =>
                            setTeamForm((f) => ({
                              ...f,
                              id: e.target.value,
                            }))
                          }
                          placeholder="my-team"
                          disabled={!!editingTeam.id}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-500 mb-1 block">
                          名称
                        </label>
                        <input
                          className={INPUT_CLS}
                          value={teamForm.name}
                          onChange={(e) =>
                            setTeamForm((f) => ({
                              ...f,
                              name: e.target.value,
                            }))
                          }
                          placeholder="我的分析团队"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-neutral-500 mb-1 block">
                          描述
                        </label>
                        <input
                          className={INPUT_CLS}
                          value={teamForm.description}
                          onChange={(e) =>
                            setTeamForm((f) => ({
                              ...f,
                              description: e.target.value,
                            }))
                          }
                        />
                      </div>
                      {manageAgents.length > 0 && (
                        <div className="col-span-2">
                          <label className="text-[10px] text-neutral-500 mb-1 block">
                            成员 Agent（可多选）
                          </label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {manageAgents.map((a) => (
                              <label
                                key={a.id}
                                className={`flex items-center gap-1.5 px-2 py-1 text-[10px] rounded border cursor-pointer transition-colors ${
                                  teamForm.member_ids.includes(a.id)
                                    ? "border-indigo-500/50 text-indigo-400 bg-indigo-500/10"
                                    : "border-white/5 text-neutral-500 hover:border-white/5"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={teamForm.member_ids.includes(a.id)}
                                  onChange={(e) => {
                                    setTeamForm((f) => ({
                                      ...f,
                                      member_ids: e.target.checked
                                        ? [...f.member_ids, a.id]
                                        : f.member_ids.filter(
                                            (id) => id !== a.id
                                          ),
                                    }));
                                  }}
                                />
                                {a.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1" />
                      <button
                        className={BTN_SECONDARY}
                        onClick={() => setEditingTeam(null)}
                      >
                        取消
                      </button>
                      <button
                        className={BTN_PRIMARY}
                        onClick={handleSaveTeam}
                        disabled={saving || !teamForm.id || !teamForm.name}
                      >
                        <Save size={14} />
                        {saving ? "保存中..." : "保存"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Team List */}
                {manageTeams.length === 0 ? (
                  <div className="text-neutral-600 text-sm text-center py-4">
                    暂无自定义团队
                  </div>
                ) : (
                  manageTeams.map((t) => (
                    <div
                      key={t.id}
                      className="bg-white/[0.02] rounded-xl border border-white/5 p-3 backdrop-blur-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-neutral-200 font-medium">
                              {t.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-white/[0.02] text-neutral-500">
                              {t.id}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/5 text-neutral-500 bg-white/[0.02]">
                              {t.member_ids?.length ?? 0} 成员
                            </span>
                          </div>
                          {t.description && (
                            <div className="text-[10px] text-neutral-600 mt-1">
                              {t.description}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            className="p-1.5 rounded-xl text-neutral-400 hover:bg-white/[0.02] hover:text-neutral-200 transition-colors border border-transparent hover:border-white/5"
                            title="编辑"
                            onClick={() => {
                              setEditingTeam(t);
                              setTeamForm({
                                id: t.id,
                                name: t.name,
                                description: t.description || "",
                                member_ids: t.member_ids || [],
                              });
                            }}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/30"
                            title="删除"
                            onClick={() => handleDeleteTeam(t.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ====== MODES TAB ====== */}
          {activeTab === "modes" && (
            <div className="space-y-2">
              {modes.length === 0 ? (
                <div className="text-neutral-600 text-sm text-center py-8">
                  暂无模式配置
                </div>
              ) : (
                modes.map((m, i) => (
                  <div
                    key={i}
                    className="bg-white/[0.02] rounded-xl border border-white/5 p-3 backdrop-blur-md"
                  >
                    <div className="text-sm text-neutral-200 font-medium">
                      {String(m.name)}
                    </div>
                    <div className="text-xs text-neutral-400 mt-1">
                      {String(m.description)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ====== COSTS TAB ====== */}
          {activeTab === "costs" && (
            <CostsTab costs={costs} onRefresh={async () => {
              try {
                const res = await getCosts();
                setCosts(res);
              } catch { /* ignore */ }
            }} />
          )}
        </>
      )}
    </div>
  );
}

function CostsTab({
  costs,
  onRefresh,
}: {
  costs: Record<string, unknown>;
  onRefresh: () => void;
}) {
  const totalCalls = (costs.total_calls as number) ?? 0;
  const totalCost = (costs.total_cost_usd as number) ?? 0;
  const inputTokens = (costs.total_input_tokens as number) ?? 0;
  const outputTokens = (costs.total_output_tokens as number) ?? 0;
  const byAgent = (costs.by_agent as Record<string, { calls: number; cost: number; tokens: number }>) ?? {};
  const byModel = (costs.by_model as Record<string, { calls: number; cost: number; tokens: number }>) ?? {};

  const fmtCost = (v: number) => `$${v.toFixed(4)}`;
  const fmtTokens = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-300">成本统计</h3>
        <button className={BTN_SECONDARY} onClick={onRefresh}>
          <RefreshCw size={13} /> 刷新
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "总调用", value: String(totalCalls), icon: <Activity size={16} />, color: "text-indigo-400" },
          { label: "总费用", value: fmtCost(totalCost), icon: <DollarSign size={16} />, color: "text-emerald-400" },
          { label: "输入 Token", value: fmtTokens(inputTokens), icon: <Zap size={16} />, color: "text-amber-400" },
          { label: "输出 Token", value: fmtTokens(outputTokens), icon: <Zap size={16} />, color: "text-indigo-400" },
        ].map((c, i) => (
          <div key={i} className="bg-white/[0.02] rounded-xl border border-white/5 p-4 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-2">
              <span className={c.color}>{c.icon}</span>
              <span className="text-[10px] text-neutral-500">{c.label}</span>
            </div>
            <div className={`text-lg font-mono font-semibold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {totalCalls === 0 ? (
        <div className="bg-white/[0.02] rounded-xl border border-white/5 p-8 text-center">
          <DollarSign size={32} className="text-neutral-700 mx-auto mb-2" />
          <p className="text-sm text-neutral-500">暂无调用记录</p>
          <p className="text-xs text-neutral-600 mt-1">使用 Agent 分析后将自动记录费用</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* By Agent */}
          <div className="bg-white/[0.02] rounded-xl border border-white/5 p-4 backdrop-blur-md">
            <div className="text-xs text-neutral-500 mb-3 flex items-center gap-1.5">
              <Users size={13} /> 按 Agent 分组
            </div>
            {Object.keys(byAgent).length === 0 ? (
              <p className="text-xs text-neutral-600">无数据</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {Object.entries(byAgent).map(([name, d]) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <span className="text-neutral-300 truncate flex-1">{name}</span>
                    <span className="text-neutral-500 font-mono mx-2">{d.calls}次</span>
                    <span className="text-emerald-400 font-mono w-16 text-right">{fmtCost(d.cost)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* By Model */}
          <div className="bg-white/[0.02] rounded-xl border border-white/5 p-4 backdrop-blur-md">
            <div className="text-xs text-neutral-500 mb-3 flex items-center gap-1.5">
              <Cpu size={13} /> 按模型分组
            </div>
            {Object.keys(byModel).length === 0 ? (
              <p className="text-xs text-neutral-600">无数据</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {Object.entries(byModel).map(([name, d]) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <span className="text-neutral-300 truncate flex-1 font-mono">{name}</span>
                    <span className="text-neutral-500 font-mono mx-2">{d.calls}次</span>
                    <span className="text-emerald-400 font-mono w-16 text-right">{fmtCost(d.cost)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
