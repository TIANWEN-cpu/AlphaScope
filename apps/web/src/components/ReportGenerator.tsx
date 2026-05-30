import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Sparkles, 
  Award, 
  FileCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { startAsyncAnalysis, getTaskResult, getTaskEventsUrl } from '../lib/analysisAdapter';
import { AnalysisResult } from '../types';
import { DecisionSummary } from './report/DecisionSummary';
import { AgentOpinionCards } from './report/AgentOpinionCards';
import { SourceTracePanel } from './report/SourceTracePanel';
import { FieldSourceTable } from './report/FieldSourceTable';
import { EvidenceAppendix } from './report/EvidenceAppendix';
import { mockAnalysisResult } from '../lib/mockAnalysisData';
import { STOCK_UNIVERSE, findStockTarget, formatStockLabel } from '../lib/stocks';
import { dispatchStockSelected, getPersistedStock, subscribeStockSelected } from '../lib/workspaceEvents';

const REPORT_TEMPLATES = [
  { id: 'standard', name: '标准个股深度评级公司研报', desc: '包含宏观定位，深度报表分析以及三因素量化诊股。' },
  { id: 'macro', name: '行业及产业链专题跟踪报告', desc: '梳理上下游资本开支变化与库存周期的另类情报归纳。' },
  { id: 'risk', name: '黑天鹅情绪避险与信用预警评估', desc: '侧重于舆情违约风险、大股东股权质押及账外担保预警。' }
];

