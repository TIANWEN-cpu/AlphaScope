"use client";

import { useState } from "react";
import {
  FileText,
  Sparkles,
  Award,
  ChevronRight,
  CheckCircle,
  BookOpen,
  Download,
  AlertTriangle,
  TrendingUp,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TEMPLATES = [
  {
    id: "individual",
    name: "个股深度评级研报",
    desc: "包含宏观定位、深度报表分析及三因素量化诊股",
    icon: TrendingUp,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  {
    id: "industry",
    name: "行业及产业链专题报告",
    desc: "梳理上下游资本开支变化与库存周期的另类情报归纳",
    icon: BookOpen,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
  },
  {
    id: "risk",
    name: "黑天鹅情绪避险评估",
    desc: "侧重舆情违约风险、大股东股权质押及账外担保预警",
    icon: Shield,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
];

const GENERATION_STEPS = [
  { label: "多源信息收集", desc: "基本面 Agent 正从多方财经终端爬取财报与经营指标..." },
  { label: "历史量化回验", desc: "量化 Agent 计算因子协方差矩阵并回测多头溢价敞口..." },
  { label: "舆情与风险过滤", desc: "合规与舆情 Agent 分析全网社交、券商评级及政策偏差..." },
  { label: "智能排版与终审", desc: "专家圆桌交叉纠偏，渲染专业排版并输出投资逻辑评估..." },
];

export function ReportGeneratorView() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  const startGeneration = () => {
    setGenerating(true);
    setCurrentStep(0);
    setCompleted(false);

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= 3) {
          clearInterval(interval);
          setGenerating(false);
          setCompleted(true);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-medium text-neutral-100 flex items-center gap-3">
          <FileText className="w-6 h-6 text-indigo-500" />
          研究报告生成器
        </h2>
        <p className="text-sm font-mono text-neutral-500 mt-1">AI 驱动的多维度投研报告自动生成</p>
      </div>

      {/* Template Selection */}
      <div className="mb-8">
        <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-4">选择报告模板</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              className={`glass rounded-xl p-5 text-left transition-all duration-300 ${
                selectedTemplate === t.id
                  ? "border-indigo-500/50 glow-indigo"
                  : "glass-hover"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg ${t.bgColor} border ${t.borderColor} flex items-center justify-center`}>
                  <t.icon className={`w-5 h-5 ${t.color}`} />
                </div>
                {selectedTemplate === t.id && <CheckCircle className="w-5 h-5 text-indigo-400 ml-auto" />}
              </div>
              <h4 className="text-sm font-medium text-neutral-200 mb-1">{t.name}</h4>
              <p className="text-xs text-neutral-500">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Generation Controls */}
      <div className="glass rounded-xl p-5 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase text-neutral-500">当前标的</div>
            <div className="text-sm text-neutral-200">贵州茅台 (600519.SH)</div>
          </div>
          <div className="w-px h-8 bg-white/5" />
          <div>
            <div className="text-[10px] font-mono uppercase text-neutral-500">模板</div>
            <div className="text-sm text-neutral-200">
              {TEMPLATES.find((t) => t.id === selectedTemplate)?.name || "未选择"}
            </div>
          </div>
        </div>
        <button
          onClick={startGeneration}
          disabled={!selectedTemplate || generating}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 text-sm font-mono transition-all glow-indigo"
        >
          {generating ? (
            <>
              <Sparkles className="w-4 h-4 animate-pulse" /> 生成中...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> 生成报告
            </>
          )}
        </button>
      </div>

      {/* Generation Progress */}
      <AnimatePresence>
        {(generating || completed) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass rounded-2xl p-6 mb-8"
          >
            <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-6">生成进度</h3>
            <div className="space-y-4">
              {GENERATION_STEPS.map((step, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    {i < currentStep || completed ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : i === currentStep && generating ? (
                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-white/10" />
                    )}
                  </div>
                  <div>
                    <div className={`text-sm ${i <= currentStep || completed ? "text-neutral-200" : "text-neutral-600"}`}>
                      {step.label}
                    </div>
                    <div className="text-xs text-neutral-500">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Preview */}
      <AnimatePresence>
        {completed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl overflow-hidden"
          >
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400">报告预览</h3>
              <button className="px-4 py-2 glass glass-hover rounded-lg flex items-center gap-2 text-xs text-neutral-300">
                <Download className="w-4 h-4" /> 下载
              </button>
            </div>
            <div className="p-6 prose max-w-none">
              <h2>贵州茅台 (600519.SH) 深度评级报告</h2>
              <p className="text-neutral-400 text-sm">生成时间: {new Date().toLocaleString("zh-CN")} | 模板: 个股深度评级</p>
              <h3>一、核心投资摘要</h3>
              <p>本报告对贵州茅台展开深度多维度测绘。品牌护城河稳固，核心红利与利润率保障极其明确。维持强烈推荐评级。</p>
              <h3>二、深度基本面多维透视</h3>
              <p>主营业务盈利状况领先行业。Q1毛利率高达91.8%，现金周转天数仅34.5天，显示极端强势的产业链上游议价权。</p>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3 mt-4">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-200">
                  <strong>风险提示：</strong>本报告由 AI 生成，仅供参考，不构成投资建议。投资有风险，入市需谨慎。
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
