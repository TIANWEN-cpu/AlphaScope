import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Sparkles, 
  Award, 
  Send, 
  ChevronRight, 
  CheckCircle, 
  Grid, 
  ArrowUpRight, 
  Download, 
  Printer, 
  FileCheck, 
  BookOpen, 
  ListOrdered,
  Plus,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

interface ReportSection {
  title: string;
  id: string;
  content: string;
}

type ReportQuality = 'idle' | 'partial' | 'complete' | 'failed';
type ReportSourceKey = 'fundamentals' | 'factors' | 'news' | 'fundFlow' | 'archive';

interface SourceStatus {
  key: ReportSourceKey;
  label: string;
  ok: boolean;
  empty: boolean;
  error?: string;
}

interface SourceResult<T> {
  status: SourceStatus;
  data: T;
}

interface ReportGeneratorProps {
  symbol?: string;
  stockName?: string;
}

const REPORT_TEMPLATES = [
  { id: 'standard', name: '标准个股深度评级公司研报', desc: '包含宏观定位，深度报表分析以及三因素量化诊股。' },
  { id: 'macro', name: '行业及产业链专题跟踪报告', desc: '梳理上下游资本开支变化与库存周期的另类情报归纳。' },
  { id: 'risk', name: '黑天鹅情绪避险与信用预警评估', desc: '侧重于舆情违约风险、大股东股权质押及账外担保预警。' }
];

const SOURCE_LABELS: Record<ReportSourceKey, string> = {
  fundamentals: '基本面',
  factors: '因子',
  news: '新闻',
  fundFlow: '资金流',
  archive: '历史归档',
};

const emptyStatus = (key: ReportSourceKey): SourceStatus => ({
  key,
  label: SOURCE_LABELS[key],
  ok: false,
  empty: true,
});

const hasObjectData = (value: unknown) =>
  Boolean(value && typeof value === 'object' && Object.keys(value as Record<string, unknown>).length);

const isDegradedData = (value: unknown) =>
  Boolean(value && typeof value === 'object' && (value as Record<string, unknown>).degraded === true);

const buildFactorSummary = (factorsData: Record<string, unknown>) => {
  const factors = (factorsData.factors || {}) as Record<string, unknown>;
  const sampleCounts = (factorsData.sample_counts || {}) as Record<string, unknown>;
  const missing = Array.isArray(factorsData.missing_dimensions) ? factorsData.missing_dimensions : [];
  const degraded = Array.isArray(factorsData.degraded_inputs) ? factorsData.degraded_inputs : [];
  return [
    `综合因子=${factors.composite ?? '--'}，动量=${factors.momentum ?? '--'}，资金流=${factors.fund_flow ?? '--'}。`,
    `样本覆盖：新闻 ${sampleCounts.news ?? 0} 条，事件 ${sampleCounts.events ?? 0} 条，研报 ${sampleCounts.reports ?? 0} 条。`,
    missing.length ? `缺失维度：${missing.join('、')}。` : '主要因子维度已返回。',
    degraded.length ? `降级输入：${degraded.join('、')}。` : '',
  ].filter(Boolean).join('');
};

const hasUsableFactorData = (value: unknown) => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const sampleCounts = record.sample_counts as Record<string, unknown> | undefined;
  const factors = record.factors as Record<string, unknown> | undefined;
  const hasSamples = Boolean(sampleCounts && Object.values(sampleCounts).some(count => Number(count) > 0));
  const hasSignals = Array.isArray(record.signals) && record.signals.length > 0;
  const hasNonZeroFactor = Boolean(factors && Object.values(factors).some(factor => Number(factor) !== 0));
  return hasSamples || hasSignals || hasNonZeroFactor;
};

