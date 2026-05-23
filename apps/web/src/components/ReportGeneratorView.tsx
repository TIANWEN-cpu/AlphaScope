"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Sparkles,
  ChevronRight,
  CheckCircle,
  Download,
  AlertTriangle,
  TrendingUp,
  BookOpen,
  Shield,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface TemplateInfo {
  name: string;
  description: string;
  sections: string[];
}

const TEMPLATE_ICONS: Record<string, { icon: typeof TrendingUp; color: string; bgColor: string; borderColor: string }> = {
  stock_deep_rating: { icon: TrendingUp, color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20" },
  industry_thematic: { icon: BookOpen, color: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20" },
  black_swan_warning: { icon: Shield, color: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20" },
};

const TEMPLATE_NAMES: Record<string, string> = {
  stock_deep_rating: "个股深度评级",
  industry_thematic: "行业专题报告",
  black_swan_warning: "黑天鹅预警",
};

export function ReportGeneratorView() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/reports/templates`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setTemplates(d.data); })
      .catch(() => {});
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate) return;
    setGenerating(true);
    setError("");
    setReportContent(null);
    try {
      const res = await fetch(`${API_BASE}/api/reports/templates/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_name: selectedTemplate,
          data: {
            symbol: "600519",
            name: "贵州茅台",
            industry: "白酒",
            fundamental_score: 85,
            financials: {
              "营收": { value: "1241亿", yoy: "+16.2%" },
              "净利润": { value: "627亿", yoy: "+19.5%" },
            },
            valuation: { "PE(TTM)": 33.5, PB: 11.2 },
            risks: ["估值偏高", "政策风险"],
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReportContent(data.data.content);
      } else {
        setError(data.error || "生成失败");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  }, [selectedTemplate]);

  const handleDownload = () => {
    if (!reportContent) return;
    const blob = new Blob([reportContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${selectedTemplate}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto h-full overflow-y-auto custom-scrollbar">
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
          {templates.map((t) => {
            const config = TEMPLATE_ICONS[t.name] || TEMPLATE_ICONS.stock_deep_rating;
            const Icon = config.icon;
            return (
              <button
                key={t.name}
                onClick={() => setSelectedTemplate(t.name)}
                className={`glass rounded-xl p-5 text-left transition-all duration-300 ${
                  selectedTemplate === t.name ? "border-indigo-500/50 glow-indigo" : "glass-hover"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg ${config.bgColor} border ${config.borderColor} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  {selectedTemplate === t.name && <CheckCircle className="w-5 h-5 text-indigo-400 ml-auto" />}
                </div>
                <h4 className="text-sm font-medium text-neutral-200 mb-1">
                  {TEMPLATE_NAMES[t.name] || t.name}
                </h4>
                <p className="text-xs text-neutral-500">{t.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {t.sections.slice(0, 3).map((s) => (
                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-500">{s}</span>
                  ))}
                  {t.sections.length > 3 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-500">+{t.sections.length - 3}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Generate Button */}
      <div className="glass rounded-xl p-5 mb-8 flex items-center justify-between">
        <div className="text-sm text-neutral-200">
          {selectedTemplate
            ? `模板: ${TEMPLATE_NAMES[selectedTemplate] || selectedTemplate}`
            : "请选择模板"}
        </div>
        <button
          onClick={handleGenerate}
          disabled={!selectedTemplate || generating}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 text-sm font-mono transition-all glow-indigo"
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> 生成中...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> 生成报告</>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="glass rounded-xl p-4 mb-8 border-red-500/20 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      {/* Report Preview */}
      <AnimatePresence>
        {reportContent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl overflow-hidden"
          >
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400">报告预览</h3>
              <button
                onClick={handleDownload}
                className="px-4 py-2 glass glass-hover rounded-lg flex items-center gap-2 text-xs text-neutral-300"
              >
                <Download className="w-4 h-4" /> 下载 Markdown
              </button>
            </div>
            <div className="p-6">
              <pre className="text-sm text-neutral-300 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                {reportContent}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
