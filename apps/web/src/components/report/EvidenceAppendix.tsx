import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileSearch, ExternalLink, Hash, Clock, FileJson } from 'lucide-react';
import { AnalysisResult, ProviderEvidence } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  result: AnalysisResult;
}

export const EvidenceAppendix: React.FC<Props> = ({ result }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!result.evidence || result.evidence.length === 0) return null;

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5 backdrop-blur-md">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2 text-white/80">
          <FileSearch className="w-4 h-4" />
          <span className="font-medium text-sm">证据附录 (Evidence Appendix)</span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-white/60">
            {result.evidence.length}
          </span>
        </div>
        {isExpanded ? <ChevronDown className="w-4 h-4 text-white/50" /> : <ChevronRight className="w-4 h-4 text-white/50" />}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="p-4 space-y-3">
              {result.evidence.map((evidence: ProviderEvidence) => {
                const isRowExpanded = !!expandedRows[evidence.id];
                
                return (
                  <div key={evidence.id} className="border border-white/5 rounded-lg bg-black/20 overflow-hidden">
                    {/* Header Row */}
                    <button 
                      onClick={() => toggleRow(evidence.id)}
                      className="w-full p-3 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-white/5 transition-colors gap-2 text-left"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="shrink-0 px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[10px] font-mono border border-indigo-500/30">
                          #{evidence.ref_id}
                        </span>
                        <h4 className="text-sm text-white/90 truncate font-medium">{evidence.title}</h4>
                      </div>
                      
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="flex items-center gap-3 text-xs text-white/50">
                          <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> {evidence.source}</span>
                          <span className="flex items-center gap-1">置信度: {(evidence.confidence * 100).toFixed(0)}%</span>
                        </div>
                        {isRowExpanded ? <ChevronDown className="w-4 h-4 text-white/50" /> : <ChevronRight className="w-4 h-4 text-white/50" />}
                      </div>
                    </button>

                    {/* Expanded Content */}
                    <AnimatePresence>
                      {isRowExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 pt-0 border-t border-white/5 bg-black/40 text-xs text-white/70 space-y-4 mt-2">
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                              <div>
                                <span className="block text-[10px] uppercase text-white/40 mb-1">主张结论 (Claim)</span>
                                <div className="text-white/80">{evidence.claim}</div>
                              </div>
                              <div>
                                <span className="block text-[10px] uppercase text-white/40 mb-1">推导方式 (Derivation)</span>
                                <div className="text-white/80">{evidence.derivation || '直接提取'}</div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-4 pt-2 border-t border-white/5">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-white/40" />
                                <span>抓取时间: {evidence.retrieved_at ? new Date(evidence.retrieved_at).toLocaleString() : 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <FileJson className="w-3.5 h-3.5 text-white/40" />
                                <span>API Call: <code className="text-[10px] bg-white/10 px-1 rounded">{evidence.source_call}</code></span>
                              </div>
                              {evidence.provider_trace_id && (
                                <div className="flex items-center gap-1.5">
                                  <Hash className="w-3.5 h-3.5 text-white/40" />
                                  <span>Trace ID: <code className="text-[10px] bg-white/10 px-1 rounded">{evidence.provider_trace_id}</code></span>
                                </div>
                              )}
                            </div>

                            {/* Raw Value */}
                            <div className="pt-2">
                              <span className="block text-[10px] uppercase text-white/40 mb-2">原始值 (Raw Value JSON)</span>
                              <pre className="bg-black/60 border border-white/5 rounded-md p-3 text-[10px] font-mono text-emerald-300/80 overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(evidence.raw_value, null, 2)}
                              </pre>
                            </div>
                            
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
