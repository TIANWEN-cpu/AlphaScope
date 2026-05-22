"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Play,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { listTeams, getTeam } from "@/lib/api";

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

export function ExpertPanel() {
  const [teams, setTeams] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [result, setResult] = useState<RoundtableResult | null>(null);
  const [running, setRunning] = useState(false);
  const [expandedExpert, setExpandedExpert] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await listTeams();
        setTeams(res.teams || []);
        if (res.teams?.length > 0) {
          setSelectedTeam(res.teams[0]);
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

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <Users size={20} className="text-purple-400" />
          专家圆桌
        </h2>
      </div>

      {/* Team selector */}
      <div className="flex items-center gap-3">
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="bg-[#18181b] border border-zinc-800 text-zinc-100 text-xs rounded-md px-3 py-2 focus:outline-none focus:border-blue-500/50 flex-1"
        >
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          disabled={running || !selectedTeam}
          onClick={() => {
            /* TODO: run roundtable */
          }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs rounded-md transition-colors"
        >
          <Play size={14} />
          {running ? "执行中..." : "召开圆桌"}
        </button>
      </div>

      {/* Team members */}
      {teamDetail && teamDetail.members && (
        <div className="bg-[#18181b] rounded-lg border border-zinc-800/50 p-4">
          <div className="text-xs text-zinc-500 mb-3">
            团队成员 ({teamDetail.members.length} 人)
          </div>
          <div className="grid grid-cols-2 gap-2">
            {teamDetail.members.map((m, i) => (
              <div
                key={i}
                className="bg-[#09090b] p-2 rounded border border-zinc-800/50 text-xs"
              >
                <div className="text-zinc-300 font-medium">{m.name}</div>
                <div className="text-zinc-600">{m.role}</div>
                <div className="text-[10px] text-zinc-600 font-mono mt-1">
                  {m.provider} / {m.model}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-[#18181b] rounded-lg border border-zinc-800/50 p-4">
            <div className="text-xs text-zinc-500 mb-2">投票汇总</div>
            <div className="grid grid-cols-5 gap-3 text-center">
              {[
                { label: "买入", value: result.summary.buy, color: "text-red-400" },
                { label: "持有", value: result.summary.hold, color: "text-zinc-300" },
                { label: "减持", value: result.summary.reduce, color: "text-yellow-400" },
                { label: "卖出", value: result.summary.sell, color: "text-emerald-400" },
                {
                  label: "平均仓位",
                  value: `${result.summary.avg_position}%`,
                  color: "text-blue-400",
                },
              ].map((s, i) => (
                <div key={i}>
                  <div className="text-[10px] text-zinc-500">{s.label}</div>
                  <div className={`text-lg font-mono ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-zinc-600 mt-2">
              有效: {result.summary.valid_count}/{result.summary.total_count}
              {result.elapsed_seconds &&
                ` | 耗时: ${result.elapsed_seconds.toFixed(1)}s`}
            </div>
          </div>

          {/* Expert opinions */}
          <div className="grid grid-cols-1 gap-2">
            {result.opinions.map((op, i) => (
              <div
                key={i}
                className="bg-[#18181b] rounded-lg border border-zinc-800/50 overflow-hidden"
              >
                <div
                  className="p-3 cursor-pointer hover:bg-zinc-800/20 transition-colors"
                  onClick={() =>
                    setExpandedExpert(
                      expandedExpert === op.expert_name ? null : op.expert_name
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{op.icon || " "}</span>
                      <span className="text-sm text-zinc-200 font-medium">
                        {op.expert_name}
                      </span>
                      <span className="text-[10px] text-zinc-600 font-mono">
                        {op.vendor}/{op.model}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          op.action?.includes("买")
                            ? "bg-red-500/10 text-red-400"
                            : op.action?.includes("卖")
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-zinc-500/10 text-zinc-400"
                        }`}
                      >
                        {op.action}
                      </span>
                      {op.position !== undefined && (
                        <span className="text-xs text-zinc-500 font-mono">
                          {op.position}%
                        </span>
                      )}
                      {expandedExpert === op.expert_name ? (
                        <ChevronUp size={14} className="text-zinc-500" />
                      ) : (
                        <ChevronDown size={14} className="text-zinc-500" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                    {op.view}
                  </p>
                </div>

                {expandedExpert === op.expert_name && (
                  <div className="px-3 pb-3 border-t border-zinc-800/50 pt-2 space-y-2">
                    <div className="text-xs text-zinc-300">{op.view}</div>

                    {op.evidence && op.evidence.length > 0 && (
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">
                          证据链
                        </div>
                        {op.evidence.map((ev, j) => (
                          <div
                            key={j}
                            className="text-xs text-zinc-400 bg-[#09090b] p-2 rounded mb-1"
                          >
                            <span className="text-zinc-600 mr-1">
                              [{ev.type}]
                            </span>
                            {ev.claim}
                          </div>
                        ))}
                      </div>
                    )}

                    {op.risks && op.risks.length > 0 && (
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">
                          风险提示
                        </div>
                        {op.risks.map((r, j) => (
                          <div
                            key={j}
                            className="text-xs text-yellow-400/80 flex items-start gap-1"
                          >
                            <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />
                            {r}
                          </div>
                        ))}
                      </div>
                    )}

                    {op.stop_loss && (
                      <div className="text-xs text-zinc-500">
                        止损位: {op.stop_loss}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!result && !running && (
        <div className="flex-1 flex items-center justify-center text-zinc-600">
          <div className="text-center">
            <Users size={48} className="opacity-20 mx-auto mb-3" />
            <p className="text-sm">选择团队后点击「召开圆桌」开始分析</p>
          </div>
        </div>
      )}
    </div>
  );
}