export function ReportGenerator() {
  const [selectedTarget, setSelectedTarget] = useState(() => getPersistedStock() ?? STOCK_UNIVERSE[0]);
  const selectedStock = formatStockLabel(selectedTarget);
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);

  // Steps matching the general analysis pipeline
  const steps = [
    { label: '获取行情与概况', desc: '正在连接主数据源拉取实时行情快照...' },
    { label: '拉取资金与宏观数据', desc: '正在调取主力资金动向与板块轮动信息...' },
    { label: '风险与舆情过滤', desc: '正在扫描合规风险、违规处罚与负面舆情事件...' },
    { label: '领域专家圆桌会诊', desc: '基本面、量化、宏观Agent正在进行交叉研判...' },
    { label: '智能排版与生成', desc: '正在聚合证据链，排版最终投资建议报告...' }
  ];

  // Cleanup SSE on unmount
  useEffect(() => {
    const unsubscribe = subscribeStockSelected(({ stock }) => {
      setSelectedTarget(findStockTarget(stock.symbol) ?? stock);
    });

    return () => {
      unsubscribe();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const startGeneration = async () => {
    setIsGenerating(true);
    setGenerationStep(0);
    setProgressPercent(0);
    setAnalysisResult(null);

    const symbol = selectedTarget.symbol;
    const name = selectedTarget.name;
    const forceMock = import.meta.env.VITE_USE_MOCK_REPORT === 'true';

    try {
      if (forceMock) {
        // Fallback mock flow
        let mockStep = 0;
        const interval = setInterval(() => {
          mockStep++;
          if (mockStep >= steps.length) {
            clearInterval(interval);
            setGenerationStep(steps.length);
            setProgressPercent(100);
            setAnalysisResult(mockAnalysisResult);
            setIsGenerating(false);
          } else {
            setGenerationStep(mockStep);
            setProgressPercent(mockStep * 20);
          }
        }, 800);
        return;
      }

      // Real API Flow with SSE
      const taskId = await startAsyncAnalysis(symbol, name, 'deep', false);
      const sseUrl = getTaskEventsUrl();
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = async (e) => {
        if (e.data.trim() === ': heartbeat') return;
        try {
          const data = JSON.parse(e.data);
          if (data.task_id === taskId) {
            
            if (data.type === 'task_progress') {
              const p = Number(data.progress) || 0;
              setProgressPercent(p);
              const stepIndex = Math.min(steps.length - 1, Math.floor((p / 100) * steps.length));
              setGenerationStep(stepIndex);
            } 
            
            else if (data.type === 'task_completed') {
              eventSource.close();
              eventSourceRef.current = null;
              setGenerationStep(steps.length);
              setProgressPercent(100);
              
              // Fetch final result
              const result = await getTaskResult(taskId, false);
              setAnalysisResult(result);
              setIsGenerating(false);
            }
            
            else if (data.type === 'task_failed' || data.type === 'task_cancelled') {
              console.error('Task failed or cancelled', data);
              eventSource.close();
              eventSourceRef.current = null;
              setIsGenerating(false);
            }
          }
        } catch (err) {
          console.warn('Failed to parse task event payload', err, e.data);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE Error', err);
        eventSource.close();
        eventSourceRef.current = null;
        setIsGenerating(false);
      };

    } catch (error) {
      console.error(error);
      setIsGenerating(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="p-6 lg:p-8 max-w-[1600px] mx-auto text-neutral-300 flex flex-col h-full overflow-hidden"
    >
      
      {/* Title */}
      <div className="mb-6 flex-shrink-0">
        <h2 className="text-2xl font-display font-medium text-white flex items-center gap-3">
          <FileText className="w-6 h-6 text-indigo-400" />
          可核验证据链报告
        </h2>
        <p className="text-xs text-neutral-500 mt-1.5 font-mono">
          依托多源数据引擎和AI多Agent网络进行数据集成排版，协助分析师一键生成深度专业的信息披露与估值测绘草案。
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0 overflow-hidden">
        
        {/* Left configurations Column */}
        <div className="flex flex-col gap-6 min-h-0 bg-white/[0.01] border border-white/5 rounded-2xl p-5">
          <span className="text-xs font-mono uppercase tracking-widest text-[#6366f1] font-bold block mb-1">投研参数定制</span>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-400 select-none">研究对象 (Target Stock)</label>
            <select 
              value={selectedStock}
              onChange={e => {
                const stock = [selectedTarget, ...STOCK_UNIVERSE].find((item) => formatStockLabel(item) === e.target.value);
                if (stock) {
                  setSelectedTarget(stock);
                  dispatchStockSelected(stock, 'report');
                }
              }}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500/50"
            >
              {[selectedTarget, ...STOCK_UNIVERSE].filter((stock, index, list) => list.findIndex((item) => item.symbol === stock.symbol) === index).map((stock) => (
                <option key={stock.symbol} value={formatStockLabel(stock)}>
                  {formatStockLabel(stock)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2.5">
            <label className="text-xs font-medium text-neutral-400 select-none">研报大纲范式 (Framework Templates)</label>
            <div className="space-y-2">
              {REPORT_TEMPLATES.map(tmp => (
                <button
                  key={tmp.id}
                  onClick={() => setSelectedTemplate(tmp.id)}
                  className={cn(
                    "w-full p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1",
                    selectedTemplate === tmp.id 
                      ? "bg-indigo-500/10 border-indigo-500/40 shadow-sm"
                      : "bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/40"
                  )}
                >
                  <span className={cn(
                    "text-xs font-semibold",
                    selectedTemplate === tmp.id ? "text-indigo-300" : "text-neutral-300"
                  )}>{tmp.name}</span>
                  <span className="text-[10px] text-neutral-500 leading-normal">{tmp.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-4">
            <button
              onClick={startGeneration}
              disabled={isGenerating}
              className={cn(
                "w-full py-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md tracking-wide grow-0 text-center",
                isGenerating 
                  ? "bg-indigo-950/40 border border-indigo-500/20 text-indigo-400 cursor-not-allowed" 
                  : "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500"
              )}
            >
              <Sparkles className="w-4 h-4 text-indigo-200 animate-pulse" />
              {isGenerating ? 'AI 正在生成报告...' : '启动智能整合排版'}
            </button>
          </div>
        </div>

        {/* Right Preview Panel - Takes 2 Columns */}
        <div className="lg:col-span-2 flex flex-col min-h-0 bg-white/[0.01] border border-white/5 rounded-2xl overflow-hidden relative">
          
          <AnimatePresence mode="wait">
            
            {/* Loading/Generation Status State in layout */}
            {isGenerating && (
              <motion.div
                key="generating"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-10 bg-black/60 backdrop-blur-sm z-30 font-sans"
              >
                <div className="relative w-20 h-20 flex items-center justify-center mb-8">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    className="absolute inset-0 border-2 border-dashed border-indigo-500/30 border-t-indigo-500 rounded-full"
                  />
                  <div className="absolute inset-2 bg-indigo-500/10 rounded-full flex items-center justify-center">
                    <FileText className="w-8 h-8 text-indigo-400 animate-bounce" />
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-white mb-2">智能分析与排版中 ({Math.round(progressPercent)}%)</h3>
                <div className="w-64 h-1 bg-white/10 rounded-full mb-8 overflow-hidden">
                  <motion.div 
                    className="h-full bg-indigo-500" 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ ease: "linear" }}
                  />
                </div>

                <div className="w-full max-w-md space-y-4 font-mono text-[11px]">
                  {steps.map((st, index) => {
                    const isDone = generationStep > index;
                    const isActive = generationStep === index;
                    return (
                      <div 
                        key={index} 
                        className={cn(
                          "flex gap-3 p-3 rounded-lg border text-left transition-all",
                          isActive ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" :
                          isDone ? "bg-black/30 border-emerald-500/20 text-emerald-400" :
                          "bg-black/10 border-white/5 text-neutral-600"
                        )}
                      >
                        <div className="h-5 w-5 rounded-full border border-current flex items-center justify-center shrink-0 text-xs font-bold font-mono">
                          {isDone ? '✓' : index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold flex items-center gap-1.5 leading-tight">
                            {st.label}
                            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>}
                          </h4>
                          <p className="text-[10px] text-neutral-500 leading-normal mt-0.5">{st.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Generated Report State */}
            {analysisResult && !isGenerating ? (
              <motion.div
                key="generated"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex-1 flex flex-col min-h-0 bg-[#0c0c0c] overflow-y-auto custom-scrollbar p-6 lg:p-8"
              >
                <div className="max-w-3xl mx-auto w-full">
                  
                  {/* P0: Decision Summary */}
                  <DecisionSummary 
                    stockSymbol={selectedTarget.symbol}
                    stockName={selectedTarget.name}
                    result={analysisResult} 
                  />

                  {/* P0: Agent Opinions */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-white/80 mb-4 uppercase tracking-wider flex items-center gap-2">
                      <Award className="w-4 h-4 text-indigo-400" />
                      专家圆桌观点
                    </h3>
                    <AgentOpinionCards agents={analysisResult.agents} />
                  </div>

                  {/* P1: Field Source Table */}
                  <div className="mb-6">
                    <FieldSourceTable result={analysisResult} />
                  </div>

                  {/* P0: Source Trace Panel */}
                  <div className="mb-6">
                    <SourceTracePanel traces={analysisResult.provider_traces} />
                  </div>

                  {/* P1: Evidence Appendix */}
                  <div className="mb-6">
                    <EvidenceAppendix result={analysisResult} />
                  </div>

                  {/* Summary Text */}
                  {analysisResult.summary && (
                    <div className="mt-8 pt-8 border-t border-white/5">
                      <h3 className="text-sm font-semibold text-white/80 mb-4 uppercase tracking-wider">分析摘要 (Summary)</h3>
                      <p className="text-sm text-neutral-300 leading-relaxed bg-white/5 p-5 rounded-xl border border-white/5">
                        {analysisResult.summary}
                      </p>
                    </div>
                  )}

                </div>
              </motion.div>
            ) : !isGenerating ? (
              // Idle state
              <motion.div
                key="idle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex-1 flex flex-col justify-center items-center text-center p-12 text-neutral-500 font-sans gap-3.5 z-20"
              >
                <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center animate-pulse shadow-md">
                  <FileCheck className="w-8 h-8 text-neutral-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-300">本投研报告书处于未配置草稿状态</h3>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    请在左侧配置面板中指定您欲展开多因子分析与公司基本面测绘的股票，然后点击“启动智能整合排版”。AI Agent 助理网络将全面对标的资产进行结构化信源编纂，提供可出版级的专业投资评估。
                  </p>
                </div>
              </motion.div>
            ) : null}

          </AnimatePresence>
        </div>

      </div>

    </motion.div>
  );
}
