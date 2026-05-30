import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Table, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { AnalysisResult } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  result: AnalysisResult;
}

export const FieldSourceTable: React.FC<Props> = ({ result }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Define the core fields we want to track
  const CORE_FIELDS = [
    { key: 'price', label: '最新价' },
    { key: 'turnover_rate', label: '换手率' },
    { key: 'amplitude', label: '振幅' },
    { key: 'pe_ttm', label: '市盈率(TTM)' },
    { key: 'pb', label: '市净率' },
    { key: 'total_mv', label: '总市值' },
    { key: 'circ_mv', label: '流通市值' },
    { key: 'limit_up', label: '涨停价' },
    { key: 'limit_down', label: '跌停价' }
  ];

  // Derive field sources
  const quoteTrace = result.provider_traces.find(t => t.data_type === 'quote');
  const mainProvider = quoteTrace?.selected_provider || '未知';
  const fillMap = quoteTrace?.field_fill_map || {};
  
  // Try to find the price evidence for raw values
  const priceEvidence = result.evidence.find(e => e.type === 'price' || e.evidence_type === 'price');
  const rawValues = priceEvidence?.raw_value || {};

  // Check if we have any data to show
  if (!quoteTrace && !priceEvidence) return null;

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5 backdrop-blur-md">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2 text-white/80">
          <Table className="w-4 h-4" />
          <span className="font-medium text-sm">核心指标字段溯源 (Field Sources)</span>
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
                      <th className="py-2 px-3 font-medium">字段 (Field)</th>
                      <th className="py-2 px-3 font-medium">当前值 (Value)</th>
                      <th className="py-2 px-3 font-medium">实际数据源 (Provider)</th>
                      <th className="py-2 px-3 font-medium">状态 (Status)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {CORE_FIELDS.map((field) => {
                      const value = rawValues[field.key];
                      const isMissing = value === undefined || value === null || value === '';
                      const isFilled = field.key in fillMap;
                      const provider = isFilled ? fillMap[field.key] : mainProvider;
                      
                      return (
                        <tr key={field.key} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex flex-col">
                              <span className="text-white/90">{field.label}</span>
                              <span className="text-[10px] font-mono text-white/40">{field.key}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-indigo-300">
                            {isMissing ? '--' : value}
                          </td>
                          <td className="py-3 px-3 text-white/70">
                            {isMissing ? '--' : provider}
                          </td>
                          <td className="py-3 px-3">
                            {isMissing ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
                                <AlertTriangle className="w-3 h-3" />
                                缺失
                              </span>
                            ) : isFilled ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                <AlertCircle className="w-3 h-3" />
                                备用源补全
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                主源
                              </span>
                            )}
                          </td>
                        </tr>
                      );
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
