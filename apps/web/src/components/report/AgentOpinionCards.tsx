import React from 'react';
import { AgentOpinion } from '../../types';
import { ShieldAlert, Fingerprint } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  agents: Record<string, AgentOpinion>;
}

export const AgentOpinionCards: React.FC<Props> = ({ agents }) => {
  const agentEntries = Object.entries(agents) as Array<[string, AgentOpinion]>;

  if (agentEntries.length === 0) return null;

  const formatAgentName = (agentId: string) => {
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
                {formatAgentName(agentId)}
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
              {opinion.reason}
            </p>

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
          </div>
        );
      })}
    </div>
  );
};
