"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Play,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { listTeams, getTeam, runAnalysis } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  provider: string;
  model: string;
}

interface TeamDetail {
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
}

interface ExpertOpinion {
  expert_name: string;
  icon?: string;
  style?: string;
  vendor?: string;
  model?: string;
  view: string;
  action: string;
  position?: number;
  stop_loss?: string;
  evidence?: Array<{ claim: string; type: string; data_date?: string }>;
  risks?: string[];
  ok?: boolean;
  error_msg?: string;
}

interface RoundtableResult {
  opinions: ExpertOpinion[];
  summary: {
    buy: number;
    hold: number;
    reduce: number;
    sell: number;
    avg_position: number;
    valid_count: number;
    total_count: number;
  };
  elapsed_seconds?: number;
}

interface TeamItem {
  id: string;
  name: string;
  name_en?: string;
}

interface ExpertPanelProps {
  stockSymbol?: string;
  stockName?: string;
}

export function ExpertPanel({ stockSymbol = "", stockName = "" }: ExpertPanelProps) {
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [result, setResult] = useState<RoundtableResult | null>(null);
  const [running, setRunning] = useState(false);
  const [expandedExpert, setExpandedExpert] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await listTeams();
        const teamList = (res.teams || []) as unknown as TeamItem[];
        setTeams(teamList);
        if (teamList.length > 0) {
          setSelectedTeam(teamList[0].id || String(teamList[0]));
        }
      } catch {
        setTeams([]);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedTeam) return;
    const load = async () => {
      try {
        const detail = (await getTeam(selectedTeam)) as unknown as TeamDetail;
        setTeamDetail(detail);
      } catch {
        setTeamDetail(null);
      }
    };
    load();
  }, [selectedTeam]);

  const handleRun = async () => {
    if (!stockSymbol) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await runAnalysis({
        stock_symbol: stockSymbol,
        stock_name: stockName,
        mode: "expert",
      });
      setResult(res as unknown as RoundtableResult);
    } catch (err) {
      console.error("圆桌分析失败:", err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6 gap-4 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-medium text-white flex items-center gap-3">
          <Users size={22} className="text-indigo-400" />
          专家圆桌
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="bg-black/20 border border-white/5 text-neutral-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500/50 flex-1"
        >
          {teams.map((t) => (
            <option key={t.id || String(t)} value={t.id || String(t)}>
              {t.name || String(t)}
            </option>
          ))}
        </select>
        <button
          disabled={running || !selectedTeam || !stockSymbol}
          onClick={handleRun}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-neutral-600 text-white text-xs rounded-lg transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)]"
        >
          <Play size={14} />
          {running ? "执行中..." : "召开圆桌"}
        </button>
      </div>

      {teamDetail && teamDetail.members && (
        <div className="bg-white/[0.02] rounded-xl border border-white/5 p-4 backdrop-blur-md">
          <div className="text-xs text-neutral-500 mb-3 font-mono uppercase tracking-wider">
            团队成员 ({teamDetail.members.length} 人)
          </div>
          <div className="grid grid-cols-2 gap-2">
            {teamDetail.members.map((m, i) => (
              <div key={i} className="bg-black/20 p-2.5 rounded-lg border border-white/5 text-xs">
                <div className="text-neutral-300 font-medium">{m.name}</div>
                <div className="text-neutral-600">{m.role}</div>
                <div className="text-[10px] text-neutral-600 font-mono mt-1">
                  {m.provider} / {m.model}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-white/[0.02] rounded-xl border border-white/5 p-5 backdrop-blur-md">
            <div className="text-xs text-neutral-500 mb-2 font-mono uppercase tracking-wider">投票汇总</div>
            <div className="grid grid-cols-5 gap-3 text-center">
              {[
                { label: "买入", value: result.summary.buy, color: "text-rose-400" },
                { label: "持有", value: result.summary.hold, color: "text-neutral-300" },
                { label: "减持", value: result.summary.reduce, color: "text-yellow-400" },
                { label: "卖出", value: result.summary.sell, color: "text-emerald-400" },
                { label: "平均仓位", value: `${result.summary.avg_position}%`, color: "text-indigo-400" },
              ].map((s, i) => (
                <div key={i}>
                  <div className="text-[10px] text-neutral-500 font-mono">{s.label}</div>
                  <div className={cn("text-lg font-mono", s.color)}>{s.value}</div>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-neutral-600 mt-2 font-mono">
              有效: {result.summary.valid_count}/{result.summary.total_count}
              {result.elapsed_seconds && ` | 耗时: ${result.elapsed_seconds.toFixed(1)}s`}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {result.opinions.map((op, i) => (
              <div key={i} className="bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden backdrop-blur-md">
                <div
                  className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedExpert(expandedExpert === op.expert_name ? null : op.expert_name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{op.icon || " "}</span>
                      <span className="text-sm text-neutral-200 font-medium">{op.expert_name}</span>
                      <span className="text-[10px] text-neutral-600 font-mono">
                        {op.vendor}/{op.model}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-lg font-mono",
                          op.action?.includes("买")
                            ? "bg-rose-500/10 text-rose-400"
                            : op.action?.includes("卖")
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-neutral-500/10 text-neutral-400"
                        )}
                      >
                        {op.action}
                      </span>
                      {op.position !== undefined && (
                        <span className="text-xs text-neutral-500 font-mono">{op.position}%</span>
                      )}
                      {expandedExpert === op.expert_name ? (
                        <ChevronUp size={14} className="text-neutral-500" />
                      ) : (
                        <ChevronDown size={14} className="text-neutral-500" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{op.view}</p>
                </div>

                {expandedExpert === op.expert_name && (
                  <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
                    <div className="text-xs text-neutral-300">{op.view}</div>

                    {op.evidence && op.evidence.length > 0 && (
                      <div>
                        <div className="text-[10px] text-neutral-500 mb-1 font-mono uppercase tracking-wider">证据链</div>
                        {op.evidence.map((ev, j) => (
                          <div key={j} className="text-xs text-neutral-400 bg-black/20 p-2.5 rounded-lg mb-1 border border-white/5">
                            <span className="text-neutral-600 mr-1 font-mono">[{ev.type}]</span>
                            {ev.claim}
                          </div>
                        ))}
                      </div>
                    )}

                    {op.risks && op.risks.length > 0 && (
                      <div>
                        <div className="text-[10px] text-neutral-500 mb-1 font-mono uppercase tracking-wider">风险提示</div>
                        {op.risks.map((r, j) => (
                          <div key={j} className="text-xs text-amber-400/80 flex items-start gap-1">
                            <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />
                            {r}
                          </div>
                        ))}
                      </div>
                    )}

                    {op.stop_loss && (
                      <div className="text-xs text-neutral-500 font-mono">止损位: {op.stop_loss}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!result && !running && (
        <div className="flex-1 flex items-center justify-center text-neutral-600">
          <div className="text-center">
            <Users size={48} className="opacity-20 mx-auto mb-3" />
            <p className="text-sm">选择团队后点击「召开圆桌」开始分析</p>
          </div>
        </div>
      )}
    </div>
  );
}
