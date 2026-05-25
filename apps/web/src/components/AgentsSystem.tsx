import React, { useEffect, useState } from 'react';
import { Settings, CircleUserRound, ShieldCheck, TrendingUp, BarChart3, Database, Globe, Network, Activity, Play, Square } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { AgentModule } from '../types';
import { AgentRecord, api } from '../lib/api';

interface Expert {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'analyzing' | 'error';
  task: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  provider: string;
  model: string;
  systemPrompt: string;
  tools: string[];
  temperature: number;
  maxTokens: number;
  persisted: boolean;
}

const fallbackExpert = (
  id: string,
  name: string,
  role: string,
  description: string,
  icon: React.ElementType,
): Expert => ({
  id,
  name,
  role,
  status: 'idle',
  task: '演示配置，未接入管理端配置',
  description,
  icon,
  enabled: true,
  provider: 'demo',
  model: 'demo',
  systemPrompt: '',
  tools: [],
  temperature: 0.3,
  maxTokens: 400,
  persisted: false,
});

const EXPERTS: Expert[] = [
  fallbackExpert('1', '宏观趋势分析师', 'Macro Trend', '整合多源新闻与宏观经济数据，提供全球经济周期与市场大势预判。', Globe),
  fallbackExpert('2', '基本面分析助手', 'Fundamental', '深度剖析公司财务报表、盈利能力、成长性及行业竞争格局。', BarChart3),
  fallbackExpert('3', '量化策略专家', 'Quant Strategy', '基于海量市场数据，发掘统计套利机会，构建并回测多因子选股模型。', TrendingUp),
  fallbackExpert('4', '风险合规顾问', 'Risk & Compliance', '实时监控持仓风险敞口，评估最大回撤并确保交易符合风控阈值。', ShieldCheck),
  fallbackExpert('5', '数据情报收集员', 'Data Scraper', '结构化与非结构化数据聚合，从券商研报、公告中提取关键实体。', Database),
  fallbackExpert('6', '交易执行引擎', 'Execution', '根据策略信号生成最优订单路由，降低滑点并监控执行链路。', Activity),
];

const iconForAgent = (agent: AgentRecord) => {
  const key = String(agent.key || agent.id || agent.role || '').toLowerCase();
  if (key.includes('fundamental')) return BarChart3;
  if (key.includes('technical') || key.includes('quant')) return TrendingUp;
  if (key.includes('risk') || key.includes('compliance')) return ShieldCheck;
  if (key.includes('sentiment') || key.includes('macro')) return Globe;
  return Database;
};

const mapAgentRecord = (agent: AgentRecord, index: number): Expert => {
  const enabled = agent.enabled !== false;
  return {
    id: String(agent.id || agent.key || index + 1),
    name: String(agent.name || `Agent ${index + 1}`),
    role: String(agent.provider || agent.model || agent.role || 'AI Agent'),
    status: enabled ? 'idle' : 'error',
    task: enabled ? '已启用，等待编排器调度' : '已停用，不参与调度',
    description: String(agent.description || agent.role || '已从后端 Agent 配置加载，等待任务编排器调度。'),
    icon: iconForAgent(agent),
    enabled,
    provider: String(agent.provider || 'deepseek'),
    model: String(agent.model || 'deepseek-chat'),
    systemPrompt: String(agent.system_prompt || ''),
    tools: Array.isArray(agent.tools) ? agent.tools : [],
    temperature: Number(agent.temperature ?? 0.3),
    maxTokens: Number(agent.max_tokens ?? 400),
    persisted: Boolean(agent.id),
  };
};

