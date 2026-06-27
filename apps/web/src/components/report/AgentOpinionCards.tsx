import React from 'react';
import { AgentOpinion, EvidencePoolItem } from '../../types';
import { ShieldAlert, Fingerprint, Link2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  agents: Record<string, AgentOpinion>;
  /** 结论反查用的证据池(来自 /api/analysis/run 的 evidence_pool)。 */
  evidencePool?: EvidencePoolItem[];
}

export const AgentOpinionCards: React.FC<Props> = ({ agents, evidencePool }) => {
  const agentEntries = Object.entries(agents) as Array<[string, AgentOpinion]>;

  // evidence_id → 证据池条目, 供结论反查来源。Hook 必须在任何 early return 之前调用。
  const poolById = React.useMemo(() => {
    const m = new Map<string, EvidencePoolItem>();
    (evidencePool ?? []).forEach((item) => m.set(item.evidence_id, item));
    return m;
  }, [evidencePool]);

  if (agentEntries.length === 0) return null;

  const formatAgentName = (agentId: string, opinion: AgentOpinion) => {
    const name = opinion.name?.trim();
    if (name && !/^custom_agent$/i.test(name)) return name;
    if (/^custom_agent$/i.test(agentId)) return '专家会签席位';
    if (/agent$/i.test(agentId.trim())) return agentId;
    return `${agentId} Agent`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {agentEntries.map(([agentId, opinion]) => {
        let signalColor = 'text-neutral-400';
        let signalBg = 'bg-neutral-500/10 border-neutral-500/20';

        if (opinion.signal === 'BUY') {
          signalColor = 'text-rose-400';
          signalBg = 'bg-rose-500/10 border-rose-500/20';
        } else if (opinion.signal === 'SELL') {
          signalColor = 'text-emerald-400';
          signalBg = 'bg-emerald-500/10 border-emerald-500/20';
        }

        return (
          <div key={agentId} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col hover:bg-white/[0.07] transition-colors">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-indigo-400" />
                {formatAgentName(agentId, opinion)}
              </h3>
              <span className={cn('px-2 py-0.5 rounded border text-[10px] font-bold', signalBg, signalColor)}>
                {opinion.signal}
              </span>
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-xs text-neutral-400 mb-1">
                <span>置信度</span>
                <span>{(opinion.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, opinion.confidence * 100))}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed flex-grow">
              {opinion.reason || '该席位没有返回可展示的分析正文。'}
            </p>

            {(opinion.vendor || opinion.model) && (
              <div className="mt-3 text-[10px] text-neutral-500">
                {[opinion.vendor, opinion.model].filter(Boolean).join(' / ')}
              </div>
            )}

            {opinion.risk_points && opinion.risk_points.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="flex items-start gap-1.5 text-amber-400/80 mb-1">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="text-[10px] font-medium uppercase tracking-wider">风险点</span>
                </div>
                <ul className="list-disc list-inside text-xs text-neutral-400 space-y-0.5 pl-1">
                  {opinion.risk_points.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            {opinion.evidence_refs && opinion.evidence_refs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {opinion.evidence_refs.map(ref => (
                  <span key={ref} className="px-1.5 py-0.5 bg-black/40 border border-white/5 rounded text-[10px] text-neutral-500 font-mono">
                    #{ref}
                  </span>
                ))}
              </div>
            )}

            {opinion.evidence_ids && opinion.evidence_ids.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-1.5 text-emerald-400/80 mb-1.5">
                  <Link2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[10px] font-medium uppercase tracking-wider">结论溯源</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {opinion.evidence_ids.map((eid) => {
                    const item = poolById.get(eid);
                    const label = item?.source || eid.slice(0, 8);
                    const url = item?.source_url;
                    return url ? (
                      <a
                        key={eid}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={item?.preview || url}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] text-emerald-300/90 hover:bg-emerald-500/20 transition-colors"
                      >
                        <Link2 className="w-2.5 h-2.5" />
                        {label}
                      </a>
                    ) : (
                      <span
                        key={eid}
                        title={item?.preview}
                        className="px-1.5 py-0.5 bg-black/40 border border-white/5 rounded text-[10px] text-neutral-500 font-mono"
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
