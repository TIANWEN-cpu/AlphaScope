"use client";

import { useState } from "react";
import {
  Link2,
  Bookmark,
  Cpu,
  TrendingUp,
  Newspaper,
  Coins,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";

type Pillar = "fundamental" | "quant" | "sentiment" | "liquidity";

interface EvidenceNode {
  id: string;
  title: string;
  pillar: Pillar;
  weight: number;
  source: string;
  time: string;
  content: string;
  verifiedBy: string;
  status: "verified" | "pending" | "contradicted";
}

const PILLAR_CONFIG: Record<Pillar, { label: string; color: string; bgColor: string; borderColor: string; icon: typeof TrendingUp }> = {
  fundamental: { label: "基本面", color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20", icon: TrendingUp },
  quant: { label: "量化", color: "text-purple-400", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/20", icon: Cpu },
  sentiment: { label: "舆情", color: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20", icon: Newspaper },
  liquidity: { label: "资金流", color: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20", icon: Coins },
};

const MOCK_EVIDENCE: EvidenceNode[] = [
  {
    id: "1",
    title: "毛利率高居 91.8% 上游绝对议价权",
    pillar: "fundamental",
    weight: 9,
    source: "贵州茅台 2026-Q1 季度财报",
    time: "2026-05-22 17:30",
    content: "最新销售净利润率达 51.2% 历史同期高点位，主营现金返流比超 120%，确定为一级核心护城河论证。",
    verifiedBy: "基本面分析助手",
    status: "verified",
  },
  {
    id: "2",
    title: "MA5 均线上穿 MA10 均线确立技术金叉",
    pillar: "quant",
    weight: 7,
    source: "行情多周期量价归因指标",
    time: "2026-05-23 12:44",
    content: "自 1460 阶段重底盘起稳后，高频均线呈多头排列回归，MACD 零轴下方底背离指标双针探底金叉抬升。",
    verifiedBy: "量化策略专家",
    status: "verified",
  },
  {
    id: "3",
    title: "大基金三期 3440 亿落地促发情绪底托盘",
    pillar: "sentiment",
    weight: 8,
    source: "大基金三期落地事件舆情监测",
    time: "2026-05-23 14:30",
    content: "万亿级别国家资金底座催化，成功逆转此前低迷不振的流动性挤压，风险溢价因风险偏好骤升而降低。",
    verifiedBy: "宏观趋势分析师",
    status: "verified",
  },
  {
    id: "4",
    title: "北向资金连续四日单边净买入",
    pillar: "liquidity",
    weight: 8,
    source: "交易所盘末北上主板跨境透视",
    time: "2026-05-23 15:10",
    content: "外资连续四个交易日单边净买入，累计净流入超 42 亿元，显示国际配置型资金对估值修复的共识。",
    verifiedBy: "资金面分析师",
    status: "verified",
  },
  {
    id: "5",
    title: "直销占比提升至 44.1%",
    pillar: "fundamental",
    weight: 8,
    source: "直销配额去化数据监测研报",
    time: "2026-05-23 10:15",
    content: "相比传统代理商层级，直销配额每吨多释放逾 30% 附加值。直营商城活跃付费买家超历史均值高限。",
    verifiedBy: "基本面分析助手",
    status: "verified",
  },
  {
    id: "6",
    title: "RSI 超卖区间反弹信号确认",
    pillar: "quant",
    weight: 6,
    source: "RSI(14) 技术指标",
    time: "2026-05-23 13:00",
    content: "RSI(14) 从 28 超卖区间反弹至 45，配合成交量放大，确认短期反弹动能。",
    verifiedBy: "量化策略专家",
    status: "pending",
  },
];

export function EvidenceChainView() {
  const [filter, setFilter] = useState<Pillar | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filteredEvidence = filter === "all" ? MOCK_EVIDENCE : MOCK_EVIDENCE.filter((e) => e.pillar === filter);

  const pillarStats = Object.entries(PILLAR_CONFIG).map(([key, config]) => {
    const items = MOCK_EVIDENCE.filter((e) => e.pillar === key);
    const avgWeight = items.length > 0 ? items.reduce((sum, e) => sum + e.weight, 0) / items.length : 0;
    return { ...config, key: key as Pillar, count: items.length, avgWeight };
  });

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-medium text-neutral-100 flex items-center gap-3">
          <Link2 className="w-6 h-6 text-indigo-500" />
          投研逻辑证据链
        </h2>
        <p className="text-sm font-mono text-neutral-500 mt-1">多维度证据聚合与交叉验证</p>
      </div>

      {/* Pillar Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {pillarStats.map((p) => (
          <button
            key={p.key}
            onClick={() => setFilter(filter === p.key ? "all" : p.key)}
            className={`glass rounded-xl p-4 text-left transition-all duration-300 ${
              filter === p.key ? "border-indigo-500/50 glow-indigo" : "glass-hover"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <p.icon className={`w-4 h-4 ${p.color}`} />
              <span className="text-[10px] font-mono uppercase text-neutral-500">{p.label}</span>
            </div>
            <div className="text-lg font-mono text-neutral-200">{p.count} 条</div>
            <div className="text-[10px] font-mono text-neutral-500">平均权重 {p.avgWeight.toFixed(1)}/10</div>
          </button>
        ))}
      </div>

      {/* Evidence List */}
      <div className="space-y-4">
        {filteredEvidence.map((e, i) => {
          const config = PILLAR_CONFIG[e.pillar];
          const isExpanded = expanded === e.id;

          return (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : e.id)}
                className="w-full p-5 text-left flex items-start gap-4 hover:bg-white/[0.02] transition-colors"
              >
                {/* Pillar Badge */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${config.bgColor} border ${config.borderColor} flex items-center justify-center`}>
                  <config.icon className={`w-5 h-5 ${config.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-neutral-200 truncate">{e.title}</h4>
                    {e.status === "verified" && <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                    {e.status === "pending" && <HelpCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                    {e.status === "contradicted" && <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-500">
                    <span>{e.source}</span>
                    <span>{e.time}</span>
                  </div>
                </div>

                {/* Weight Bar */}
                <div className="flex-shrink-0 w-20">
                  <div className="text-[10px] font-mono text-neutral-500 text-right mb-1">权重 {e.weight}/10</div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${e.weight * 10}%` }}
                    />
                  </div>
                </div>

                <ChevronRight className={`w-4 h-4 text-neutral-500 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-5 pb-5 border-t border-white/5"
                >
                  <div className="pt-4">
                    <p className="text-sm text-neutral-400 leading-relaxed">{e.content}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
                      <span>验证者:</span>
                      <span className="text-indigo-400">{e.verifiedBy}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
