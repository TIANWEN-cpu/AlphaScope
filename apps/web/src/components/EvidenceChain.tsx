import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bookmark, 
  HelpCircle, 
  Sparkles, 
  CheckCircle, 
  Cpu, 
  FileText, 
  TrendingUp, 
  FolderLock, 
  Plus, 
  ChevronRight, 
  MessageSquare, 
  Coins, 
  Newspaper, 
  Activity,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api, EvidenceRecord, normalizeDisplayError } from '../lib/api';

interface EvidenceNode {
  id: string;
  title: string;
  pillar: 'fundamental' | 'quant' | 'sentiment' | 'liquidity';
  weight: number; // 0 to 10
  source: string;
  time: string;
  content: string;
  verifiedBy: string;
  localOnly?: boolean;
}

interface EvidenceBundle {
  claim: string;
  evidence?: EvidenceRecord[];
  confidence?: number;
  source_count?: number;
  trust_score?: number;
  decay_factor?: number;
  contradictions?: Array<string | Record<string, unknown>>;
}

interface EvidenceChainResult {
  bundles: EvidenceBundle[];
  totalSources: number;
  averageConfidence: number;
  contradictionCount: number;
}

interface EvidenceChainProps {
  symbol?: string;
  stockName?: string;
}

const pillarFromEvidenceType = (type?: string): EvidenceNode['pillar'] => {
  const value = (type || '').toLowerCase();
  if (value.includes('price') || value.includes('quant')) return 'quant';
  if (value.includes('news') || value.includes('announcement')) return 'sentiment';
  if (value.includes('fund_flow') || value.includes('liquidity')) return 'liquidity';
  return 'fundamental';
};

const evidenceTypeFromPillar = (pillar: EvidenceNode['pillar']) => {
  if (pillar === 'quant') return 'price';
  if (pillar === 'sentiment') return 'news';
  if (pillar === 'liquidity') return 'fund_flow';
  return 'fundamental';
};

const formatPercent = (value?: number) => {
  const num = Number(value ?? 0);
  const normalized = Math.abs(num) <= 1 ? num * 100 : num;
  return `${Math.round(normalized)}%`;
};

const normalizeEvidenceChainResult = (data: Record<string, unknown>): EvidenceChainResult => {
  const rawBundles = Array.isArray(data.bundles) ? data.bundles : [];
  const bundles = rawBundles.map((bundle) => bundle as EvidenceBundle);
  const sourceTotal = bundles.reduce((sum, bundle) => {
    const explicitCount = Number(bundle.source_count);
    if (Number.isFinite(explicitCount) && explicitCount > 0) return sum + explicitCount;
    return sum + (Array.isArray(bundle.evidence) ? bundle.evidence.length : 0);
  }, 0);
  const confidenceTotal = bundles.reduce((sum, bundle) => sum + Number(bundle.confidence || 0), 0);
  const contradictionCount = bundles.reduce((sum, bundle) => (
    sum + (Array.isArray(bundle.contradictions) ? bundle.contradictions.length : 0)
  ), 0);

  return {
    bundles,
    totalSources: sourceTotal,
    averageConfidence: bundles.length ? confidenceTotal / bundles.length : 0,
    contradictionCount,
  };
};

const contradictionText = (item: string | Record<string, unknown>) => {
  if (typeof item === 'string') return item;
  return String(item.claim || item.summary || item.title || item.reason || JSON.stringify(item));
};

const mapEvidenceRecord = (item: EvidenceRecord): EvidenceNode => ({
  id: item.id,
  title: item.title,
  pillar: pillarFromEvidenceType(item.evidence_type),
  weight: Math.max(1, Math.round(Number(item.confidence || item.relevance || 0.7) * 10)),
  source: item.source || '证据库',
  time: String(item.data_date || item.created_at || new Date().toISOString()).replace('T', ' ').slice(0, 16),
  content: item.content_summary || item.claim || item.title,
  verifiedBy: item.evidence_type || '后端证据库',
});