const sourceStatusText = (status: SourceStatus) => {
  if (status.ok) return '可用';
  if (status.error) return `失败：${status.error}`;
  return '为空';
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function readSource<T>(
  key: ReportSourceKey,
  settled: PromiseSettledResult<{ success: boolean; data?: T | null; error?: string | null; message?: string | null }>,
  fallback: T,
  hasData: (data: T) => boolean,
): SourceResult<T> {
  if (settled.status === 'rejected') {
    return {
      data: fallback,
      status: { key, label: SOURCE_LABELS[key], ok: false, empty: false, error: settled.reason instanceof Error ? settled.reason.message : String(settled.reason || '请求失败') },
    };
  }
  const response = settled.value;
  if (!response.success) {
    return {
      data: fallback,
      status: { key, label: SOURCE_LABELS[key], ok: false, empty: false, error: response.error || response.message || '接口返回失败' },
    };
  }
  const data = response.data ?? fallback;
  if (!hasData(data)) {
    return { data, status: emptyStatus(key) };
  }
  if (isDegradedData(data)) {
    return {
      data,
      status: { key, label: SOURCE_LABELS[key], ok: false, empty: false, error: '数据源降级' },
    };
  }
  return { data, status: { key, label: SOURCE_LABELS[key], ok: true, empty: false } };
}

export function ReportGenerator({ symbol = '600519', stockName = '贵州茅台' }: ReportGeneratorProps) {
  const [selectedStock, setSelectedStock] = useState(`${stockName} (${symbol})`);
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
  const [rating, setRating] = useState('BUY / 强烈推荐');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState('summary');
  const [dynamicSections, setDynamicSections] = useState<ReportSection[]>([]);
  const [dataStatus, setDataStatus] = useState('等待后端数据整合');
  const [generationError, setGenerationError] = useState('');
  const [reportQuality, setReportQuality] = useState<ReportQuality>('idle');
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>([]);
  const targetSymbol = selectedStock.match(/\d{5,6}/)?.[0] || symbol;
  const selectedStockName = selectedStock.replace(/\s*\([^)]*\)\s*$/, '') || stockName;
  const reportDate = formatLocalDate(new Date());
  const reportId = `${targetSymbol}-AI-${reportDate.replace(/-/g, '')}`;
  const selectedTemplateName = REPORT_TEMPLATES.find(item => item.id === selectedTemplate)?.name || selectedTemplate;
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const reportScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    const container = reportScrollRef.current;
    const target = sectionRefs.current[sectionId];
    if (!container || !target) return;
    const containerTop = container.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    container.scrollTo({
      top: container.scrollTop + targetTop - containerTop - 16,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    setSelectedStock(`${stockName} (${symbol})`);
    setReportGenerated(false);
    setDynamicSections([]);
    setGenerationError('');
    setReportQuality('idle');
    setSourceStatuses([]);
  }, [symbol, stockName]);

  const steps = [
    { label: '多源信息收集', desc: '基本面 Agent 正从多方财经终端与交易所爬取财报与经营指标...' },
    { label: '历史量化回验', desc: '量化 Agent 计算因子协方差矩阵并回测多头溢价敞口波动...' },
    { label: '舆情与风险过滤', desc: '合规与舆情 Agent 分析全网社交、券商评级及政策变焦偏差...' },
    { label: '智能排版与终审', desc: '专家圆桌交叉纠偏，渲染专业排版并输出投资逻辑评估报告...' }
  ];

  const fallbackReportSections: ReportSection[] = [
    {
      id: 'summary',
      title: '一、 核心投资摘要 (Executive Summary)',
      content: `本报告对 ${selectedStock} 展开深度多维度测绘。由于行业估值调整已进入历史高流动性折溢价底线，且本标的品牌护城河稳固，核心红利与利润率保障极其明确。量化多因子多头暴露显示技术性低点已经构成。因此维持强烈推荐（${rating}）评级，设定目标溢价估值在 1,750.00 元至 1,820.00 元区间。`
    },
    {
      id: 'fundamentals',
      title: '二、 深度基本面多维透视 (Fundamentals Analysis)',
      content: '主营业务盈利状况依旧领先行业。Q1毛利率高达91.8%，现金周转天数仅 34.5 天，显示极端强势的产业链上游议价权。销售渠道上自营App「i茅台」以及直销配额占营收比再度抬升。尽管市场情绪阶段性承压，行业总库存去化健康，中长期龙头优势溢价不发生动摇。财务报表无商誉及长期应付债务坏账隐忧。'
    },
    {
      id: 'quant',
      title: '三、 金策量化多因子测绘 (Quantitative Factor Evaluation)',
      content: '因子动量归因分析表明，该股票近期在【高避险红利因子】和【资产报酬率(RSI)超跌反弹因子】上暴露度最高。技术层面上，本标的在遭遇1460元箱体大级别底支撑后，成交量显著收缩，并在MA20均线构建稳健整编上升信道，MACD零轴下方底背离成立，出现典型的阻力翻转底托盘多头回撤终极信号。'
    },
    {
      id: 'risk',
      title: '四、 持仓风控与合规警示 (Risk Assessment & Disclosure)',
      content: '需要审慎规避的尾部变量：1. 全球宏观流动性受挫对大消费主权估值的挤压。2. 自营店拓展可能引致的地方经销商利益摩擦或渠道存量竞争。3. 券商高频调降同业中枢的整体防御溢价拉平倾向。持仓合规底线建议设立 1420元 坚决止损红线，安全敞口不宜超过组合的 8%。'
    }
  ];
  const reportSections = dynamicSections.length ? dynamicSections : fallbackReportSections;

  const startGeneration = async () => {
    setIsGenerating(true);
    setGenerationStep(0);
    setReportGenerated(false);
    setGenerationError('');
    setReportQuality('idle');
    setSourceStatuses([]);
    setDataStatus(`正在聚合 ${selectedStock} 后端数据...`);

    const [fundamentalsResult, factorsResult, newsResult, fundFlowResult, archiveResult] = await Promise.allSettled([
      api.fundamentals(targetSymbol),
      api.factors(targetSymbol, selectedStockName, 60),
      api.news(targetSymbol, 8),
      api.fundFlow(targetSymbol, 30),
      api.archiveList(targetSymbol, 10),
    ]);

    const fundamentalsSource = readSource('fundamentals', fundamentalsResult, {}, data => {
      const record = data as Record<string, unknown>;
      return Array.isArray(record.financial_periods) || hasObjectData(record.valuation);
    });
    const factorsSource = readSource('factors', factorsResult, {}, hasUsableFactorData);
    const newsSource = readSource('news', newsResult, { news: [], total: 0 }, data => Boolean(data.news?.length));
    const fundFlowSource = readSource('fundFlow', fundFlowResult, {}, hasObjectData);
    const archiveSource = readSource('archive', archiveResult, { reports: [], total: 0 }, data => Boolean(data.reports?.length));

    const statuses = [fundamentalsSource.status, factorsSource.status, newsSource.status, fundFlowSource.status, archiveSource.status];
    const usableSources = statuses.filter(status => status.ok);
    setSourceStatuses(statuses);

    if (!usableSources.length) {
      const message = '后端数据源全部不可用，未生成研报。请检查服务连接或稍后重试。';
      setDynamicSections([]);
      setReportGenerated(false);
      setReportQuality('failed');
      setGenerationError(message);
      setDataStatus('报告生成失败：后端数据源全部不可用');
      setIsGenerating(false);
      return;
    }

    const fundamentals = fundamentalsSource.data as Record<string, unknown>;
    const factors = factorsSource.data as Record<string, unknown>;
    const newsItems = newsSource.data.news || [];
    const fundFlow = fundFlowSource.data as Record<string, unknown>;
    const archives = archiveSource.data.reports || [];
    const periods = Array.isArray(fundamentals.financial_periods) ? fundamentals.financial_periods as Record<string, unknown>[] : [];
    const latest = periods[0] || {};
    const valuation = (fundamentals.valuation || {}) as Record<string, unknown>;
    const factorText = factorsSource.status.ok ? buildFactorSummary(factors as Record<string, unknown>) : '因子接口无可用数据，本节仅保留缺口披露。';
    const flowSummary = (fundFlow.summary || {}) as Record<string, unknown>;
    const fundFlowDegraded = Boolean(fundFlow.degraded);
    const flowMain = flowSummary.last_main_yi ?? flowSummary.main_total_yi ?? '--';
    const flowSuper = flowSummary.super_total_yi ?? '--';
    const flowLarge = flowSummary.large_total_yi ?? '--';
    const flowNote = fundFlowDegraded ? '资金流数据源降级，当前不应解读为真实净流入。' : '';
    const missingNote = statuses.some(status => !status.ok)
      ? `数据缺口：${statuses.filter(status => !status.ok).map(status => `${status.label}${status.error ? `失败(${status.error})` : '为空'}`).join('；')}。`
      : '全部后端数据源均返回可用数据。';

    const sectionSets: Record<string, ReportSection[]> = {
      standard: [
        { id: 'summary', title: '一、 核心投资摘要 (Executive Summary)', content: `本报告对 ${selectedStock} 展开后端数据驱动的投研整合。当前评级设定为 ${rating}。估值侧 PE=${valuation.pe || valuation.pe_ttm || '--'}，PB=${valuation.pb || '--'}；系统同步到 ${newsItems.length} 条相关新闻/公告与 ${archives.length} 条历史归档报告。${missingNote}` },
        { id: 'fundamentals', title: '二、 深度基本面多维透视 (Fundamentals Analysis)', content: `基本面接口返回最近财务期：${latest.period || latest.report_date || '--'}。毛利率=${latest.gross_margin_pct || '--'}，净利润同比=${latest.yoy_net_profit_pct || '--'}，ROE=${latest.roe_pct || '--'}。` },
        { id: 'quant', title: '三、 金策量化多因子测绘 (Quantitative Factor Evaluation)', content: factorText },
        { id: 'risk', title: '四、 舆情、资金流与风控披露 (Risk Assessment & Disclosure)', content: `近端资金流摘要：主力净流入=${flowMain}亿，超大单=${flowSuper}亿，大单=${flowLarge}亿。${flowNote}最新新闻要点：${newsItems.map(item => item.title).slice(0, 4).join('；') || '暂无后端新闻'}。` },
      ],
      macro: [
        { id: 'summary', title: '一、 行业及产业链跟踪摘要', content: `${selectedStock} 当前评级为 ${rating}。本模板优先关注产业链、资金流和历史归档交叉验证。${missingNote}` },
        { id: 'fundamentals', title: '二、 估值与财务上下文', content: `估值侧 PE=${valuation.pe || valuation.pe_ttm || '--'}，PB=${valuation.pb || '--'}；最近财务期=${latest.period || latest.report_date || '--'}。` },
        { id: 'quant', title: '三、 资金流与因子联动', content: `资金流摘要：主力=${flowMain}亿，超大单=${flowSuper}亿。${flowNote}因子摘要：${factorText}` },
        { id: 'risk', title: '四、 新闻与归档跟踪', content: `新闻要点：${newsItems.map(item => item.title).slice(0, 5).join('；') || '暂无后端新闻'}。历史报告数量：${archives.length}。` },
      ],
      risk: [
        { id: 'summary', title: '一、 风险摘要与评级约束', content: `${selectedStock} 当前评级为 ${rating}。本模板优先披露不可用数据源与尾部风险。${missingNote}` },
        { id: 'fundamentals', title: '二、 财务红旗扫描', content: `毛利率=${latest.gross_margin_pct || '--'}，净利润同比=${latest.yoy_net_profit_pct || '--'}，ROE=${latest.roe_pct || '--'}。缺失字段应视为后续人工复核重点。` },
        { id: 'quant', title: '三、 因子与资金压力测试', content: `资金流：主力=${flowMain}亿，大单=${flowLarge}亿。${flowNote}因子风险摘要：${factorText}` },
        { id: 'risk', title: '四、 舆情与历史归档预警', content: `新闻风险线索：${newsItems.map(item => item.title).slice(0, 4).join('；') || '暂无后端新闻'}。历史归档报告：${archives.length} 条。` },
      ],
    };

    setDynamicSections(sectionSets[selectedTemplate] || sectionSets.standard);
    const quality: ReportQuality = statuses.every(status => status.ok) ? 'complete' : 'partial';
    setReportQuality(quality);
    setReportGenerated(true);
    setDataStatus(quality === 'complete' ? '后端数据已完成聚合，可在右侧预览、下载或打印' : '部分后端数据可用：已生成带缺口披露的研报');
    setIsGenerating(false);
  };

  const downloadReport = () => {
    const markdown = [
      `# ${selectedStock} 投研报告`,
      '',
      `评级：${rating}`,
      `模板：${selectedTemplateName}`,
      `数据质量：${reportQuality === 'complete' ? '后端数据完整' : reportQuality === 'partial' ? '部分数据缺失' : '未生成'}`,
      '',
      ...sourceStatuses.map(status => `- ${status.label}：${sourceStatusText(status)}`),
      '',
      ...reportSections.map(section => `## ${section.title}\n\n${section.content}`),
    ].join('\n\n');
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${targetSymbol}-research-report.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGenerating) {
      timer = setInterval(() => {
        setGenerationStep(prev => {
          if (prev >= steps.length - 1) {
            clearInterval(timer);
            return steps.length - 1;
          }
          return prev + 1;
        });
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [isGenerating]);

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
          <FileText className="w-6.5 h-6.5 text-indigo-400" />
          研究报告自动生成器
        </h2>
        <p className="text-xs text-neutral-500 mt-1.5 font-mono">
          {dataStatus}
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0 overflow-hidden">
        
        {/* Left configurations Column */}
        <div className="flex flex-col gap-6 min-h-0 bg-white/[0.01] border border-white/5 rounded-2xl p-5">
          <span className="text-xs font-mono uppercase tracking-widest text-[#6366f1] font-bold block mb-1">投研参数定制</span>
          
          {/* Target Stock Select */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-400 select-none">研究对象 (Target Stock)</label>
            <select 
              value={selectedStock}
              onChange={e => setSelectedStock(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500/50"
            >
              <option value={selectedStock}>{selectedStock}</option>
              <option value="贵州茅台 (600519.SH)">贵州茅台 (600519.SH)</option>
              <option value="宁德时代 (300750.SZ)">宁德时代 (300750.SZ)</option>
              <option value="招商银行 (600036.SH)">招商银行 (600036.SH)</option>
              <option value="腾讯控股 (00700.HK)">腾讯控股 (00700.HK)</option>
            </select>
          </div>

          {/* Report Rating Select */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-400 select-none">推荐主权评级 (Rating)</label>
            <select 
              value={rating}
              onChange={e => setRating(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500/50"
            >
              <option value="BUY / 强烈推荐">强烈推荐 (STRONG BUY)</option>
              <option value="HOLD / 中性持有">中性持有 (HOLD)</option>
              <option value="UNDERWEIGHT / 建议避险">建议避险 (UNDERWEIGHT)</option>
            </select>
          </div>

          {/* Template Lists */}
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
                  ? "bg-indigo-950/40 border border-indigo-505/20 text-indigo-400 cursor-not-allowed" 
                  : "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500"
              )}
            >
              <Sparkles className="w-4 h-4 text-indigo-200 animate-pulse" />
              {isGenerating ? 'AI Report Generation Active...' : '启动智能整合排版'}
            </button>
          </div>
        </div>

        {/* Right Preview Panel & outline - Takes 2 Columns */}
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

                <h3 className="text-lg font-semibold text-white mb-2">多Agent专家组协同合研中</h3>
                <p className="text-xs text-neutral-500 mb-8 max-w-sm text-center">系统正在调配各领域专家网络提取底本财务以及因子的宏观归因要素，这至多需要15秒。</p>

                {/* Vertical Process Steps */}
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

            {/* Generated PDF Frame State */}
            {reportGenerated ? (
              <motion.div
                key="generated"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex-1 flex min-h-0 overflow-hidden"
              >
                
                {/* PDF Left Navigation Outline Bar */}
                <div className="w-[180px] border-r border-white/5 bg-black/20 flex flex-col p-4 flex-shrink-0">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 font-bold block mb-3 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> 研报目录树
                  </span>
                  
                  <div className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
                    {reportSections.map(sec => (
                      <button
                        key={sec.id}
                        onClick={() => scrollToSection(sec.id)}
                        title={`跳转到${sec.title}`}
                        aria-label={`跳转到${sec.title}`}
                        className={cn(
                          "w-full text-left p-2.5 rounded-lg text-xs leading-normal transition-all cursor-pointer font-sans limit-text-1",
                          activeSectionId === sec.id 
                            ? "bg-indigo-500/15 text-indigo-300 font-medium border border-indigo-500/20 shadow-inner"
                            : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]"
                        )}
                      >
                        {sec.title.split(' (')[0]}
                      </button>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-white/5 text-center text-[10px] font-mono text-neutral-600 select-none">
                    PAGE 1 / 1
                  </div>
                </div>

                {/* PDF Center Main Document Showcase */}
                <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c0c] relative">
                  
                  {/* Top Bar for export operations */}
                  <div className="px-5 py-3 border-b border-white/5 flex justify-between items-center bg-black/40 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-rose-500/15 border border-rose-500/20 rounded text-[9px] font-semibold text-rose-450 uppercase leading-none">
                        INSTITUTIONAL ONLY
                      </span>
                      {reportQuality !== 'idle' && reportQuality !== 'failed' && (
                        <span className={cn(
                          "px-2 py-0.5 border rounded text-[9px] font-semibold uppercase leading-none",
                          reportQuality === 'complete'
                            ? "bg-emerald-500/15 border-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/15 border-amber-500/20 text-amber-300"
                        )}>
                          {reportQuality === 'complete' ? '后端数据完整' : '部分数据缺失'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
                      <button onClick={downloadReport} className="p-1 px-2 flex items-center gap-1 bg-white/5 border border-white/5 rounded hover:bg-white/10 hover:text-white transition-colors cursor-pointer">
                        <Download className="w-3 h-3" /> 下载 Markdown
                      </button>
                      <button onClick={() => window.print()} className="p-1 px-2 flex items-center gap-1 bg-white/5 border border-white/5 rounded hover:bg-white/10 hover:text-white transition-colors cursor-pointer">
                        <Printer className="w-3 h-3" /> 打印格式
                      </button>
                    </div>
                  </div>

                  {/* Elegant Formal Paper Canvas */}
                  <div ref={reportScrollRef} className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white/[0.015] leading-relaxed relative min-h-0">
                    <div className="max-w-2xl mx-auto space-y-6">
                      
                      {/* Paper Emblem */}
                      <div className="text-center pb-6 border-b border-white/5 flex flex-col items-center gap-2 select-none">
                        <Award className="w-9 h-9 text-indigo-400 opacity-60" />
                        <h1 className="text-xl font-display font-bold text-white tracking-widest uppercase">
                          金策投研体系正式上市公司评测书 (AI-FINANCIAL NOTE)
                        </h1>
                        <p className="text-[10px] font-mono tracking-widest text-[#6366f1] font-semibold">
                          编号: {reportId} • 授信主体: 核心分析助理网络
                        </p>
                      </div>

                      {/* Header block details */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-black/30 border border-white/5 rounded-xl p-4 font-mono text-[10px]">
                        <div>
                          <span className="text-neutral-500 block">评定对象 (Ticker):</span>
                          <span className="text-neutral-200 font-bold">{selectedStock}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">估值建议 (Rating):</span>
                          <span className="text-rose-400 font-bold">{rating}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">报告模板 (Template):</span>
                          <span className="text-neutral-200 font-bold">{selectedTemplateName}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">汇编日期 (Date):</span>
                          <span className="text-neutral-200 font-bold">{reportDate}</span>
                        </div>
                      </div>

                      {sourceStatuses.length > 0 && (
                        <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                            <ListOrdered className="w-3.5 h-3.5" /> 后端数据源状态
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {sourceStatuses.map(status => (
                              <div
                                key={status.key}
                                className={cn(
                                  "rounded-lg border px-3 py-2 text-[10px] font-mono text-left",
                                  status.ok
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                                    : status.error
                                      ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                                      : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                                )}
                              >
                                <span className="font-semibold">{status.label}</span>
                                <span className="block mt-0.5 text-neutral-400 line-clamp-2">{sourceStatusText(status)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Focused outlines text render dynamically or as block */}
                      <div className="space-y-6 font-sans text-xs leading-relaxed text-neutral-300">
                        {reportSections.map(sec => {
                          const isFocused = sec.id === activeSectionId;
                          return (
                            <div
                              key={sec.id}
                              ref={element => { sectionRefs.current[sec.id] = element; }}
                              className={cn(
                                "p-4.5 rounded-xl transition-all border",
                                isFocused 
                                  ? "bg-indigo-500/5 border-indigo-500/30" 
                                  : "bg-transparent border-transparent"
                              )}
                            >
                              <h3 className={cn(
                                "text-sm font-semibold mb-2 flex items-center justify-between",
                                isFocused ? "text-indigo-300" : "text-white"
                              )}>
                                {sec.title}
                                {isFocused && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping shrink-0" />}
                              </h3>
                              <p className="text-xs text-neutral-300 font-normal leading-relaxed text-left">
                                {sec.content}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Disclaimers & Footwear signature */}
                      <div className="border-t border-white/5 pt-6 text-[9px] text-neutral-500 leading-normal text-left font-mono">
                        <strong className="text-neutral-400 block mb-1">合规特别披露与风险保障免责:</strong>
                        本研报系由金策 AI 模拟宏观及动量多套件助理对特定市场信源与因子协方差进行中性自动化排版编排，绝不构成对于任何个体用户具体可承载资金敞口的最终投资决议引荐。证券投资面临客观回撤与极端流动性波动隐患，用户据本草案进行操作而诱发之商业亏损须自负其责。
                      </div>

                    </div>
                  </div>
                </div>

              </motion.div>
            ) : (
              // Idle state render before compiling report
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

                {generationError && (
                  <div className="mt-2 max-w-md rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-left">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                      <div>
                        <h4 className="text-xs font-semibold text-rose-300">报告生成失败</h4>
                        <p className="text-xs text-rose-200/80 mt-1 leading-relaxed">{generationError}</p>
                      </div>
                    </div>
                    {sourceStatuses.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 gap-1.5 text-[10px] font-mono">
                        {sourceStatuses.map(status => (
                          <div key={status.key} className="flex justify-between gap-3 rounded bg-black/20 px-2 py-1 text-neutral-400">
                            <span>{status.label}</span>
                            <span className="text-right">{sourceStatusText(status)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

    </motion.div>
  );
}
