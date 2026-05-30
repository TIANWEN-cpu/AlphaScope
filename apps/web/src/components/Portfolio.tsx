import type { ComponentType } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Briefcase, Landmark, ShieldCheck, WalletCards } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const ALLOCATION_DATA = [
  { name: '核心白马', value: 380000, color: '#f43f5e' },
  { name: '新能源成长', value: 260000, color: '#6366f1' },
  { name: '金融地产', value: 210000, color: '#14b8a6' },
  { name: '现金/逆回购', value: 150000, color: '#64748b' },
];

const POSITION_DATA = [
  { symbol: '600519.SH', name: '贵州茅台', sector: '白酒', weight: 18.4, cost: 1632.5, price: 1721.2, pnl: 5.43, risk: '中' },
  { symbol: '300750.SZ', name: '宁德时代', sector: '新能源电池', weight: 15.2, cost: 198.4, price: 206.1, pnl: 3.88, risk: '中高' },
  { symbol: '600036.SH', name: '招商银行', sector: '银行', weight: 11.8, cost: 33.2, price: 34.6, pnl: 4.22, risk: '低' },
  { symbol: '300059.SZ', name: '东方财富', sector: '互联网券商', weight: 9.6, cost: 16.4, price: 15.9, pnl: -3.05, risk: '中高' },
  { symbol: '601318.SH', name: '中国平安', sector: '保险', weight: 8.7, cost: 47.1, price: 48.3, pnl: 2.55, risk: '中' },
];

const TRADE_LOG = [
  { asset: '贵州茅台', symbol: '600519.SH', type: '买入', price: '¥1,721.20', pnl: '+¥8,860', isWin: true, reason: '核心仓回补' },
  { asset: '东方财富', symbol: '300059.SZ', type: '卖出', price: '¥15.89', pnl: '-¥2,430', isWin: false, reason: '券商情绪降温' },
  { asset: '宁德时代', symbol: '300750.SZ', type: '买入', price: '¥206.10', pnl: '+¥5,120', isWin: true, reason: '产业链景气修复' },
  { asset: '中国平安', symbol: '601318.SH', type: '减仓', price: '¥48.31', pnl: '+¥1,960', isWin: true, reason: '行业暴露再平衡' },
];

const RISK_BUCKETS = [
  { bucket: '白酒', exposure: 18.4, limit: 25 },
  { bucket: '新能源', exposure: 24.7, limit: 30 },
  { bucket: '金融', exposure: 20.5, limit: 35 },
  { bucket: 'TMT', exposure: 12.3, limit: 25 },
];

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 0,
});

function SummaryCard({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'rose' | 'emerald' | 'indigo' | 'neutral';
  icon: ComponentType<{ className?: string }>;
}) {
  const color = {
    rose: 'text-rose-400',
    emerald: 'text-emerald-400',
    indigo: 'text-indigo-300',
    neutral: 'text-neutral-300',
  }[tone];

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 shadow-lg backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">{label}</h3>
        <Icon className={cn('h-5 w-5', color)} />
      </div>
      <h2 className="text-3xl font-mono font-medium text-neutral-100">{value}</h2>
      <p className={cn('mt-2 text-[11px] font-mono', color)}>{hint}</p>
    </div>
  );
}

