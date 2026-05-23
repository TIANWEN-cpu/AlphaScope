"use client";

import {
  LayoutDashboard,
  Settings,
  LineChart,
  Bookmark,
  Users,
  Activity,
  Newspaper,
  BarChart2,
  PieChart,
  Table,
  Brain,
  ListTodo,
  FlaskConical,
  TrendingUp,
  FileText,
  Link2,
} from "lucide-react";

export type NavView =
  | "dashboard"
  | "news"
  | "fundflow"
  | "fundamentals"
  | "data"
  | "agent"
  | "archive"
  | "expert"
  | "health"
  | "settings"
  | "tasks"
  | "portfolio"
  | "backtest"
  | "funddca"
  | "report"
  | "evidence";

interface SidebarRailProps {
  activeView: NavView;
  onNav: (view: NavView) => void;
}

const NAV_ITEMS: { view: NavView; icon: React.ReactNode; title: string; group?: string }[] = [
  { view: "dashboard", icon: <LayoutDashboard size={20} />, title: "工作台" },
  { view: "news", icon: <Newspaper size={20} />, title: "资讯与研报" },
  { view: "fundflow", icon: <BarChart2 size={20} />, title: "资金流向" },
  { view: "fundamentals", icon: <PieChart size={20} />, title: "基本面" },
  { view: "data", icon: <Table size={20} />, title: "行情明细" },
  { view: "agent", icon: <Brain size={20} />, title: "Agent分析" },
  { view: "archive", icon: <Bookmark size={20} />, title: "研究存档" },
  { view: "expert", icon: <Users size={20} />, title: "专家圆桌" },
  { view: "tasks", icon: <ListTodo size={20} />, title: "任务中心" },
  { view: "health", icon: <Activity size={20} />, title: "数据源" },
  { view: "portfolio", icon: <PieChart size={20} />, title: "投资组合" },
  { view: "backtest", icon: <FlaskConical size={20} />, title: "量化回测" },
  { view: "funddca", icon: <TrendingUp size={20} />, title: "基金定投" },
  { view: "report", icon: <FileText size={20} />, title: "报告生成" },
  { view: "evidence", icon: <Link2 size={20} />, title: "证据链" },
];

export function SidebarRail({ activeView, onNav }: SidebarRailProps) {
  return (
    <div className="w-14 bg-[#050505] border-r border-zinc-800/50 flex flex-col items-center py-4 z-20 flex-shrink-0">
      <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white mb-8 shadow-[0_0_15px_rgba(37,99,235,0.4)]">
        <LineChart size={18} strokeWidth={2.5} />
      </div>

      <div className="flex flex-col gap-3 w-full">
        {NAV_ITEMS.map((item) => (
          <NavIcon
            key={item.view}
            icon={item.icon}
            active={activeView === item.view}
            onClick={() => onNav(item.view)}
            title={item.title}
          />
        ))}
      </div>

      <div className="mt-auto mb-4">
        <NavIcon
          icon={<Settings size={20} />}
          active={activeView === "settings"}
          onClick={() => onNav("settings")}
          title="设置"
        />
      </div>
    </div>
  );
}

function NavIcon({
  icon,
  active = false,
  onClick,
  title,
}: {
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-full py-2.5 flex justify-center transition-colors border-l-2 focus:outline-none ${
        active
          ? "border-blue-500 text-blue-400 bg-blue-500/10"
          : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
      }`}
    >
      {icon}
    </button>
  );
}
