import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertCircle, Server } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ProviderTrace } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  traces: ProviderTrace[];
}

export const SourceTracePanel: React.FC<Props> = ({ traces }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (!traces || traces.length === 0) return null;

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5 backdrop-blur-md">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2 text-white/80">
          <Server className="w-4 h-4" />
          <span className="font-medium text-sm">数据源追踪 (Provider Traces)</span>
        </div>
        {isExpanded ? <ChevronDown className="w-4 h-4 text-white/50" /> : <ChevronRight className="w-4 h-4 text-white/50" />}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-white/50 text-xs border-b border-white/10">
                    <tr>
                      <th className="py-2 px-3 font-medium">数据域</th>
                      <th className="py-2 px-3 font-medium">使用的 Provider</th>
                      <th className="py-2 px-3 font-medium">数据量</th>
                      <th className="py-2 px-3 font-medium">状态</th>
                      <th className="py-2 px-3 font-medium w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {traces.map((trace) => {
                      const isRowExpanded = expandedRow === trace.data_type;
                      return (
                        <React.Fragment key={trace.data_type}>
                          <tr 
                            className="hover:bg-white/5 cursor-pointer transition-colors"
                            onClick={() => setExpandedRow(isRowExpanded ? null : trace.data_type)}
                          >
                            <td className="py-3 px-3 font-mono text-xs text-white/90">{trace.data_type}</td>
                            <td className="py-3 px-3 text-white/80">{trace.selected_provider || '-'}</td>
                            <td className="py-3 px-3 text-white/70">{trace.items_count}</td>
                            <td className="py-3 px-3">
                              {trace.degraded ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <AlertCircle className="w-3 h-3" />
                                  降级 / 补全
                                </span>
                              ) : trace.errors.length > 0 ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                  <XCircle className="w-3 h-3" />
                                  失败
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  正常
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {isRowExpanded ? <ChevronDown className="w-4 h-4 inline-block text-white/50" /> : <ChevronRight className="w-4 h-4 inline-block text-white/50" />}
                            </td>
                          </tr>
                          {isRowExpanded && (
                            <tr>
                              <td colSpan={5} className="bg-black/20 p-4 border-l-2 border-indigo-500/50">
                                <div className="space-y-4">
                                  
                                  {/* Fallback Timeline */}
                                  <div>
                                    <h4 className="text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">调用链路与回退 (Fallback Timeline)</h4>
                                    <div className="relative border-l border-white/10 ml-2 pl-4 py-1 space-y-3">
                                      {trace.fallback_attempts.map((attempt, idx) => (
                                        <div key={idx} className="relative">
                                          <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-red-500 ring-4 ring-[#050505]" />
                                          <div className="text-sm">
                                            <span className="text-white/80 font-medium">{attempt.provider}</span>
                                            <span className="text-red-400 ml-2 text-xs">✗ 失败</span>
                                          </div>
                                          <div className="text-xs text-white/50 mt-0.5">
                                            {attempt.error} (耗时: {attempt.latency_ms}ms)
                                          </div>
                                        </div>
                                      ))}
                                      
                                      <div className="relative">
                                        <div className={cn(
                                          "absolute -left-[21px] top-1.5 w-2 h-2 rounded-full ring-4 ring-[#050505]",
                                          trace.selected_provider ? "bg-emerald-500" : "bg-red-500"
                                        )} />
                                        <div className="text-sm">
                                          <span className="text-white/80 font-medium">{trace.selected_provider || '所有可用数据源失败'}</span>
                                          {trace.selected_provider && <span className="text-emerald-400 ml-2 text-xs">✓ 成功提取 {trace.items_count} 条数据</span>}
                                        </div>
                                        {trace.source_chain.length > 1 && (
                                          <div className="text-xs text-white/50 mt-0.5">
                                            聚合链路: {trace.source_chain.join(' → ')}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Field Fill Map */}
                                  {Object.keys(trace.field_fill_map || {}).length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">字段级降级补全 (Field Fill)</h4>
                                      <div className="flex flex-wrap gap-2">
                                        {Object.entries(trace.field_fill_map).map(([field, prov]) => (
                                          <span key={field} className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded text-xs text-white/70 border border-white/10">
                                            <span className="font-mono text-indigo-400">{field}</span> 
                                            <span>←</span>
                                            <span>{prov as string}</span>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Trace ID */}
                                  {trace.provider_trace_id && (
                                    <div className="flex items-center gap-2 text-xs text-white/30 font-mono mt-2 pt-2 border-t border-white/5">
                                      <span>Trace ID:</span>
                                      <span>{trace.provider_trace_id}</span>
                                    </div>
                                  )}

                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
