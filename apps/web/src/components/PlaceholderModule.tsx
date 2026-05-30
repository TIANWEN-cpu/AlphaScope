import React from 'react';
import { motion } from 'motion/react';
import { Activity, ArrowLeft, CheckCircle2, Cpu } from 'lucide-react';

export const PlaceholderModule: React.FC<{ tab: string }> = ({ tab }) => {
  const label = tab === 'workbench' ? '对话式研究' : tab;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="h-full w-full flex items-center justify-center p-6 relative overflow-hidden"
    >
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute left-10 top-10 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"></div>
        <div className="absolute right-10 bottom-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center bg-white/[0.02] backdrop-blur-xl border border-white/5 p-12 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-w-lg w-full text-center">
        <div className="relative w-20 h-20 flex items-center justify-center mb-6">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
            className="absolute inset-0 border-[1.5px] border-dashed border-indigo-500/40 rounded-full"
          />
          <motion.div 
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="absolute inset-2 bg-gradient-to-tr from-indigo-500/20 to-indigo-400/5 border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.2)] rounded-full flex items-center justify-center"
          >
            <Cpu className="w-8 h-8 text-indigo-400" />
          </motion.div>
        </div>

        <h2 className="text-3xl font-display font-medium text-white mb-2 tracking-tight">
          {label}
        </h2>
        <h3 className="text-[11px] uppercase font-mono tracking-[0.2em] text-indigo-400 mb-6 flex items-center gap-2 justify-center">
          <Activity className="w-3.5 h-3.5" />
          模块正在接入
        </h3>

        <p className="text-sm text-neutral-400 leading-relaxed max-w-md mx-auto mb-8">
          该入口已纳入产品路线，但当前副本前端还没有独立页面。你可以先从左侧进入“对话式研究”“K线/多模态解析”或“研究报告生成”继续工作。
        </p>

        <div className="grid grid-cols-2 gap-4 w-full font-mono text-[10px]">
          <div className="flex flex-col gap-1 p-4 bg-black/20 rounded-xl border border-white/5 text-left transition-colors hover:bg-black/40">
            <span className="text-neutral-500">页面状态</span>
            <span className="text-emerald-400 flex items-center gap-1.5 font-medium text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              已识别
            </span>
          </div>
          <div className="flex flex-col gap-1 p-4 bg-black/20 rounded-xl border border-white/5 text-left transition-colors hover:bg-black/40">
            <span className="text-neutral-500">建议动作</span>
            <span className="text-amber-500 flex items-center gap-1.5 font-medium text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />
              使用左侧导航
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
