import { useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  Database,
  Globe,
  Network,
  Play,
  Settings2,
  ShieldCheck,
  Square,
  TrendingUp,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../lib/utils';
import {
  AgentConfig,
  AgentIconKey,
  getEnabledAgentRuntimeConfigs,
  loadAgentConfigs,
  saveAgentConfigs,
} from '../lib/agentConfigs';

const ICON_MAP: Record<AgentIconKey, ElementType> = {
  macro: Globe,
  fundamental: BarChart3,
  quant: TrendingUp,
  risk: ShieldCheck,
  data: Database,
  execution: Activity,
  custom: Bot,
};

interface AgentsSystemProps {
  onOpenAgentSettings?: () => void;
}

export function AgentsSystem({ onOpenAgentSettings }: AgentsSystemProps) {
  const [agents, setAgents] = useState<AgentConfig[]>(() => loadAgentConfigs());
  const [topologyOpen, setTopologyOpen] = useState(false);

  useEffect(() => {
    saveAgentConfigs(agents);
  }, [agents]);

  useEffect(() => {
    const handleAgentConfigChange = (event: Event) => {
      const configs = (event as CustomEvent<AgentConfig[]>).detail;
      setAgents(Array.isArray(configs) ? configs : loadAgentConfigs());
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'ai-finance:agent-configs-v1') {
        setAgents(loadAgentConfigs());
      }
    };

    window.addEventListener('agent-configs-changed', handleAgentConfigChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('agent-configs-changed', handleAgentConfigChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const enabledAgents = useMemo(() => agents.filter((agent) => agent.enabled), [agents]);
  const enabledCount = enabledAgents.length;
  const runningCount = useMemo(
    () => enabledAgents.filter((agent) => agent.status === 'analyzing').length,
    [enabledAgents],
  );
  const runtimeConfigs = useMemo(() => getEnabledAgentRuntimeConfigs(agents), [agents]);

  const handleToggleExpert = (id: string) => {
    setAgents((prev) => prev.map((agent) => {
      if (agent.id !== id || !agent.enabled) return agent;
      const isAnalyzing = agent.status === 'analyzing';
      return {
        ...agent,
        status: isAnalyzing ? 'idle' : 'analyzing',
        task: isAnalyzing ? '暂无任务' : '执行模拟诊断指令...',
      };
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col p-4 text-neutral-300"
    >
      <div className="flex flex-col gap-4 px-2 mb-6 relative z-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-3xl font-display font-medium tracking-tight text-white mb-2 flex flex-wrap items-center gap-3">
            专家圆桌
            <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono tracking-wider align-middle">
              多Agent协同
            </span>
          </h2>
          <p className="text-sm text-neutral-400 font-mono">
            查看 Agent 运行状态与协作拓扑；角色、提示词和数量请在系统设置中维护。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="agents-open-settings"
            onClick={onOpenAgentSettings}
            className="flex items-center gap-2 rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/15"
          >
            <Settings2 className="w-4 h-4" />
            到系统设置配置
          </button>
          <button
            type="button"
            data-testid="agents-topology-toggle"
            onClick={() => setTopologyOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)] transition-colors hover:bg-indigo-500/20"
          >
            <Network className="w-4 h-4" />
            全网拓扑
          </button>
        </div>
      </div>

      <div className="mx-2 mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          ['已启用席位', `${enabledCount}/${agents.length}`, '进入分析请求的 Agent 数量。'],
          ['运行中', `${runningCount}`, '当前模拟调度中的专家席位。'],
          ['请求配置', `${runtimeConfigs.length}`, '将写入 agent_configs 的配置项。'],
        ].map(([label, value, desc]) => (
          <div key={label} className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] font-mono tracking-wider text-neutral-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-white">{value}</p>
            <p className="mt-1 text-[11px] text-neutral-500">{desc}</p>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {topologyOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="relative z-10 mx-2 mb-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-100">协作拓扑概览</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  当前启用 {enabledCount} 个 Agent，其中 {runningCount} 个正在工作；设置页保存后会同步到本页和分析请求。
                </p>
              </div>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                调度器在线
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                ['输入层', '行情、公告、新闻、研报与用户上传材料形成上下文。'],
                ['研判层', '启用的 Agent 按各自提示词、模型和温度参数参与圆桌。'],
                ['输出层', '结论汇入证据链、报告生成与工作台对话，并保留人工复核。'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl border border-white/5 bg-black/25 p-4">
                  <p className="text-xs font-semibold text-neutral-200">{title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-500">{desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-8 relative z-10 custom-scrollbar">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent, index) => {
            const Icon = ICON_MAP[agent.iconKey] ?? Bot;
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: agent.enabled ? 1 : 0.55, scale: 1 }}
                transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 24 }}
                className={cn(
                  'group relative flex min-h-[260px] flex-col overflow-hidden rounded-2xl border bg-white/[0.02] p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.04]',
                  agent.status === 'analyzing' && agent.enabled ? 'border-indigo-500/35' : 'border-white/5 hover:border-indigo-500/25',
                  !agent.enabled && 'bg-black/20',
                )}
              >
                {agent.status === 'analyzing' && agent.enabled && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 blur-[40px] rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none"
                  />
                )}

                <div className="relative z-10 mb-5 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-inner transition-colors',
                      agent.status === 'analyzing' && agent.enabled
                        ? 'border-indigo-500/30 bg-gradient-to-tr from-indigo-600/20 to-indigo-400/10 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                        : 'border-white/5 bg-black/40 text-neutral-500 group-hover:text-neutral-400',
                    )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold tracking-wide text-neutral-100">{agent.name}</h3>
                      <p className="truncate text-[10px] font-mono uppercase tracking-wider text-neutral-500">{agent.role}</p>
                    </div>
                  </div>

                  <div className={cn(
                    'shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-mono',
                    agent.enabled
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/10 bg-black/30 text-neutral-500',
                  )}
                  >
                    {agent.enabled ? '启用' : '停用'}
                  </div>
                </div>

                <div className="relative z-10 flex-1">
                  <p className="text-sm leading-relaxed text-neutral-400 transition-colors group-hover:text-neutral-300">
                    {agent.description}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-mono">
                    <span className="rounded border border-white/5 bg-white/[0.03] px-2 py-1 text-neutral-500">{agent.model}</span>
                    <span className="rounded border border-white/5 bg-white/[0.03] px-2 py-1 text-neutral-500">
                      温度 {agent.temperature.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="relative z-10 mt-5 flex items-center justify-between border-t border-white/5 pt-4">
                  <div className="flex min-w-0 max-w-[68%] flex-col gap-1">
                    <span className="text-[10px] font-mono tracking-wide text-neutral-500">当前任务</span>
                    <motion.span
                      key={agent.task}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn('truncate text-xs font-medium', agent.status === 'analyzing' && agent.enabled ? 'text-indigo-300' : 'text-neutral-400')}
                      title={agent.task}
                    >
                      {agent.task}
                    </motion.span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleExpert(agent.id)}
                    disabled={!agent.enabled}
                    title={agent.enabled ? '启动或暂停模拟分析' : '请先在系统设置中启用该 Agent'}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-40',
                      agent.status === 'analyzing' && agent.enabled
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.1)] hover:bg-rose-500/20'
                        : 'border-white/10 bg-black/40 text-neutral-400 hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-400',
                    )}
                  >
                    {agent.status === 'analyzing' && agent.enabled ? <Square className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