const DEFAULT_NODES: EvidenceNode[] = [
  {
    id: '1',
    title: '毛利率高居 91.8% 上游绝对议价权',
    pillar: 'fundamental',
    weight: 9,
    source: '贵州茅台 2026-Q1 季度财报',
    time: '2026-05-22 17:30',
    content: '基本面分析师核对：最新销售净利润率达 51.2%历史同期高点位，主营现金返流比超 120%，确定为一级核心护城河论证。',
    verifiedBy: '基本面分析助手',
    localOnly: true
  },
  {
    id: '2',
    title: '直销与数字商城「i茅台」销售占比拔高至 44.1%',
    pillar: 'fundamental',
    weight: 8,
    source: '直销配额去化数据监测研报',
    time: '2026-05-23 10:15',
    content: '相比传统低利润率代理商层级，直销配额每吨多释放逾30%附加值。直营商城活跃付费买家超历史均值高限，利润增量因子触发。',
    verifiedBy: '基本面分析助手',
    localOnly: true
  },
  {
    id: '3',
    title: 'MA5 均线上穿 MA10 均线确立技术金叉',
    pillar: 'quant',
    weight: 7,
    source: '行情多周期量价归因指标',
    time: '2026-05-23 12:44',
    content: '自 1460 阶段重底盘起稳后，高频均线呈多头排列回归，MACD零轴下方底背离指标双针探底金叉抬升，符合量度超跌逆转判定。',
    verifiedBy: '量化策略专家',
    localOnly: true
  },
  {
    id: '4',
    title: '大基金三期 3440 亿落地促发科技及大容量股情绪底托盘',
    pillar: 'sentiment',
    weight: 8,
    source: '大基金三期落地事件另类舆情监测',
    time: '2026-05-23 14:30',
    content: '虽然并非直接入主食品饮料，但作为万亿级别国家资金底座催化，成功逆转了此前低迷不振的流动性挤压，风险溢价（RP）因风险偏好骤升而降低。',
    verifiedBy: '宏观趋势分析师',
    localOnly: true
  },
  {
    id: '5',
    title: '北向及中长周期配置型外资连续四个交易日单边净买入',
    pillar: 'liquidity',
    weight: 8,
    source: '交易所盘末及北上主板跨境透视',
    time: '2026-05-23 15:10',
    content: '北上主力配置方向中，上证蓝筹红利名录买进重仓茅台、招行居于前三，中单与超大单主力呈现同步多头的坚决吸筹，非中小散户游资出击。',
    verifiedBy: '数据情报收集员',
    localOnly: true
  }
];

