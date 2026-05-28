import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { Briefcase, ArrowUpRight, DollarSign, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { api, FundPortfolio, FundPortfolioHolding } from '../lib/api';
import { SafeResponsiveContainer } from './SafeResponsiveContainer';

interface PortfolioProps {
  symbol?: string;
  stockName?: string;
}

interface PortfolioSlice {
  name: string;
  code: string;
  value: number;
  weight: number;
  color: string;
}

interface HoldingRow {
  asset: string;
  type: string;
  price: string;
  pnl: string;
  isWin: boolean;
}

const PORTFOLIO_DATA: PortfolioSlice[] = [
  { name: '华夏成长混合', code: '000001', value: 40000, weight: 0.4, color: '#3b82f6' },
  { name: '易方达消费行业股票', code: '110022', value: 30000, weight: 0.3, color: '#10b981' },
  { name: '广发稳健增长混合', code: '270002', value: 15000, weight: 0.15, color: '#8b5cf6' },
  { name: '现金仓位', code: 'CASH', value: 15000, weight: 0.15, color: '#64748b' },
];

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f43f5e', '#f59e0b', '#64748b'];

const toPortfolioSlice = (
  holding: FundPortfolioHolding,
  index: number,
  portfolioTotal?: number | null,
): PortfolioSlice => {
  const weight = Number(holding.actual_weight ?? holding.weight ?? 0);
  const value = Number(
    holding.current_value ?? (portfolioTotal && weight ? portfolioTotal * weight : weight * 100000),
  );
  return {
    name: holding.fund_name || holding.fund_code || `Holding ${index + 1}`,
    code: holding.fund_code || `H${index + 1}`,
    value: Number.isFinite(value) ? value : 0,
    weight: Number.isFinite(weight) ? weight : 0,
    color: COLORS[index % COLORS.length],
  };
};

const toHoldingRows = (items: PortfolioSlice[]): HoldingRow[] =>
  items.slice(0, 6).map(item => ({
    asset: item.code,
    type: 'Hold',
    price: `¥${item.value.toLocaleString()}`,
    pnl: `${(item.weight * 100).toFixed(1)}%`,
    isWin: true,
  }));

export function Portfolio(_props: PortfolioProps) {
  const [portfolioData, setPortfolioData] = useState<PortfolioSlice[]>([]);
  const [statusText, setStatusText] = useState('正在同步后端基金组合...');
  const [portfolioCount, setPortfolioCount] = useState(0);
  const [hasBackendHoldings, setHasBackendHoldings] = useState(false);
  const [showingLocalSample, setShowingLocalSample] = useState(false);
  const [backendTotalValue, setBackendTotalValue] = useState<number | null>(null);
  const [recentTrades, setRecentTrades] = useState<HoldingRow[]>([]);

  const totalValue = backendTotalValue ?? portfolioData.reduce((sum, item) => sum + item.value, 0);
  const maxAllocation = Math.max(...portfolioData.map(item => item.value / Math.max(totalValue, 1)), 0);

  const loadPortfolios = async () => {
    const result = await api.fundPortfolios();
    if (result.success && result.data?.portfolios?.length) {
      const portfolio: FundPortfolio = result.data.portfolios[0];
      const holdings = portfolio.holdings || [];
      if (holdings.length) {
        const mapped = holdings.map((holding, index) => toPortfolioSlice(holding, index, portfolio.total_value));
        setPortfolioData(mapped);
        setRecentTrades(toHoldingRows(mapped));
        setBackendTotalValue(portfolio.total_value ?? null);
        setHasBackendHoldings(true);
        setShowingLocalSample(false);
        setStatusText(`已接入后端基金组合：${portfolio.name || '默认组合'}`);
      } else {
        setPortfolioData(PORTFOLIO_DATA);
        setRecentTrades(toHoldingRows(PORTFOLIO_DATA));
        setBackendTotalValue(null);
        setHasBackendHoldings(false);
        setShowingLocalSample(true);
        setStatusText(`后端组合 ${portfolio.name || '默认组合'} 暂无持仓；当前显示本地预览样例，未写入后端。`);
      }
      setPortfolioCount(result.data.total || result.data.portfolios.length);
    } else {
      setPortfolioData(PORTFOLIO_DATA);
      setRecentTrades(toHoldingRows(PORTFOLIO_DATA));
      setBackendTotalValue(null);
      setHasBackendHoldings(false);
      setShowingLocalSample(true);
      setPortfolioCount(0);
      setStatusText(result.error || '后端暂无基金组合；当前显示本地预览样例，未写入后端。');
    }
  };

  useEffect(() => {
    loadPortfolios();
  }, []);

  const createDemoPortfolio = async () => {
    setStatusText('正在创建示例基金组合...');
    const result = await api.fundPortfolioCreate({
      name: '示例基金组合',
      description: '由前端 Portfolio 页面创建的示例基金组合，可在后端持久化。',
      holdings: [
        { fund_code: '000001', fund_name: '华夏成长混合', current_value: 40000, weight: 0.4, actual_weight: 0.4 },
        { fund_code: '110022', fund_name: '易方达消费行业股票', current_value: 35000, weight: 0.35, actual_weight: 0.35 },
        { fund_code: 'CASH', fund_name: '现金仓位', current_value: 25000, weight: 0.25, actual_weight: 0.25 },
      ],
    });
    if (result.success) {
      setStatusText('示例基金组合已写入后端，正在刷新...');
      await loadPortfolios();
    } else {
      setStatusText(result.error || '示例基金组合创建失败');
    }
  };

  const loadLocalSample = () => {
    setPortfolioData(PORTFOLIO_DATA);
    setRecentTrades(toHoldingRows(PORTFOLIO_DATA));
    setBackendTotalValue(null);
    setHasBackendHoldings(false);
    setShowingLocalSample(true);
    setStatusText('已载入本地样例组合，仅用于界面演示，未写入后端。');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="p-6 lg:p-10 max-w-7xl mx-auto h-full overflow-y-auto"
    >
      <div className="mb-10">
        <h2 className="text-2xl font-display font-medium text-neutral-100 flex items-center gap-3">
          <Briefcase className="w-6 h-6 text-indigo-500" />
          基金组合概览
        </h2>
        <p className="text-sm font-mono text-neutral-500 mt-2">{statusText}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-indigo-900/40 via-indigo-900/20 to-black/20 rounded-2xl p-6 shadow-xl relative overflow-hidden border border-indigo-500/20 backdrop-blur-md">
           <div className="absolute top-0 right-0 p-3 opacity-20 text-indigo-300 pointer-events-none">
             <DollarSign className="w-24 h-24 stroke-[0.5]" />
           </div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-indigo-400">组合总市值</h3>
          </div>
          <h2 className="text-4xl font-mono font-medium mb-3 text-white relative z-10">¥{totalValue.toLocaleString()}</h2>
          <p className="text-indigo-300 text-xs font-mono flex items-center gap-1 relative z-10">
            <ArrowUpRight className="w-3 h-3" /> {showingLocalSample ? '本地样例估值' : hasBackendHoldings ? '后端基金组合估值' : '暂无后端持仓'}
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 flex flex-col justify-center shadow-lg backdrop-blur-md">
           <h3 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">持仓数量</h3>
           <h2 className="text-3xl font-mono font-medium text-neutral-100 mb-2">{portfolioData.length}</h2>
           <p className="text-[11px] font-mono text-emerald-400">后端组合数：{portfolioCount}</p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 flex flex-col justify-center shadow-lg backdrop-blur-md">
           <h3 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">最大单项占比</h3>
           <h2 className="text-3xl font-mono font-medium text-neutral-100 mb-2">{Math.round(maxAllocation * 100)}%</h2>
           <p className="text-[11px] font-mono text-neutral-400">最大单项配置占比</p>
        </div>
      </div>

      {!hasBackendHoldings && (
        <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="flex-1 text-xs text-neutral-400">
            后端没有可用持仓时，页面会显示本地预览样例，避免整页空白。可以写入一个示例组合，让后端持久化真实测试数据。
          </p>
          <button onClick={createDemoPortfolio} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold border border-indigo-500 flex items-center gap-2">
            <Plus className="w-4 h-4" /> 创建示例基金组合
          </button>
          <button onClick={loadLocalSample} className="px-5 py-2.5 rounded-xl bg-yellow-400/10 hover:bg-yellow-400/15 text-yellow-300 text-xs font-semibold border border-yellow-400/20">
            {showingLocalSample ? '刷新本地预览' : '仅预览本地样例'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 shadow-lg backdrop-blur-md">
          <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-6 flex items-center gap-2 pb-3 border-b border-white/5">基金配置</h3>
          <div className="h-64 flex items-center">
            {portfolioData.length ? (
              <SafeResponsiveContainer className="h-full w-full min-w-0" minHeight={256}>
                <PieChart>
                  <Pie
                    data={portfolioData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {portfolioData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }}
                    itemStyle={{ color: '#e5e5e5' }}
                    formatter={(value: number) => `¥${value.toLocaleString()}`}
                  />
                </PieChart>
              </SafeResponsiveContainer>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl border border-white/5 bg-black/20 px-6 text-center text-xs text-neutral-500">
                暂无后端持仓，未绘制配置图。
              </div>
            )}
            <div className="w-1/2 ml-4">
              {portfolioData.map(item => (
                <div key={item.name} className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2 text-xs font-sans">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span className="text-neutral-400">{item.name}</span>
                  </div>
                  <span className="text-xs font-mono text-neutral-200">¥{(item.value/1000).toFixed(1)}k</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-0 flex flex-col shadow-lg overflow-hidden backdrop-blur-md">
          <div className="p-5 border-b border-white/5 bg-black/40">
            <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 flex items-center gap-2">基金持仓列表</h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
             <table className="w-full text-left border-collapse">
               <thead className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase bg-black/20 border-b border-white/5">
                 <tr>
                   <th className="py-3 px-5">代码</th>
                   <th className="py-3 px-5">状态</th>
                   <th className="py-3 px-5 text-right">市值</th>
                   <th className="py-3 px-5 text-right">占比</th>
                 </tr>
               </thead>
               <tbody className="text-xs">
                 {recentTrades.length ? recentTrades.map((trade, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                     <td className="py-3.5 px-5 font-mono font-medium text-neutral-200">{trade.asset}</td>
                     <td className="py-3.5 px-5">
                       <span className={cn(
                         "px-2 py-0.5 rounded text-[10px] font-mono uppercase border",
                         trade.type === 'Hold' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                       )}>
                         {trade.type}
                       </span>
                     </td>
                     <td className="py-3.5 px-5 text-neutral-400 font-mono text-right">{trade.price}</td>
                     <td className={cn(
                       "py-3.5 px-5 text-right font-mono font-medium",
                       trade.isWin ? "text-emerald-500" : "text-rose-500"
                     )}>
                       {trade.pnl}
                     </td>
                   </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="py-10 px-5 text-center text-xs text-neutral-500">
                        暂无后端持仓记录。
                      </td>
                    </tr>
                  )}
               </tbody>
             </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
