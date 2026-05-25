import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings2, 
  Key, 
  Bell, 
  Shield, 
  Server, 
  Database,
  User,
  Zap,
  Globe,
  Monitor
} from 'lucide-react';
import { cn } from '../lib/utils';

const SETTING_TABS = [
  { id: 'general', label: '基础设置', icon: Settings2 },
  { id: 'api', label: 'API 密钥', icon: Key },
  { id: 'network', label: '网络节点', icon: Globe },
  { id: 'security', label: '安全组', icon: Shield },
  { id: 'data', label: '数据管理', icon: Database },
];

export function Settings() {
  const [activeTab, setActiveTab] = useState('api');

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex p-6 lg:p-8 max-w-[1200px] mx-auto text-neutral-300 gap-8"
    >
      {/* Sidebar for settings */}
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
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative group font-medium text-sm",
                  isActive 
                    ? "text-indigo-400" 
                    : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]"
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="settings-active"
                    className="absolute inset-0 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.05)]"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className="w-5 h-5 relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Settings Content */}
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
                className="max-w-2xl"
              >
                <div className="mb-8">
                  <h3 className="text-xl font-medium text-neutral-100 flex items-center gap-2 mb-2">
                    <Key className="w-5 h-5 text-indigo-400" />
                    API 密钥管理
                  </h3>
                  <p className="text-sm text-neutral-400">配置分析引擎及外部数据供应商所需的环境变量与受保护配置。</p>
                </div>

                <div className="space-y-6">
                  {/* Item */}
                  <div className="space-y-3 p-5 rounded-2xl bg-black/20 border border-white/5">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-sm font-medium text-neutral-200">Wind/Choice 数据接口令牌</label>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">CONNECTED</span>
                    </div>
                    <div className="relative flex items-center">
                      <input 
                        type="password" 
                        placeholder="已保存密钥，前端不显示明文"
                        readOnly
                        className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-4 pr-24 py-2.5 text-sm text-neutral-400 font-mono shadow-inner outline-none"
                      />
                      <button className="absolute right-2 px-3 py-1 bg-white/5 hover:bg-white/10 rounded-md text-xs font-mono text-neutral-300 transition-colors border border-white/5">Modify</button>
                    </div>
                    <p className="text-xs text-neutral-500">此密钥将拥有读取二级市场实时行情和核心财务数据的权限，请妥善保管。</p>
                  </div>

                  {/* Item */}
                  <div className="space-y-3 p-5 rounded-2xl bg-black/20 border border-white/5">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-sm font-medium text-neutral-200">OpenAI / Gemini 推理端点</label>
                      <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">REQUIRED</span>
                    </div>
                    <div className="relative flex items-center">
                      <input 
                        type="password" 
                        placeholder="sk-..."
                        className="w-full bg-white/[0.03] border border-indigo-500/30 rounded-lg pl-4 pr-12 py-2.5 text-sm text-white font-mono shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] focus:border-indigo-500 focus:bg-white/[0.05] focus:outline-none transition-all placeholder:text-neutral-700"
                      />
                      <Monitor className="absolute right-4 w-4 h-4 text-neutral-500" />
                    </div>
                    <p className="text-xs text-neutral-500">专用于提供宏观研报分析和情感计算的主力模型路由。</p>
                  </div>
                  
                  {/* Actions */}
                  <div className="pt-4 flex justify-end gap-3">
                    <button className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl text-sm font-medium transition-colors border border-white/5 shadow-sm">
                      重置所有连接
                    </button>
                    <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] border border-indigo-500">
                      保存更改
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
                <h3 className="text-lg font-medium text-neutral-200 mb-2">配置项未开放</h3>
                <p className="text-sm text-neutral-400">
                  当前环境为沙盒预览版本。{SETTING_TABS.find(t => t.id === activeTab)?.label}面板需升级至企业节点方可完全接入并管理底层持久化配置。
                </p>
                <button className="mt-8 px-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-lg text-sm text-neutral-300 font-mono transition-all">
                  UPGRADE_REQUIRED
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
