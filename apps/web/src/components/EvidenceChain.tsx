import React, { useEffect, useMemo, useState } from 'react';
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
import { STOCK_UNIVERSE, StockTarget, findStockTarget, formatStockLabel } from '../lib/stocks';
import { dispatchStockSelected, getPersistedStock, subscribeStockSelected } from '../lib/workspaceEvents';

interface EvidenceNode {
  id: string;
  title: string;
  pillar: 'fundamental' | 'quant' | 'sentiment' | 'liquidity';
  weight: number; // 0 to 10
  source: string;
  time: string;
  content: string;
  verifiedBy: string;
}

function buildEvidenceNodes(stock: StockTarget): EvidenceNode[] {
  const isChip = /半导体|存储|芯片|光模块/i.test(stock.sector) || stock.symbol.startsWith('301666');
  const isConsumption = /白酒|消费/i.test(stock.sector);
  const shortSymbol = stock.symbol.split('.')[0];

  return [
    {
      id: `${shortSymbol}-fundamental-1`,
      title: isChip ? `${stock.name} 研发投入与存储控制器产品线构成核心壁垒` : isConsumption ? `${stock.name} 高毛利与品牌渠道构成核心护城河` : `${stock.name} 财务质量与主营韧性进入核心观察区`,
      pillar: 'fundamental',
      weight: isChip ? 8 : 9,
      source: `${stock.name} ${shortSymbol} 定期报告与招股说明书摘录`,
      time: '2026-05-22 17:30',
      content: isChip
        ? `${stock.name} 所在的${stock.sector}赛道对固件、主控算法和客户认证周期依赖较强，需重点核验研发费用率、存货周转和大客户订单稳定性。`
        : `${stock.name} 当前核心论据来自主营盈利质量、现金流覆盖和渠道去化，需与最新公告、经销商库存和行业价格带交叉验证。`,
      verifiedBy: '基本面分析助手'
    },
    {
      id: `${shortSymbol}-fundamental-2`,
      title: isChip ? '国产替代与企业级存储需求为中期成长弹性提供支撑' : '收入结构变化与渠道效率改善提供利润弹性',
      pillar: 'fundamental',
      weight: 8,
      source: `${stock.name} 产业链调研纪要`,
      time: '2026-05-23 10:15',
      content: isChip
        ? '企业级 SSD、工业控制和信创服务器链条的订单节奏决定收入兑现速度，需持续跟踪渠道库存、客户认证和价格竞争。'
        : '直营、重点客户或高毛利产品占比提升会改善单品利润率，但需要与行业需求和竞品价格共同核验。',
      verifiedBy: '基本面分析助手'
    },
    {
      id: `${shortSymbol}-quant-1`,
      title: `${stock.symbol} 量价波动进入短周期技术确认区`,
      pillar: 'quant',
      weight: 7,
      source: `${stock.symbol} 行情多周期量价归因指标`,
      time: '2026-05-23 12:44',
      content: '短周期均线、成交量和换手率同步抬升时，才可把题材热度转化为趋势确认；若放量冲高后回落，需要降低权重。',
      verifiedBy: '量化策略专家'
    },
    {
      id: `${shortSymbol}-sentiment-1`,
      title: isChip ? '大基金与国产算力链热度对半导体存储形成情绪映射' : '行业政策与消费复苏预期影响风险偏好',
      pillar: 'sentiment',
      weight: isChip ? 8 : 7,
      source: `${stock.sector} 主题热度与舆情监测`,
      time: '2026-05-23 14:30',
      content: isChip
        ? '大基金三期、AI 服务器和数据中心扩容预期会推升半导体存储关注度，但主题交易需警惕估值与业绩兑现错配。'
        : '宏观风险偏好和行业景气会影响估值中枢，需避免把短期情绪直接等同为基本面改善。',
      verifiedBy: '宏观趋势分析师'
    },
    {
      id: `${shortSymbol}-liquidity-1`,
      title: `${stock.name} 主力资金与换手结构需持续跟踪`,
      pillar: 'liquidity',
      weight: 8,
      source: `${stock.symbol} 交易所盘后资金与龙虎榜跟踪`,
      time: '2026-05-23 15:10',
      content: '若机构席位、融资余额和大单净流入共同改善，则流动性论据权重上调；若仅为短线游资拉升，则纳入待核验观察。',
      verifiedBy: '数据情报收集员'
    }
  ];
}

