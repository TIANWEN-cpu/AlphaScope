"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Link2,
  Cpu,
  TrendingUp,
  Newspaper,
  Coins,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Pillar = "fundamental" | "quant" | "sentiment" | "liquidity" | "default";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  pillar: Pillar;
  color: string;
  confidence: number;
  source: string;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

const PILLAR_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: typeof TrendingUp }> = {
  fundamental: { label: "基本面", color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20", icon: TrendingUp },
  quant: { label: "量化", color: "text-purple-400", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/20", icon: Cpu },
  sentiment: { label: "舆情", color: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20", icon: Newspaper },
  liquidity: { label: "资金流", color: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20", icon: Coins },
  default: { label: "其他", color: "text-neutral-400", bgColor: "bg-neutral-500/10", borderColor: "border-neutral-500/20", icon: HelpCircle },
};

// Demo evidence for initial display
const DEMO_EVIDENCE = [
  { id: "ev1", title: "毛利率高居 91.8%", evidence_type: "fundamental", confidence: 0.9, source: "财报", symbols: ["600519"], claim: "茅台营收增长强劲" },
  { id: "ev2", title: "MA5 上穿 MA10 金叉", evidence_type: "price", confidence: 0.7, source: "行情数据", symbols: ["600519"], claim: "技术面看多信号" },
  { id: "ev3", title: "北向资金连续净买入", evidence_type: "fund_flow", confidence: 0.8, source: "交易所", symbols: ["600519"], claim: "外资持续看好" },
  { id: "ev4", title: "消费刺激政策出台", evidence_type: "news", confidence: 0.6, source: "新闻", symbols: [], claim: "政策利好消费板块" },
  { id: "ev5", title: "RSI 超卖反弹信号", evidence_type: "price", confidence: 0.5, source: "技术指标", symbols: ["600519"], claim: "短期反弹动能确认" },
];

export function EvidenceChainView() {
  const [filter, setFilter] = useState<Pillar | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(false);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/evidence/chain/graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidence: DEMO_EVIDENCE }),
      });
      const data = await res.json();
      if (data.success) {
        setNodes(data.data.nodes);
        setEdges(data.data.edges);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  const filteredNodes = filter === "all" ? nodes : nodes.filter((n) => n.pillar === filter);

  const pillarStats = Object.entries(PILLAR_CONFIG)
    .filter(([key]) => key !== "default")
    .map(([key, config]) => {
      const items = nodes.filter((n) => n.pillar === key);
      const avgConf = items.length > 0 ? items.reduce((sum, n) => sum + n.confidence, 0) / items.length : 0;
      return { ...config, key, count: items.length, avgConf };
    });

  const statusIcon = (confidence: number) => {
    if (confidence >= 0.7) return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    if (confidence >= 0.4) return <HelpCircle className="w-4 h-4 text-amber-400" />;
    return <AlertTriangle className="w-4 h-4 text-red-400" />;
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto h-full overflow-y-auto custom-scrollbar">
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
            onClick={() => setFilter(filter === p.key ? "all" : p.key as Pillar)}
            className={`glass rounded-xl p-4 text-left transition-all duration-300 ${
              filter === p.key ? "border-indigo-500/50 glow-indigo" : "glass-hover"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <p.icon className={`w-4 h-4 ${p.color}`} />
              <span className="text-[10px] font-mono uppercase text-neutral-500">{p.label}</span>
            </div>
            <div className="text-lg font-mono text-neutral-200">{p.count} 条</div>
            <div className="text-[10px] font-mono text-neutral-500">置信度 {(p.avgConf * 100).toFixed(0)}%</div>
          </button>
        ))}
      </div>

      {/* Graph Summary */}
      <div className="glass rounded-xl p-4 mb-6 flex items-center gap-6">
        <div className="text-xs font-mono text-neutral-500">
          节点: <span className="text-neutral-200">{nodes.length}</span>
        </div>
        <div className="text-xs font-mono text-neutral-500">
          关联边: <span className="text-neutral-200">{edges.length}</span>
        </div>
        {loading && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
      </div>

      {/* Evidence List */}
      <div className="space-y-4">
        {filteredNodes.map((node, i) => {
          const config = PILLAR_CONFIG[node.pillar] || PILLAR_CONFIG.default;
          const Icon = config.icon;
          const isExpanded = expanded === node.id;
          const connectedEdges = edges.filter((e) => e.source === node.id || e.target === node.id);

          return (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : node.id)}
                className="w-full p-5 text-left flex items-start gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${config.bgColor} border ${config.borderColor} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-neutral-200 truncate">{node.label}</h4>
                    {statusIcon(node.confidence)}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-500">
                    <span>{node.source}</span>
                    <span>{node.type}</span>
                    {connectedEdges.length > 0 && (
                      <span className="text-indigo-400">{connectedEdges.length} 条关联</span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 w-20">
                  <div className="text-[10px] font-mono text-neutral-500 text-right mb-1">
                    置信度 {(node.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${node.confidence * 100}%` }}
                    />
                  </div>
                </div>

                <ChevronRight className={`w-4 h-4 text-neutral-500 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
              </button>

              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="px-5 pb-5 border-t border-white/5"
                >
                  <div className="pt-4">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-neutral-500">分类: </span>
                        <span className={config.color}>{config.label}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500">来源: </span>
                        <span className="text-neutral-300">{node.source}</span>
                      </div>
                    </div>
                    {connectedEdges.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[10px] font-mono text-neutral-500 mb-1">关联证据:</div>
                        {connectedEdges.map((edge, j) => {
                          const otherId = edge.source === node.id ? edge.target : edge.source;
                          const other = nodes.find((n) => n.id === otherId);
                          return (
                            <div key={j} className="text-xs text-indigo-400">
                              → {other?.label || otherId} (权重 {edge.weight.toFixed(2)})
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
        {filteredNodes.length === 0 && !loading && (
          <div className="glass rounded-xl p-8 text-center">
            <Link2 className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">暂无证据数据</p>
          </div>
        )}
      </div>
    </div>
  );
}
