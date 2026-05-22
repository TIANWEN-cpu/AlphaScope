"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  RefreshCw,
  CheckCircle,
  XCircle,
  Cpu,
  Users,
  Zap,
} from "lucide-react";
import {
  listAgents,
  listAgentModels,
  listProviders,
  listModes,
  getCosts,
} from "@/lib/api";

export function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<"agents" | "providers" | "modes" | "costs">("agents");
  const [agents, setAgents] = useState<Record<string, unknown>[]>([]);
  const [providers, setProviders] = useState<Record<string, unknown>[]>([]);
  const [modes, setModes] = useState<Record<string, unknown>[]>([]);
  const [costs, setCosts] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [agentsRes, providersRes, modesRes, costsRes] = await Promise.all([
          listAgentModels().catch(() => ({ agents: [] })),
          listProviders().catch(() => ({ providers: [] })),
          listModes().catch(() => ({ modes: [] })),
          getCosts().catch(() => ({})),
        ]);
        setAgents(agentsRes.agents || []);
        setProviders(providersRes.providers || []);
        setModes(modesRes.modes || []);
        setCosts(costsRes);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const tabs = [
    { id: "agents" as const, label: "Agent 配置", icon: <Cpu size={14} /> },
    { id: "providers" as const, label: "模型供应商", icon: <Zap size={14} /> },
    { id: "modes" as const, label: "分析模式", icon: <Users size={14} /> },
    { id: "costs" as const, label: "成本统计", icon: <Settings size={14} /> },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <Settings size={20} className="text-zinc-400" />
          设置中心
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs rounded-md border transition-colors ${
              activeTab === tab.id
                ? "border-blue-500/50 text-blue-400 bg-blue-500/10"
                : "border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
          <RefreshCw size={14} className="animate-spin mr-2" />
          加载中...
        </div>
      ) : (
        <>
          {activeTab === "agents" && (
            <div className="space-y-2">
              {agents.length === 0 ? (
                <div className="text-zinc-600 text-sm text-center py-8">
                  暂无 Agent 配置
                </div>
              ) : (
                agents.map((agent, i) => (
                  <div
                    key={i}
                    className="bg-[#18181b] rounded-lg border border-zinc-800/50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-zinc-200 font-medium">
                          {String(agent.name)}
                        </div>
                        <div className="text-[10px] text-zinc-600 font-mono">
                          {String(agent.vendor)} / {String(agent.model)}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-500 font-mono">
                        {String(agent.key)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "providers" && (
            <div className="space-y-2">
              {providers.length === 0 ? (
                <div className="text-zinc-600 text-sm text-center py-8">
                  暂无供应商配置
                </div>
              ) : (
                providers.map((p, i) => (
                  <div
                    key={i}
                    className="bg-[#18181b] rounded-lg border border-zinc-800/50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-zinc-200">
                        {String(p.name || p.id)}
                      </div>
                      <div className="text-[10px] text-zinc-600 font-mono">
                        {String(p.base_url || "")}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "modes" && (
            <div className="space-y-2">
              {modes.length === 0 ? (
                <div className="text-zinc-600 text-sm text-center py-8">
                  暂无模式配置
                </div>
              ) : (
                modes.map((m, i) => (
                  <div
                    key={i}
                    className="bg-[#18181b] rounded-lg border border-zinc-800/50 p-3"
                  >
                    <div className="text-sm text-zinc-200 font-medium">
                      {String(m.name)}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      {String(m.description)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "costs" && (
            <div className="bg-[#18181b] rounded-lg border border-zinc-800/50 p-4">
              <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap">
                {JSON.stringify(costs, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
