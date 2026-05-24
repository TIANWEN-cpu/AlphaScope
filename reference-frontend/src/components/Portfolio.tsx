import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Briefcase, ArrowUpRight, ArrowDownRight, DollarSign } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const PORTFOLIO_DATA = [
  { name: 'US Equities', value: 40000, color: '#3b82f6' },
  { name: 'China A-Shares', value: 30000, color: '#10b981' },
  { name: 'Crypto Assets', value: 15000, color: '#8b5cf6' },
  { name: 'Cash', value: 15000, color: '#64748b' },
];

export function Portfolio() {
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
          Portfolio Overview
        </h2>
        <p className="text-sm font-mono text-neutral-500 mt-2">Real-time asset tracking managed by 户部 (Capital Allocation).</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-indigo-900/40 via-indigo-900/20 to-black/20 rounded-2xl p-6 shadow-xl relative overflow-hidden border border-indigo-500/20 backdrop-blur-md">
           <div className="absolute top-0 right-0 p-3 opacity-20 text-indigo-300 pointer-events-none">
             <DollarSign className="w-24 h-24 stroke-[0.5]" />
           </div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-indigo-400">Total Balance</h3>
          </div>
          <h2 className="text-4xl font-mono font-medium mb-3 text-white relative z-10">$100,000.00</h2>
          <p className="text-indigo-300 text-xs font-mono flex items-center gap-1 relative z-10">
            <ArrowUpRight className="w-3 h-3" /> +$2,450.00 (2.45%) Today
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 flex flex-col justify-center shadow-lg backdrop-blur-md">
           <h3 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Open Positions</h3>
           <h2 className="text-3xl font-mono font-medium text-neutral-100 mb-2">12</h2>
           <p className="text-[11px] font-mono text-emerald-400">8 Profitable, 4 Loss</p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 flex flex-col justify-center shadow-lg backdrop-blur-md">
           <h3 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Margin Utilization</h3>
           <h2 className="text-3xl font-mono font-medium text-neutral-100 mb-2">24%</h2>
           <p className="text-[11px] font-mono text-neutral-400">Safe Zone (Max 50%)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 shadow-lg backdrop-blur-md">
          <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-6 flex items-center gap-2 pb-3 border-b border-white/5">Asset Allocation</h3>
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={PORTFOLIO_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {PORTFOLIO_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }}
                  itemStyle={{ color: '#e5e5e5' }}
                  formatter={(value: number) => `$${value.toLocaleString()}`}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-1/2 ml-4">
              {PORTFOLIO_DATA.map(item => (
                <div key={item.name} className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2 text-xs font-sans">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span className="text-neutral-400">{item.name}</span>
                  </div>
                  <span className="text-xs font-mono text-neutral-200">${item.value/1000}k</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-0 flex flex-col shadow-lg overflow-hidden backdrop-blur-md">
          <div className="p-5 border-b border-white/5 bg-black/40">
            <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 flex items-center gap-2">Recent Trades</h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
             <table className="w-full text-left border-collapse">
               <thead className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase bg-black/20 border-b border-white/5">
                 <tr>
                   <th className="py-3 px-5">Asset</th>
                   <th className="py-3 px-5">Type</th>
                   <th className="py-3 px-5 text-right">Price</th>
                   <th className="py-3 px-5 text-right">PnL</th>
                 </tr>
               </thead>
               <tbody className="text-xs">
                 {[
                   { asset: 'AAPL', type: 'Buy', price: '$170.20', pnl: '+$450', isWin: true },
                   { asset: 'BTC', type: 'Sell', price: '$64,200', pnl: '+$1,200', isWin: true },
                   { asset: 'TSLA', type: 'Buy', price: '$220.50', pnl: '-$120', isWin: false },
                   { asset: 'GOOG', type: 'Sell', price: '$140.10', pnl: '+$50', isWin: true },
                   { asset: 'MSFT', type: 'Buy', price: '$410.00', pnl: '-$30', isWin: false },
                 ].map((trade, i) => (
                   <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                     <td className="py-3.5 px-5 font-mono font-medium text-neutral-200">{trade.asset}</td>
                     <td className="py-3.5 px-5">
                       <span className={cn(
                         "px-2 py-0.5 rounded text-[10px] font-mono uppercase border",
                         trade.type === 'Buy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
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
                 ))}
               </tbody>
             </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