export function EvidenceChain() {
  const initialStock = getPersistedStock() ?? STOCK_UNIVERSE[0];
  const [selectedTarget, setSelectedTarget] = useState<StockTarget>(initialStock);
  const [customNodes, setCustomNodes] = useState<EvidenceNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<EvidenceNode | null>(null);
  
  // Custom new node states
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPillar, setNewPillar] = useState<'fundamental' | 'quant' | 'sentiment' | 'liquidity'>('fundamental');
  const [newWeight, setNewWeight] = useState(7);
  const [newSource, setNewSource] = useState('财联社/Wind 精梳');
  const [newContent, setNewContent] = useState('');

  const selectedStock = formatStockLabel(selectedTarget);
  const generatedNodes = useMemo(() => buildEvidenceNodes(selectedTarget), [selectedTarget]);
  const evidenceNodes = useMemo(() => [...customNodes, ...generatedNodes], [customNodes, generatedNodes]);
  const stockOptions = useMemo(
    () => [selectedTarget, ...STOCK_UNIVERSE].filter((stock, index, list) => (
      list.findIndex((item) => item.symbol === stock.symbol) === index
    )),
    [selectedTarget],
  );

  useEffect(() => {
    const next = evidenceNodes[0] ?? null;
    setSelectedNode((current) => current && evidenceNodes.some((node) => node.id === current.id) ? current : next);
  }, [evidenceNodes]);

  useEffect(() => subscribeStockSelected(({ stock }) => {
    setSelectedTarget(findStockTarget(stock.symbol) ?? stock);
    setCustomNodes([]);
  }), []);

  const pillars = [
    { id: 'fundamental', label: '基本面支撑 (Fundamental)', icon: FileText, color: 'border-rose-500/30 text-rose-450 bg-rose-500/5' },
    { id: 'quant', label: '量化信号阀 (Quant Factor)', icon: Cpu, color: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5' },
    { id: 'sentiment', label: '舆情与合规 (Sentiment & Event)', icon: Newspaper, color: 'border-emerald-500/30 text-emerald-450 bg-emerald-500/5' },
    { id: 'liquidity', label: '主力资金流 (Liquidity Flow)', icon: Coins, color: 'border-amber-500/30 text-amber-400 bg-amber-500/5' }
  ];

  const handleAddEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const newNode: EvidenceNode = {
      id: Date.now().toString(),
      title: newTitle,
      pillar: newPillar,
      weight: Number(newWeight),
      source: newSource,
      time: new Date().toISOString().replace('T', ' ').substring(0, 16),
      content: newContent,
      verifiedBy: '人工审计分析师'
    };

    setCustomNodes(prev => [newNode, ...prev]);
    setSelectedNode(newNode);
    setNewTitle('');
    setNewContent('');
    setIsAdding(false);
  };

  const handleDeleteEvidence = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomNodes(prev => prev.filter(item => item.id !== id));
    if (selectedNode?.id === id) {
      setSelectedNode(null);
    }
  };

  // Calculate composite recommendation confidence rating
  const totalWeight = evidenceNodes.reduce((sum, n) => sum + n.weight, 0);
  const maxPotentialWeight = evidenceNodes.length * 10;
  const compositeScore = Math.round(maxPotentialWeight > 0 ? (totalWeight / maxPotentialWeight) * 100 : 0);

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
            <Bookmark className="w-6 h-6 text-indigo-400" />
            投研决策证据链终端 (Evidence Chain Vault)
          </h2>
          <p className="text-xs text-neutral-500 mt-1.5 font-mono">
            严格遵循可证伪性的学术级证据溯源面板，将专家圆桌论证、量化回测溢价与实时信源在链上织网对齐。
          </p>
        </div>

        {/* Global Stock Switcher */}
        <select 
          value={selectedTarget.symbol}
          onChange={e => {
            const stock = stockOptions.find((item) => item.symbol === e.target.value);
            if (stock) {
              setSelectedTarget(stock);
              setCustomNodes([]);
              dispatchStockSelected(stock, 'system');
            }
          }}
          className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500/50"
        >
          {stockOptions.map((stock) => (
            <option key={stock.symbol} value={stock.symbol}>{formatStockLabel(stock)}</option>
          ))}
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
              {selectedStock} 论据综合看多溢价指数
            </h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-xl">
              结合当前已收集并由辅助Agent交叉认证的 <strong className="text-white font-medium">{evidenceNodes.length} 件决策链单据</strong>，复合多维数学模型给出的综合看多推荐置信度。
            </p>
          </div>
        </div>

        {/* Append node action toggle */}
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="px-4.5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500 shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> 追加核心决策论据
        </button>
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
                    className="flex-1 py-3 text-xs rounded-xl bg-white/5 border border-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
