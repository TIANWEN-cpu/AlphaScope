import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Newspaper, 
  Search, 
  TrendingUp, 
  Flame, 
  Calendar, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  Filter, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  Gauge, 
  Globe, 
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '../lib/utils';

interface NewsItem {
  id: string;
  time: string;
  title: string;
  category: 'macro' | 'announcement' | 'risk' | 'funds';
  source: string;
  severity: 'high' | 'medium' | 'info';
  sentiment: 'bullish' | 'bearish' | 'neutral';
  impactScore: number;
  content: string;
  aiSummary: string;
}

const INITIAL_NEWS: NewsItem[] = [
  {
    id: '1',
    time: '14:25',
    title: '重磅：国家大基金三期注册成立，法定代表人为张新，注册资本达3440亿元！引发半导体权重股直线封板。',
    category: 'macro',
    source: '国家企业信用信息公示系统',
    severity: 'high',
    sentiment: 'bullish',
    impactScore: 92,
    content: '5月23日，国家集成电路产业投资基金三期股份有限公司（简称大基金三期）于5月24日正式注册成立。注册资本达3440亿人民币，经营范围包括私募股权投资基金管理、创业投资、项目投资等。该大金额基金主要由财政部以及国开金融、五大国有银行等实力单位共同持股，出资总额大幅超越一期及二期。',
    aiSummary: '本次成立资本超预期，预计将大力聚焦存储芯片、先进制造、卡脖子关键设备和AI算力芯片等战略领域。对半导体设备、封测与Fab代工链条构成中长期极高确定性行业催化，可高度关注估值修复行情。'
  },
  {
    id: '2',
    time: '14:12',
    title: '贵州茅台（600519.SH）发布最新经营数据：2026年Q1至Q2渠道库存去化良好，生肖及直销营收占比提升至44.1%。',
    category: 'announcement',
    source: '公司公告',
    severity: 'medium',
    sentiment: 'bullish',
    impactScore: 81,
    content: '贵州茅台酒股份有限公司发布今年中期经营推演。通过大数据渠道监控显示，53度飞天茅台核心批价在2200-2450元价格区间内获得铁底支撑，新设生肖及非标茅台配额被零售渠道全数承接，直营App「i茅台」单季活跃付费用户突破4800万人。',
    aiSummary: '白酒库存周期安全，终端需求稳健。直营渠道比例不断强化，变相拉高单瓶利润率。量化归因表明其在当前消费承压背景下具有极高护城河属性。'
  },
  {
    id: '3',
    time: '13:50',
    title: '美联储多位理事发表鹰派演说：当前降息时机尚不成熟，CPI通胀具备明显反弹韧性，不排除再度收紧的后置选项。',
    category: 'macro',
    source: 'Bloomberg Terminal',
    severity: 'high',
    sentiment: 'bearish',
    impactScore: 78,
    content: '美联储五位重要决策官员在华盛顿政策座谈会上集体发声。沃勒与卡什卡利明确指出，薪资增长与服务业核心通胀仍旧粘滞。虽然上月PPI略微回落，但若过早下调利率底线，有概率将两年的控通胀努力付之东流，维持限制性利率政策是第一排序。',
    aiSummary: '全球流动性预期受挫，美债10年期收益率应声拉升3.5BP至4.42%。高股息周期红利标的和资源品具有抵抗力，科技及成长型资产由于分母端折现率压制预计出现短期波动。'
  },
  {
    id: '4',
    time: '11:05',
    title: '警惕：某知名新能源头部车企传出供应链付款延迟逾35天。多家二级协作件厂商开始控制交付节奏，警示账期坏账。',
    category: 'risk',
    source: '投研舆情预警',
    severity: 'high',
    sentiment: 'bearish',
    impactScore: 85,
    content: '核心情报显示，某家新势力车企与其在华东的数家动力电池辅料、汽车线束和精密铸件供应商出现结算纠纷。原本50天的现金汇票结清周期被单方面通知推迟至85天。部分现金流极度偏紧的公司已开始在限制性条件下暂缓配套模具生产。',
    aiSummary: '高度重视供应链资金链传染风险！该车企应付账款占比过高表明行业内低价倾销压力传导严重。直接波及中上游零部件板块毛利率和周转率，量化多因子风控已对标的车企信用评级下调一档。'
  },
  {
    id: '5',
    time: '10:15',
    title: '千亿级资金风向：北向资金盘中净买入超62亿元，多只核心权重蓝筹股（贵州茅台、招商银行）获主力高位吸筹。',
    category: 'funds',
    source: '沪深交易所数据',
    severity: 'medium',
    sentiment: 'bullish',
    impactScore: 75,
    content: '截至北京时间10时15分，外资买进额呈现罕见单边上扬走势。其中沪股通方向核心持仓买入金额占到大头，前十大交易标的中除茅台、宁德时代以外，高分红电力及公用事业股被深度扫描买入。主力多头回补明显。',
    aiSummary: '跨境利差博弈钝化。核心资产重获中长线配置型外资返场，支持指数短期防线和均线支撑位，为当前量化多头核心暴露因子提供了买盘流动性支撑。'
  }
];