export function EvidenceChain({ symbol = '600519', stockName = '贵州茅台' }: EvidenceChainProps) {
  const [evidenceNodes, setEvidenceNodes] = useState<EvidenceNode[]>([]);
  const [selectedStock, setSelectedStock] = useState(`${stockName} (${symbol})`);
  const [selectedNode, setSelectedNode] = useState<EvidenceNode | null>(null);
  const [statusText, setStatusText] = useState('证据链后端待同步');
  const [chainResult, setChainResult] = useState<EvidenceChainResult | null>(null);
  
  // Custom new node states
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPillar, setNewPillar] = useState<'fundamental' | 'quant' | 'sentiment' | 'liquidity'>('fundamental');
  const [newWeight, setNewWeight] = useState(7);
  const [newSource, setNewSource] = useState('财联社/Wind 精梳');
  const [newContent, setNewContent] = useState('');
  const targetSymbol = selectedStock.match(/\d{5,6}/)?.[0] || symbol;

  useEffect(() => {
    setSelectedStock(`${stockName} (${symbol})`);
  }, [symbol, stockName]);

  useEffect(() => {
    let cancelled = false;

    async function loadEvidence() {
      setStatusText(`正在同步 ${selectedStock} 后端证据库...`);
      const result = await api.evidenceList(targetSymbol, 80);
      if (cancelled) return;

      if (result.success && result.data?.evidence?.length) {
        const nodes = result.data.evidence.map(mapEvidenceRecord);
        setEvidenceNodes(nodes);
        setSelectedNode(nodes[0] || null);
        setStatusText(`已接入 ${nodes.length} 条持久化证据`);
      } else {
        setEvidenceNodes(DEFAULT_NODES);
        setSelectedNode(DEFAULT_NODES[0]);
        setChainResult(null);
        setStatusText(normalizeDisplayError(result.error, '后端暂无证据；当前显示本地预览样例，新增论据后会写入后端。'));
      }
    }

    loadEvidence();
    return () => {
      cancelled = true;
    };
  }, [targetSymbol, selectedStock]);

  const pillars = [
    { id: 'fundamental', label: '基本面支撑 (Fundamental)', icon: FileText, color: 'border-rose-500/30 text-rose-450 bg-rose-500/5' },
    { id: 'quant', label: '量化信号阀 (Quant Factor)', icon: Cpu, color: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5' },
    { id: 'sentiment', label: '舆情与合规 (Sentiment & Event)', icon: Newspaper, color: 'border-emerald-500/30 text-emerald-450 bg-emerald-500/5' },
    { id: 'liquidity', label: '主力资金流 (Liquidity Flow)', icon: Coins, color: 'border-amber-500/30 text-amber-400 bg-amber-500/5' }
  ];

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const response = await api.evidenceCreate({
      evidence_type: evidenceTypeFromPillar(newPillar),
      title: newTitle,
      source: newSource,
      claim: newTitle,
      content_summary: newContent,
      symbols: [targetSymbol],
      confidence: Number(newWeight) / 10,
      relevance: Number(newWeight) / 10,
      data_date: new Date().toISOString().slice(0, 10),
    });

    const newNode: EvidenceNode = response.success && response.data ? mapEvidenceRecord(response.data) : {
      id: Date.now().toString(),
      title: newTitle,
      pillar: newPillar,
      weight: Number(newWeight),
      source: newSource,
      time: new Date().toISOString().replace('T', ' ').substring(0, 16),
      content: newContent,
      verifiedBy: '人工审计分析师',
      localOnly: true
    };

    setEvidenceNodes(prev => [newNode, ...prev]);
    setSelectedNode(newNode);
    setStatusText(response.success ? '证据已写入后端证据库' : normalizeDisplayError(response.error, '后端写入失败，已在当前会话临时保留'));
    setNewTitle('');
    setNewContent('');
    setIsAdding(false);
  };

  const handleDeleteEvidence = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = evidenceNodes.find(item => item.id === id);
    if (node?.localOnly) {
      setEvidenceNodes(prev => prev.filter(item => item.id !== id));
      if (selectedNode?.id === id) {
        setSelectedNode(null);
      }
      setStatusText('本地样例论据已从当前视图移除');
      return;
    }
    const response = await api.evidenceDelete(id);
    if (response.success) {
      setEvidenceNodes(prev => prev.filter(item => item.id !== id));
      if (selectedNode?.id === id) {
        setSelectedNode(null);
      }
      setStatusText('证据已从后端删除');
    } else {
      setStatusText(normalizeDisplayError(response.error, '证据删除失败'));
    }
  };

  const handleBuildChain = async () => {
    if (!evidenceNodes.length) {
      setChainResult(null);
      setStatusText('暂无证据可构建，请先追加论据或显式载入本地样例。');
      return;
    }
    setStatusText('正在调用后端构建证据链...');
    const payload = evidenceNodes.map(node => ({
      id: node.id,
      title: node.title,
      evidence_type: evidenceTypeFromPillar(node.pillar),
      source: node.source,
      claim: node.title,
      content_summary: node.content,
      confidence: node.weight / 10,
      symbols: [targetSymbol],
    })) as EvidenceRecord[];
    const result = await api.evidenceChain(payload);
    if (result.success && result.data) {
      setChainResult(normalizeEvidenceChainResult(result.data));
      setStatusText('证据链构建完成');
    } else {
      setChainResult(null);
      setStatusText(normalizeDisplayError(result.error, '证据链构建失败'));
    }
  };

  // Calculate composite recommendation confidence rating
  const totalWeight = evidenceNodes.reduce((sum, n) => sum + n.weight, 0);
  const maxPotentialWeight = evidenceNodes.length * 10;
  const compositeScore = Math.round(maxPotentialWeight > 0 ? (totalWeight / maxPotentialWeight) * 100 : 0);
  const loadLocalSamples = () => {
    setEvidenceNodes(DEFAULT_NODES);
    setSelectedNode(DEFAULT_NODES[0]);
    setChainResult(null);
    setStatusText('已载入本地样例，仅用于界面演示，不代表后端证据库。');
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-display font-medium text-white flex items-center gap-3">
            <Bookmark className="w-6.5 h-6.5 text-indigo-400" />
            投研决策证据链终端 (Evidence Chain Vault)
          </h2>
          <p className="text-xs text-neutral-500 mt-1.5 font-mono">
            {statusText}
          </p>
        </div>

        {/* Global Stock Switcher */}
        <select 
          value={selectedStock}
          onChange={e => setSelectedStock(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500/50"
        >
          <option value={selectedStock}>{selectedStock}</option>
          <option value="贵州茅台 (600519.SH)">贵州茅台 (600519.SH)</option>
          <option value="宁德时代 (300750.SZ)">宁德时代 (300750.SZ)</option>
          <option value="招商银行 (600036.SH)">招商银行 (600036.SH)</option>
        </select>
      </div>

      {/* Centerpiece Composite Score Widget & Actions */}
      <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-5 mb-6 flex-shrink-0 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 blur-[50px] pointer-events-none -translate-x-12 -translate-y-12" />
        
        <div className="flex items-center gap-5 relative z-10">
          {/* Circular overall gauge */}
          <div className="relative w-16 h-16 rounded-full bg-black/40 border border-[#6366f1]/20 flex items-center justify-center flex-shrink-0">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="rgba(99,102,241,0.06)"
                strokeWidth="4"
                fill="transparent"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="#6366f1"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - compositeScore / 100)}`}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <span className="text-sm font-mono font-bold text-white">{compositeScore}%</span>
          </div>

          <div>
            <h3 className="text-neutral-100 text-sm font-semibold tracking-wide">
              {selectedStock} 证据覆盖与权重指数
            </h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-xl">
              当前视图包含 <strong className="text-white font-medium">{evidenceNodes.length} 件决策链单据</strong>。该指数只衡量已加载证据的覆盖与权重，不直接代表买卖评级。
            </p>
          </div>
        </div>

        {/* Append node action toggle */}
        <div className="flex items-center gap-3">
          <button 
            onClick={handleBuildChain}
            className="px-4.5 py-2.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/10 transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" /> 构建证据链
          </button>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="px-4.5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500 shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> 追加核心决策论据
          </button>
          <button
            onClick={loadLocalSamples}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-yellow-400/10 hover:bg-yellow-400/15 text-yellow-300 border border-yellow-400/20 transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer"
          >
            刷新本地样例
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0 overflow-hidden">
        
        {/* Left Columns Branch Grid or Active list - 2 Cols */}
        <div className="lg:col-span-2 flex flex-col min-h-0 relative">
          
          <AnimatePresence mode="popLayout">
            {isAdding ? (
              <motion.form 
                key="add_form"
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                onSubmit={handleAddEvidence}
                className="bg-[#0b0b0b] border border-indigo-500/20 rounded-2xl p-6 h-full flex flex-col justify-between absolute inset-0 z-20 overflow-y-auto"
              >
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                    <Sparkles className="w-4.5 h-4.5 text-indigo-400 animate-pulse" /> 追加决策论据到链条
                  </h3>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-neutral-400">论据关键标题 (Title)</label>
                    <input
                      type="text"
                      required
                      placeholder="例：Q1净利润同增19%超出全同业中枢"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-neutral-400">研究评估分类 (Pillar)</label>
                      <select
                        value={newPillar}
                        onChange={e => setNewPillar(e.target.value as any)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500/50"
                      >
                        <option value="fundamental">基本面支撑 (Fundamental)</option>
                        <option value="quant">量化信号阀 (Quant Factor)</option>
                        <option value="sentiment">舆情与合规 (Sentiment & Event)</option>
                        <option value="liquidity">主力资金流 (Liquidity Flow)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-neutral-400">决策置信比重 (Weight 1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        required
                        value={newWeight}
                        onChange={e => setNewWeight(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-neutral-400">信源出处支撑 (Evidence Document Source)</label>
                    <input
                      type="text"
                      required
                      placeholder="例：公司2026年Q1财报合并报表部分"
                      value={newSource}
                      onChange={e => setNewSource(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-neutral-400">论据佐证内容 (Content Specification)</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="请详细披露核心论据事实、归因变量以及验证过程日志..."
                      value={newContent}
                      onChange={e => setNewContent(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500/50 resize-none h-24 custom-scrollbar"
                    />
                  </div>
                </div>

                <div className="flex gap-4 border-t border-white/5 pt-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 py-3 text-xs rounded-xl bg-white/5 border border-white-5 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500 font-semibold shadow-md cursor-pointer"
                  >
                    保存论证论据
                  </button>
                </div>
              </motion.form>
            ) : null}
          </AnimatePresence>

          {/* Grid visual mapping of the pillars */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pr-1 pb-4 custom-scrollbar min-h-0">
            {pillars.map(pil => {
              const nodesInPillar = evidenceNodes.filter(n => n.pillar === pil.id);
              const ActiveIcon = pil.icon;
              return (
                <div 
                  key={pil.id} 
                  className={cn(
                    "rounded-2xl border p-4.5 bg-black/20 flex flex-col min-h-[180px] transition-all duration-200",
                    selectedNode?.pillar === pil.id ? "border-indigo-500/30 bg-indigo-500/[0.02] shadow-inner" : "border-white/5"
                  )}
                >
                  {/* Pillar Header */}
                  <div className="flex justify-between items-center mb-4 pb-2.5 border-b border-white/5">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-neutral-500 flex items-center gap-1.5">
                      <ActiveIcon className="w-4 h-4 text-neutral-400" />
                      {pil.label.split(' (')[0]}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md font-mono text-[9px] bg-white/5 border border-white/10 text-neutral-400">
                      {nodesInPillar.length} 论据
                    </span>
                  </div>

                  {/* Bullet Elements inside Pillar */}
                  <div className="flex-grow space-y-2">
                    {nodesInPillar.length === 0 ? (
                      <div className="text-[10px] font-mono text-neutral-600 italic py-4">
                        [缺省] 暂无认证单据
                      </div>
                    ) : (
                      nodesInPillar.map(node => {
                        const isNodeSelected = selectedNode?.id === node.id;
                        return (
                          <div
                            key={node.id}
                            onClick={() => setSelectedNode(node)}
                            className={cn(
                              "p-2.5 rounded-xl border text-xs leading-relaxed text-left cursor-pointer transition-all flex justify-between items-start group relative overflow-hidden",
                              isNodeSelected 
                                ? "bg-indigo-500/10 border-indigo-500/40 text-neutral-100 font-medium" 
                                : "bg-black/40 border-white/5 hover:border-white/15 text-neutral-450 hover:text-neutral-300"
                            )}
                          >
                            <span className="line-clamp-1 flex-1 pr-4">{node.title}</span>
                            
                            <div className="flex items-center gap-2 flex-shrink-0 shrink-0">
                              {node.localOnly && (
                                <span className="text-[9px] font-mono font-bold px-1 rounded bg-yellow-400/10 text-yellow-300 border border-yellow-400/20">
                                  样例
                                </span>
                              )}
                              <span className="text-[9px] font-mono font-bold px-1 rounded bg-[#6366f1]/15 text-indigo-400 border border-[#6366f1]/10">
                                W {node.weight}
                              </span>
                              
                              <button
                                onClick={(e) => handleDeleteEvidence(node.id, e)}
                                className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-rose-450 p-0.5 transition-opacity"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Audit detail pane */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex flex-col relative overflow-hidden h-full min-h-[400px]">
          <div className="absolute top-0 right-0 p-3 opacity-20 text-indigo-400 pointer-events-none">
            <FolderLock className="w-24 h-24 stroke-[0.3]" />
          </div>

          <div className="flex gap-2.5 items-center mb-5 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <CheckCircle className="w-4.5 h-4.5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">投研信能佐证审计官</h3>
              <p className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">Proof Audit Interface</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 text-xs text-neutral-400 leading-relaxed pr-1 flex flex-col">
            {chainResult && (
              <div className="mb-4 space-y-3 rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-indigo-300">证据链摘要</p>
                    <p className="mt-1 text-[11px] text-neutral-400">后端已聚合论断、来源、可信度与矛盾项。</p>
                  </div>
                  <span className={cn(
                    "rounded-md border px-2 py-1 text-[10px] font-mono",
                    chainResult.contradictionCount
                      ? "border-yellow-400/20 bg-yellow-400/10 text-yellow-300"
                      : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
                  )}>
                    {chainResult.contradictionCount ? `${chainResult.contradictionCount} 个矛盾项` : '未发现矛盾'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="rounded-lg border border-white/5 bg-black/25 p-2">
                    <span className="block text-[9px] text-neutral-500">论断束</span>
                    <strong className="text-sm text-white">{chainResult.bundles.length}</strong>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-black/25 p-2">
                    <span className="block text-[9px] text-neutral-500">来源数</span>
                    <strong className="text-sm text-white">{chainResult.totalSources}</strong>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-black/25 p-2">
                    <span className="block text-[9px] text-neutral-500">平均可信度</span>
                    <strong className="text-sm text-white">{formatPercent(chainResult.averageConfidence)}</strong>
                  </div>
                </div>
                <div className="space-y-2">
                  {chainResult.bundles.slice(0, 4).map((bundle, index) => (
                    <div key={`${bundle.claim}-${index}`} className="rounded-lg border border-white/5 bg-black/25 p-2.5">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-[11px] font-medium text-neutral-200">{bundle.claim || `证据束 ${index + 1}`}</p>
                        <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-indigo-300">
                          {formatPercent(bundle.confidence)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[9px] font-mono text-neutral-500">
                        <span>来源 {bundle.source_count ?? bundle.evidence?.length ?? 0}</span>
                        <span>可信评分 {Number(bundle.trust_score ?? 0).toFixed(2)}</span>
                        <span>时效衰减 {Number(bundle.decay_factor ?? 0).toFixed(2)}</span>
                      </div>
                      {!!bundle.contradictions?.length && (
                        <div className="mt-2 rounded border border-yellow-400/10 bg-yellow-400/5 p-2 text-[10px] text-yellow-200">
                          {bundle.contradictions.slice(0, 2).map(contradictionText).join('；')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <AnimatePresence mode="wait">
              {selectedNode ? (
                <motion.div 
                  key={selectedNode.id}
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  <div className="bg-black/30 border border-white/5 rounded-xl p-3.5">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 block mb-1">选论论断</span>
                    <h4 className="text-sm text-neutral-200 font-semibold leading-relaxed text-left">{selectedNode.title}</h4>
                    {selectedNode.localOnly && (
                      <p className="mt-2 text-[10px] text-yellow-300 font-mono">本地样例，仅用于界面演示，未写入后端证据库。</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center text-[10px] font-mono">
                    <div className="p-2.5 bg-black/20 rounded-lg border border-white/5">
                      <span className="text-neutral-500 block">信能评权 (Weight)</span>
                      <span className="text-xs font-bold text-white">权重分位计 {selectedNode.weight} / 10</span>
                    </div>
                    <div className="p-2.5 bg-black/20 rounded-lg border border-white/5">
                      <span className="text-neutral-500 block">上链时间 (Stamped)</span>
                      <span className="text-xs text-neutral-300 font-medium limit-text-1">{selectedNode.time.split(' ')[0]}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-1">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-indigo-400 block">信源验证源文档</span>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-medium">
                      <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      {selectedNode.source}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 block">逻辑佐证溯源</span>
                    <p className="text-xs text-neutral-300 leading-relaxed bg-black/20 border border-white/5 p-3.5 rounded-xl text-left">
                      "{selectedNode.content}"
                    </p>
                  </div>

                  <div className="border-t border-white/5 pt-4 space-y-2">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 block">交叉合规评审日志</span>
                    <div className="flex gap-2 items-center text-[11px] bg-indigo-950/20 border border-indigo-500/20 p-2.5 rounded-xl text-indigo-300">
                      <Cpu className="w-4 h-4 text-indigo-400 animate-pulse shrink-0" />
                      <span>通过 <strong>{selectedNode.verifiedBy}</strong> 安全交叉核实。</span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 py-12 gap-2">
                  <Bookmark className="w-8 h-8 text-neutral-600 animate-pulse" />
                  <p className="text-[11px]">请在左侧结构矩阵中选择任何特定的决策指标或公告论据，以启动投研底稿和信用交叉溯源跟踪。</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>

    </motion.div>
  );
}
