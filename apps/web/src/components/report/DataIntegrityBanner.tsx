import React from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AnalysisResult } from '../../types';
import { deriveDataIntegritySeverity } from '../../lib/analysisAdapter';

interface Props {
  result: AnalysisResult;
}

export const DataIntegrityBanner: React.FC<Props> = ({ result }) => {
  const severity = deriveDataIntegritySeverity(result);

  if (severity === 'green') {
    return (
      <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm">
        <CheckCircle2 className="w-4 h-4" />
        <span>数据源正常。当前结论基于完整、健康的金融数据源。AI 结论不构成投资建议。</span>
      </div>
    );
  }

  if (severity === 'yellow') {
    return (
      <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>部分数据源降级或补全，结论需结合来源细节复核。AI 结论不构成投资建议。</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
      <XCircle className="w-4 h-4 shrink-0" />
      <span>严重降级：核心行情或风控数据缺失，本次分析仅供粗略参考。AI 结论不构成投资建议。</span>
    </div>
  );
};