export function Portfolio() {
  const totalAssets = ALLOCATION_DATA.reduce((sum, item) => sum + item.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="mx-auto h-full max-w-7xl overflow-y-auto p-6 lg:p-10"
    >
      <div className="mb-8">
        <h2 className="flex items-center gap-3 text-2xl font-display font-medium text-neutral-100">
          <Briefcase className="h-6 w-6 text-indigo-500" />
          组合与风控总览
        </h2>
        <p className="mt-2 text-sm font-mono text-neutral-500">面向 A 股研究组合的资产配置、持仓风险、调仓记录与行业暴露监控。</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-950/35 via-indigo-950/15 to-black/20 p-6 shadow-xl backdrop-blur-md md:col-span-2">
          <div className="pointer-events-none absolute right-0 top-0 p-3 text-rose-300 opacity-15">
            <WalletCards className="h-28 w-28 stroke-[0.5]" />
          </div>
          <h3 className="relative z-10 text-[10px] font-mono uppercase tracking-widest text-rose-300">总资产</h3>
          <h2 className="relative z-10 mt-4 text-4xl font-mono font-medium text-white">{currencyFormatter.format(totalAssets)}</h2>
          <p className="relative z-10 mt-3 flex items-center gap-1 text-xs font-mono text-rose-300">
            <ArrowUpRight className="h-3.5 w-3.5" />
            今日浮盈 +¥24,500（+2.45%）
          </p>
        </div>
        <SummaryCard label="持仓数量" value="12" hint="8 只盈利 / 4 只回撤" tone="emerald" icon={Landmark} />
        <SummaryCard label="风险占用" value="24%" hint="低于 50% 上限" tone="indigo" icon={ShieldCheck} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 shadow-lg backdrop-blur-md">
          <h3 className="mb-6 border-b border-white/5 pb-3 text-xs font-mono uppercase tracking-widest text-neutral-400">资产配置</h3>
          <div className="flex h-72 items-center">
            <ResponsiveContainer width="52%" height="100%">
              <PieChart>
                <Pie data={ALLOCATION_DATA} cx="50%" cy="50%" innerRadius={62} outerRadius={86} paddingAngle={4} dataKey="value" stroke="none">
                  {ALLOCATION_DATA.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#e5e5e5' }}
                  formatter={(value: number) => currencyFormatter.format(value)}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="ml-4 flex-1">
              {ALLOCATION_DATA.map((item) => (
                <div key={item.name} className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-neutral-400">{item.name}</span>
                  </div>
                  <span className="font-mono text-xs text-neutral-200">{currencyFormatter.format(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 shadow-lg backdrop-blur-md">
          <h3 className="mb-6 border-b border-white/5 pb-3 text-xs font-mono uppercase tracking-widest text-neutral-400">行业风险暴露</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={RISK_BUCKETS} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="bucket" stroke="#737373" fontSize={11} />
                <YAxis stroke="#737373" fontSize={11} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="limit" name="上限" fill="#334155" radius={[4, 4, 0, 0]} />
                <Bar dataKey="exposure" name="当前暴露" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] shadow-lg backdrop-blur-md lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/5 bg-black/40 p-5">
            <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400">核心持仓</h3>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-200">
              AI 生成，请核验来源与价格
            </span>
          </div>
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-white/5 bg-black/20 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              <tr>
                <th className="px-5 py-3">标的</th>
                <th className="px-5 py-3">行业</th>
                <th className="px-5 py-3 text-right">权重</th>
                <th className="px-5 py-3 text-right">成本</th>
                <th className="px-5 py-3 text-right">现价</th>
                <th className="px-5 py-3 text-right">浮盈亏</th>
                <th className="px-5 py-3 text-right">风险</th>
              </tr>
            </thead>
            <tbody>
              {POSITION_DATA.map((position) => (
                <tr key={position.symbol} className="border-b border-white/5 hover:bg-white/[0.025]">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-neutral-200">{position.name}</p>
                    <p className="mt-1 font-mono text-[10px] text-indigo-300">{position.symbol}</p>
                  </td>
                  <td className="px-5 py-3.5 text-neutral-400">{position.sector}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-neutral-300">{position.weight}%</td>
                  <td className="px-5 py-3.5 text-right font-mono text-neutral-400">¥{position.cost}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-neutral-200">¥{position.price}</td>
                  <td className={cn('px-5 py-3.5 text-right font-mono font-medium', position.pnl >= 0 ? 'text-rose-400' : 'text-emerald-400')}>
                    {position.pnl >= 0 ? '+' : ''}{position.pnl}%
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={cn('rounded-full border px-2 py-1 text-[10px]', position.risk === '低' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300')}>
                      {position.risk}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] shadow-lg backdrop-blur-md lg:col-span-2">
          <div className="border-b border-white/5 bg-black/40 p-5">
            <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400">近期调仓</h3>
          </div>
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-white/5 bg-black/20 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              <tr>
                <th className="px-5 py-3">标的</th>
                <th className="px-5 py-3">动作</th>
                <th className="px-5 py-3">原因</th>
                <th className="px-5 py-3 text-right">成交价</th>
                <th className="px-5 py-3 text-right">贡献</th>
              </tr>
            </thead>
            <tbody>
              {TRADE_LOG.map((trade) => (
                <tr key={`${trade.symbol}-${trade.type}`} className="border-b border-white/5 hover:bg-white/[0.025]">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-neutral-200">{trade.asset}</p>
                    <p className="mt-1 font-mono text-[10px] text-indigo-300">{trade.symbol}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn('rounded border px-2 py-0.5 text-[10px] font-mono', trade.type === '买入' ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300')}>
                      {trade.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-neutral-400">{trade.reason}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-neutral-400">{trade.price}</td>
                  <td className={cn('px-5 py-3.5 text-right font-mono font-medium', trade.isWin ? 'text-rose-400' : 'text-emerald-400')}>
                    {trade.isWin ? <ArrowUpRight className="mr-1 inline h-3.5 w-3.5" /> : <ArrowDownRight className="mr-1 inline h-3.5 w-3.5" />}
                    {trade.pnl}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed text-amber-100/80 lg:col-span-2">
          <div className="mb-1 flex items-center gap-2 font-medium text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            风险提示
          </div>
          组合页展示的是研究辅助视图，价格、盈亏与调仓原因需要与真实账户、券商成交回报和数据源证据链交叉核验。
        </div>
      </div>
    </motion.div>
  );
}