const CALENDAR_EVENTS = [
  { time: '16:00', title: '欧元区 4月 核心物价调和指数（HICP）', importance: '★★★☆☆', status: '已公布', preview: '预期 2.7% | 实际 2.6%', impact: '中性偏好' },
  { time: '20:30', title: '美国 4月 PCE 物价指数核心指标（年率）', importance: '★★★★★', status: '未公布', preview: '前值 2.8% | 预测值 2.7%', impact: '高瞻性催化' },
  { time: '21:00', title: '美联储沃勒、雷曼等委员对货币政策答疑', importance: '★★★★☆', status: '未公布', preview: '政策口径寻踪，寻找下半年降息坐标', impact: '流动性突变' }
];

export function NewsAggregator() {
  const [news, setNews] = useState<NewsItem[]>(INITIAL_NEWS);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);
  const [isAiExpanded, setIsAiExpanded] = useState<boolean>(true);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState<boolean>(true);

  const filterCategories = [
    { id: 'all', label: '全部资讯', count: news.length },
    { id: 'macro', label: '宏观大势', count: news.filter(n => n.category === 'macro').length },
    { id: 'announcement', label: '个股公告', count: news.filter(n => n.category === 'announcement').length },
    { id: 'risk', label: '风控与舆情', count: news.filter(n => n.category === 'risk').length },
    { id: 'funds', label: '主力异动', count: news.filter(n => n.category === 'funds').length }
  ];

  const filteredNews = news.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.source.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="p-6 lg:p-8 max-w-[1600px] mx-auto text-neutral-300 flex flex-col h-full overflow-hidden"
    >
      {/* Real-time Ticker */}
      <div className="w-full bg-indigo-500/5 min-h-[38px] border border-indigo-500/10 rounded-xl px-4 flex items-center justify-between mb-6 overflow-hidden relative group">
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#050505] to-transparent pointer-events-none z-10" />
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#050505] to-transparent pointer-events-none z-10" />
        <div className="flex gap-1.5 items-center bg-indigo-600/20 px-2.5 py-0.5 rounded text-[10px] font-mono tracking-widest text-indigo-400 border border-indigo-500/20 relative z-20 flex-shrink-0 animate-pulse">
          <Flame className="w-3.5 h-3.5" /> HOT
        </div>
        
        <div className="flex-1 overflow-hidden relative mx-6 flex items-center">
          <div className="animate-[marquee_25s_linear_infinite] whitespace-nowrap flex gap-12 text-[11px] font-mono font-medium text-neutral-400">
            <span className="flex items-center gap-2">恒生指数 19,252.12 <span className="text-emerald-500 flex items-center"><ArrowDownRight className="w-3 h-3" /> -0.34%</span></span>
            <span className="flex items-center gap-2">沪深300 3,654.40 <span className="text-rose-500 flex items-center"><ArrowUpRight className="w-3 h-3" /> +0.48%</span></span>
            <span className="flex items-center gap-2">美债10年期 4.425% <span className="text-rose-500 flex items-center"><ArrowUpRight className="w-3 h-3" /> +0.035</span></span>
            <span className="flex items-center gap-2">贵州茅台 1,513.48 <span className="text-rose-500 flex items-center"><ArrowUpRight className="w-3 h-3" /> +0.39%</span></span>
            <span className="flex items-center gap-2">大基金三期3440亿 <span className="text-yellow-400 px-1 rounded bg-yellow-400/10 border border-yellow-400/20 font-sans font-normal text-[9px]">超级事件</span></span>
            <span className="flex items-center gap-2">黄金（盎司） 2,425.80 <span className="text-emerald-500 flex items-center"><ArrowDownRight className="w-3 h-3" /> -0.15%</span></span>
          </div>
        </div>

        <div className="text-[10px] font-mono text-neutral-500 flex-shrink-0 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> 终端已同步
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0 overflow-hidden">
        {/* News Feed - Takes 2 Columns */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          
          {/* Header Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-display font-medium text-white flex items-center gap-3">
                <Newspaper className="w-6.5 h-6.5 text-indigo-400" />
                数据源终端聚合
              </h2>
              <p className="text-xs text-neutral-500 mt-1.5 font-mono">整合高净值新闻通讯社、交易所信披、宏观研报与另类舆情多维数据通道。</p>
            </div>

            {/* Simple Search */}
            <div className="relative w-full md:w-64 max-w-sm">
              <input
                type="text"
                placeholder="搜索重要标题或要素..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.02] border border-white-5 focus:border-indigo-500/50 focus:outline-none rounded-xl py-2 pl-9 pr-4 text-xs text-neutral-200 placeholder:text-neutral-500 transition-all font-sans"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
            </div>
          </div>

          {/* Categories Pill Scroller */}
          <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar flex-shrink-0">
            {filterCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
                  selectedCategory === cat.id 
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]" 
                    : "bg-white/[0.02] border-white/5 text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                )}
              >
                {cat.label}
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md font-mono text-[9px] font-bold",
                  selectedCategory === cat.id ? "bg-indigo-700 text-indigo-100" : "bg-white/5 text-neutral-500"
                )}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* Main Feed Container */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar bg-black/10 rounded-2xl border border-white/5 p-4 relative min-h-0">
            <AnimatePresence mode="popLayout">
              {filteredNews.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="h-full flex flex-col justify-center items-center text-center p-8 text-neutral-500 font-mono text-xs gap-3"
                >
                  <Filter className="w-10 h-10 text-neutral-600 animate-pulse" />
                  未能检索到包含关键字 "{searchQuery}" 的核心公告或数据，请重置过滤项
                </motion.div>
              ) : (
                filteredNews.map((item, idx) => {
                  const isCurSelected = selectedArticle?.id === item.id;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      onClick={() => setSelectedArticle(item)}
                      className={cn(
                        "p-4 mb-4 rounded-xl border transition-all cursor-pointer flex gap-4 relative group",
                        isCurSelected 
                          ? "bg-indigo-500/10 border-indigo-500/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" 
                          : "bg-white/[0.01] border-white/5 hover:border-white/15 hover:bg-white/[0.03]"
                      )}
                    >
                      {/* Left Badge Indicator Column */}
                      <div className="flex flex-col gap-2 items-center flex-shrink-0 w-12 text-center border-r border-white/5 pr-3">
                        <span className="text-xs font-mono font-medium text-neutral-400 group-hover:text-neutral-300">{item.time}</span>
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          item.severity === 'high' ? "bg-rose-500 animate-[pulse_1.5s_infinite] shadow-[0_0_8px_rgb(244,63,94)]" : "bg-neutral-500"
                        )} />
                        
                        <div className={cn(
                          "text-[9px] font-mono uppercase px-1 py-0.5 rounded-sm shrink-0 border mt-1",
                          item.sentiment === 'bullish' ? 'bg-rose-950/20 border-rose-500/20 text-rose-400' :
                          item.sentiment === 'bearish' ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400' :
                          'bg-neutral-900 border-white/5 text-neutral-500'
                        )}>
                          {item.sentiment === 'bullish' ? '利好' : item.sentiment === 'bearish' ? '偏空' : '中性'}
                        </div>
                      </div>

                      {/* Title / Description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="text-[10px] uppercase font-mono font-bold tracking-wider rounded px-1.5 py-0.5 bg-white/5 border border-white/10 text-indigo-400">
                            {item.source}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500 flex items-center gap-1">
                            影响因子: <span className={cn(
                              "font-bold",
                              item.impactScore >= 80 ? "text-rose-400" : "text-indigo-400"
                            )}>{item.impactScore}%</span>
                          </span>
                        </div>
                        <h3 className="text-sm text-neutral-100 font-medium leading-relaxed group-hover:text-indigo-300 transition-colors mb-1.5">
                          {item.title}
                        </h3>
                        <p className="text-xs text-neutral-400 leading-relaxed max-w-3xl line-clamp-2">
                          {item.content}
                        </p>
                      </div>

                      {/* Right subtle arrow */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 group-hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Dynamic Detail Panel / Calendar Right Column */}
        <div className="flex flex-col gap-6 h-full min-h-0 overflow-hidden">
          
          {/* Main Top Drawer: AI News Smart Analyzer */}
          <div className={cn(
            "bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col relative overflow-hidden transition-all duration-300 shadow-lg",
            isAiExpanded ? "flex-[3] min-h-[220px]" : "h-[64px] flex-shrink-0"
          )}>
            <div className="absolute top-0 left-0 right-0 h-32 bg-indigo-500/10 blur-[40px] pointer-events-none" />
            
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5 select-none relative z-10 flex-shrink-0">
              <div 
                className="flex gap-2.5 items-center cursor-pointer group" 
                onClick={() => {
                  setIsAiExpanded(!isAiExpanded);
                  if (!isAiExpanded) setIsCalendarExpanded(true);
                }}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-all">
                  <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-200 group-hover:text-white transition-colors">AI 舆情深度透析</h3>
                  <p className="text-[9px] font-mono uppercase text-neutral-500 tracking-wider">Mouthpiece Semantic Engine</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsAiExpanded(!isAiExpanded);
                  if (!isAiExpanded) setIsCalendarExpanded(true);
                }}
                className="w-7 h-7 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition-all"
                title={isAiExpanded ? "折叠面板" : "展开面板"}
              >
                {isAiExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <div className={cn(
              "flex-1 overflow-y-auto custom-scrollbar relative z-10 text-xs text-neutral-400 leading-relaxed pr-1 transition-all duration-300 min-h-0",
              !isAiExpanded && "opacity-0 pointer-events-none scale-95"
            )}>
              <AnimatePresence mode="wait">
                {selectedArticle ? (
                  <motion.div 
                    key={selectedArticle.id}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="bg-black/30 border border-white/5 rounded-xl p-3">
                      <span className="text-[10px] uppercase font-mono text-neutral-500 block mb-1">选定信源</span>
                      <p className="text-xs text-neutral-200 font-medium">{selectedArticle.title}</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-neutral-300 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> 信能评估与关联变量
                      </h4>
                      <p className="text-xs text-neutral-400">
                        该情报经过交叉验证评级为 <strong className="text-white font-medium">高确信度</strong>，其直接作用于宏观估值模型的风险溢价部分。
                      </p>
                    </div>

                    <div className="space-y-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4">
                      <h4 className="font-semibold text-neutral-200 flex items-center gap-1.5 text-xs text-indigo-300">
                        <Sparkles className="w-3.5 h-3.5" /> AI 量化结论与逻辑归因
                      </h4>
                      <p className="text-xs leading-relaxed text-indigo-100 italic">
                        "{selectedArticle.aiSummary}"
                      </p>
                    </div>

                    <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-3 text-center">
                      <div className="p-2 bg-black/20 rounded-lg">
                        <span className="text-[10px] font-mono text-neutral-500 block">量化因子溢价</span>
                        <span className="text-xs font-mono font-medium text-rose-400">Alpha+1.24%</span>
                      </div>
                      <div className="p-2 bg-black/20 rounded-lg">
                        <span className="text-[10px] font-mono text-neutral-500 block">行业评级</span>
                        <span className="text-xs font-mono font-medium text-indigo-400">过度增持 (OW)</span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center text-center text-neutral-500 font-sans gap-2 py-8"
                  >
                    <Gauge className="w-8 h-8 text-neutral-600 animate-pulse" />
                    <p className="text-[11px]">请在左侧列表中点击单个新闻或情报公告，以启动大语言模型分析及投研归因评估。</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom Card: Economic Calendar (财经日历) */}
          <div className={cn(
            "bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col shadow-lg transition-all duration-300 overflow-hidden relative",
            isCalendarExpanded ? "flex-[2] min-h-[180px]" : "h-[64px] flex-shrink-0"
          )}>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5 select-none relative z-10 flex-shrink-0">
              <div 
                className="flex gap-2.5 items-center cursor-pointer group" 
                onClick={() => {
                  setIsCalendarExpanded(!isCalendarExpanded);
                  if (!isCalendarExpanded) setIsAiExpanded(true);
                }}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/20 transition-all">
                  <Calendar className="w-4.5 h-4.5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-200 group-hover:text-white transition-colors">海外财经及指标前瞻</h3>
                  <p className="text-[9px] font-mono uppercase text-neutral-500 tracking-wider">Macro Indicator Calendar</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsCalendarExpanded(!isCalendarExpanded);
                  if (!isCalendarExpanded) setIsAiExpanded(true);
                }}
                className="w-7 h-7 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition-all"
                title={isCalendarExpanded ? "折叠面板" : "展开面板"}
              >
                {isCalendarExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            
            <div className={cn(
              "flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 transition-all duration-300 min-h-0",
              !isCalendarExpanded && "opacity-0 pointer-events-none scale-95"
            )}>
              {CALENDAR_EVENTS.map((evt, i) => (
                <div key={i} className="bg-black/20 border border-white/5 p-2 px-3 rounded-lg flex flex-col hover:bg-neutral-900/40 transition-colors">
                  <div className="flex justify-between items-center mb-1 flex-wrap gap-2 text-[10px]">
                    <span className="font-mono text-neutral-500 font-medium">{evt.time}</span>
                    <span className="text-indigo-400 tracking-wider font-mono">{evt.importance}</span>
                    <span className={cn(
                      "px-1 py-0.5 rounded text-[8px] font-sans font-medium uppercase border",
                      evt.status === '已公布' 
                        ? 'bg-neutral-800 border-white/5 text-neutral-400' 
                        : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-450'
                    )}>{evt.status}</span>
                  </div>
                  <h4 className="text-xs text-neutral-200 font-medium line-clamp-1">{evt.title}</h4>
                  <div className="flex justify-between items-center text-[10px] mt-1 text-natural-500 leading-none">
                    <span className="text-neutral-500">{evt.preview}</span>
                    <span className="text-indigo-400 font-medium text-[9px]">{evt.impact}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