export function AgentsSystem() {
  const [experts, setExperts] = useState<Expert[]>(EXPERTS);
  const [statusText, setStatusText] = useState('正在读取后端 Agent 配置...');
  const [showTopology, setShowTopology] = useState(false);
  const [savingAgentId, setSavingAgentId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAgents = async () => {
      const managed = await api.manageAgents();
      if (cancelled) return;
      if (managed.success && managed.data?.agents?.length) {
        setExperts(managed.data.agents.map(mapAgentRecord));
        setStatusText('已接入 /api/manage/agents，启停会写入后端配置');
        return;
      }

      const defaults = await api.agents();
      if (cancelled) return;
      if (defaults.success && defaults.data?.agents?.length) {
        setExperts(defaults.data.agents.map(mapAgentRecord));
        setStatusText('当前显示默认 Agent 配置；启停需先在管理端持久化配置');
      } else {
        setExperts(EXPERTS);
        setStatusText(defaults.error || managed.error || '后端暂无 Agent 配置，当前显示演示卡片');
      }
    };

    loadAgents();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleExpert = async (expert: Expert) => {
    if (!expert.persisted) {
      setStatusText('演示 Agent 未接入 /api/manage/agents，不能伪装为已启停');
      return;
    }

    const nextEnabled = !expert.enabled;
    setSavingAgentId(expert.id);
    setStatusText(`正在${nextEnabled ? '启用' : '停用'} ${expert.name}...`);
    const result = await api.manageAgentSave({
      id: expert.id,
      name: expert.name,
      description: expert.description,
      system_prompt: expert.systemPrompt,
      provider: expert.provider,
      model: expert.model,
      tools: expert.tools,
      temperature: expert.temperature,
      max_tokens: expert.maxTokens,
      enabled: nextEnabled,
    });
    setSavingAgentId(null);

    if (result.success && result.data) {
      const updated = mapAgentRecord(result.data, 0);
      setExperts(prev => prev.map(item => (item.id === expert.id ? updated : item)));
      setStatusText(`${expert.name} 已${nextEnabled ? '启用' : '停用'}，状态已写入后端`);
    } else {
      setStatusText(result.error || `${expert.name} 启停失败`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col p-4 text-neutral-300"
    >
      <div className="flex items-end justify-between mb-8 px-2 relative z-10">
        <div>
          <h2 className="text-3xl font-display font-medium tracking-tight text-white mb-2 flex items-center gap-3">
            专家圆桌 <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono tracking-wider align-middle ml-2">EXPERT ROUNDTABLE</span>
          </h2>
          <p className="text-sm text-neutral-400 font-mono">协调多个专属领域的 AI Agent 网络进行深度分析与研判。</p>
          <p className="text-xs text-neutral-500 font-mono mt-2">{statusText}</p>
        </div>
        <button
          onClick={() => setShowTopology(prev => !prev)}
          className={cn(
            "px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.1)] hover:bg-indigo-500/20 transition-all flex items-center gap-2 font-medium tracking-wide",
            showTopology && "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
          )}
        >
          <Network className="w-4 h-4" />
          {showTopology ? '隐藏拓扑' : '全网拓扑'}
        </button>
      </div>

      {showTopology && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-2 mb-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5 relative z-10"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-indigo-200 flex items-center gap-2">
                <Network className="w-4 h-4" /> 前端拓扑视图
              </h3>
              <p className="text-[11px] text-neutral-500 mt-1">当前后端没有独立拓扑接口；这里基于已加载 Agent 配置展示启用关系。</p>
            </div>
            <span className="text-[10px] font-mono text-neutral-500">
              启用 {experts.filter(expert => expert.enabled).length} / {experts.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl border border-white/5 bg-black/30 p-3 text-neutral-400">
              <span className="block text-[10px] font-mono text-neutral-500 mb-1">入口</span>
              Workbench / Chat Orchestrator
            </div>
            <div className="rounded-xl border border-white/5 bg-black/30 p-3 text-neutral-400">
              <span className="block text-[10px] font-mono text-neutral-500 mb-1">编排</span>
              Enabled Agent Pool
            </div>
            <div className="rounded-xl border border-white/5 bg-black/30 p-3 text-neutral-400">
              <span className="block text-[10px] font-mono text-neutral-500 mb-1">输出</span>
              Evidence / Report / Chat Result
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {experts.map(expert => (
              <span
                key={expert.id}
                className={cn(
                  "rounded-full border px-3 py-1 text-[10px] font-mono",
                  expert.enabled
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                    : "border-neutral-700 bg-black/30 text-neutral-500"
                )}
              >
                {expert.name}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 overflow-y-auto px-2 pb-8 relative z-10 custom-scrollbar">
        {experts.map((expert, index) => (
          <motion.div 
            key={expert.id} 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
            className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl hover:border-indigo-500/30 hover:bg-white/[0.04] hover:-translate-y-1 transition-all duration-300 group flex flex-col relative overflow-hidden"
          >
             {expert.enabled && (
               <motion.div 
                 animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                 transition={{ repeat: Infinity, duration: 2 }}
                 className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 blur-[40px] rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none"
               ></motion.div>
             )}
             
             <div className="flex items-start justify-between mb-5 relative z-10">
               <div className="flex items-center gap-4">
                 <div className={cn(
                   "w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner transition-colors",
                   expert.enabled ? 'bg-gradient-to-tr from-indigo-600/20 to-indigo-400/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-black/40 border-white/5 text-neutral-500 group-hover:text-neutral-400'
                 )}>
                   <expert.icon className="w-6 h-6" />
                 </div>
                 <div>
                   <h3 className="font-semibold text-neutral-100 text-base mb-0.5 tracking-wide">{expert.name}</h3>
                   <p className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">{expert.role}</p>
                 </div>
               </div>
               
               <div className={cn(
                 "px-2.5 py-1 rounded text-[10px] font-mono border flex items-center gap-2",
                 expert.enabled ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300' : 'bg-black/20 border-white/5 text-neutral-500'
               )}>
                 <span className={cn(
                   "w-1.5 h-1.5 rounded-full",
                   expert.enabled ? 'bg-indigo-400 animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_8px_rgba(129,140,248,0.8)]' : 'bg-neutral-600'
                 )}></span>
                 {expert.enabled ? '已启用' : '已停用'}
               </div>
             </div>

             <div className="flex-1 relative z-10">
               <p className="text-sm text-neutral-400 leading-relaxed group-hover:text-neutral-300 transition-colors">
                 {expert.description}
               </p>
             </div>

             <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between relative z-10">
               <div className="flex flex-col gap-1 max-w-[65%]">
                 <span className="text-[10px] text-neutral-500 font-mono tracking-wide">当前任务</span>
                 <motion.span 
                   key={expert.task}
                   initial={{ opacity: 0, y: 5 }}
                   animate={{ opacity: 1, y: 0 }}
                   className={cn("text-xs truncate font-medium", expert.enabled ? 'text-indigo-300' : 'text-neutral-400')}
                   title={expert.task}
                 >
                   {expert.task}
                 </motion.span>
               </div>
               <button
                 onClick={() => handleToggleExpert(expert)}
                 disabled={savingAgentId === expert.id}
                 title={expert.persisted ? (expert.enabled ? '停用并写入后端' : '启用并写入后端') : '演示 Agent 不能写入后端'}
                 className={cn(
                   "flex items-center justify-center w-10 h-10 rounded-xl border transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed",
                   expert.enabled
                     ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]"
                     : "bg-black/40 border-white/10 text-neutral-400 hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/10"
                 )}
               >
                 {expert.enabled ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
               </button>
             </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
