import React, { useState } from 'react';
import { Settings, CircleUserRound, ShieldCheck, TrendingUp, BarChart3, Database, Globe, Network, Activity, Play, Square } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { AgentModule } from '../types';

interface Expert {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'analyzing' | 'error';
  task: string;
  description: string;
  icon: React.ElementType;
}

const EXPERTS: Expert[] = [
  { id: '1', name: '宏观趋势分析师', role: 'Macro Trend', status: 'idle', task: '暂无任务', description: '整合多源新闻与宏观经济数据，提供全球经济周期与市场大势预判。', icon: Globe },
  { id: '2', name: '基本面分析助手', role: 'Fundamental', status: 'analyzing', task: '分析茅台 Q3 财报', description: '深度剖析公司财务报表、盈利能力、成长性及行业竞争格局。', icon: BarChart3 },
  { id: '3', name: '量化策略专家', role: 'Quant Strategy', status: 'analyzing', task: '多因子寻优计算', description: '基于海量市场数据，发掘统计套利机会，构建并回测多因子选股模型。', icon: TrendingUp },
  { id: '4', name: '风险合规顾问', role: 'Risk & Compliance', status: 'idle', task: '暂无任务', description: '实时监控持仓风险敞口，评估最大回撤并确保交易符合风控阈值。', icon: ShieldCheck },
  { id: '5', name: '数据情报收集员', role: 'Data Scraper', status: 'idle', task: '暂无任务', description: '结构化与非结构化数据聚合，从券商研报、公告中提取关键实体。', icon: Database },
  { id: '6', name: '交易执行引擎', role: 'Execution', status: 'idle', task: '等待指令', description: '根据策略信号生成最优订单路由，降低滑点并监控执行链路。', icon: Activity },
];

export function AgentsSystem() {
  const [experts, setExperts] = useState<Expert[]>(EXPERTS);

  const handleToggleExpert = (id: string) => {
    setExperts(prev => prev.map(e => {
      if (e.id === id) {
        const isAnalyzing = e.status === 'analyzing';
        return {
          ...e,
          status: isAnalyzing ? 'idle' : 'analyzing',
          task: isAnalyzing ? '暂无任务' : '执行模拟诊断指令...'
        };
      }
      return e;
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
      <div className="flex items-end justify-between mb-8 px-2 relative z-10">
        <div>
          <h2 className="text-3xl font-display font-medium tracking-tight text-white mb-2 flex items-center gap-3">
            专家圆桌 <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono tracking-wider align-middle ml-2">EXPERT ROUNDTABLE</span>
          </h2>
          <p className="text-sm text-neutral-400 font-mono">协调多个专属领域的 AI Agent 网络进行深度分析与研判。</p>
        </div>
        <button className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.1)] hover:bg-indigo-500/20 transition-all flex items-center gap-2 font-medium tracking-wide">
          <Network className="w-4 h-4" />
          全网拓扑
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 overflow-y-auto px-2 pb-8 relative z-10 custom-scrollbar">
        {experts.map((expert, index) => (
          <motion.div 
            key={expert.id} 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
            className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-xl hover:border-indigo-500/30 hover:bg-white/[0.04] hover:-translate-y-1 transition-all duration-300 group flex flex-col relative overflow-hidden"
          >
             {expert.status === 'analyzing' && (
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
                   expert.status === 'analyzing' ? 'bg-gradient-to-tr from-indigo-600/20 to-indigo-400/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-black/40 border-white/5 text-neutral-500 group-hover:text-neutral-400'
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
                 expert.status === 'analyzing' ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300' : 'bg-black/20 border-white/5 text-neutral-500'
               )}>
                 <span className={cn(
                   "w-1.5 h-1.5 rounded-full",
                   expert.status === 'analyzing' ? 'bg-indigo-400 animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_8px_rgba(129,140,248,0.8)]' : 'bg-neutral-600'
                 )}></span>
                 {expert.status === 'analyzing' ? '工作中' : '空闲'}
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
                   className={cn("text-xs truncate font-medium", expert.status === 'analyzing' ? 'text-indigo-300' : 'text-neutral-400')} 
                   title={expert.task}
                 >
                   {expert.task}
                 </motion.span>
               </div>
               <button 
                 onClick={() => handleToggleExpert(expert.id)}
                 className={cn(
                   "flex items-center justify-center w-10 h-10 rounded-xl border transition-all shadow-sm",
                   expert.status === 'analyzing' 
                     ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]" 
                     : "bg-black/40 border-white/10 text-neutral-400 hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/10"
                 )}
               >
                 {expert.status === 'analyzing' ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
               </button>
             </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
