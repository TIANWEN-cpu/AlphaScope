"use client";

import {
  LayoutDashboard,
  Network,
  TerminalSquare,
  Settings,
  LineChart,
  Bookmark,
  Users,
  Activity,
} from "lucide-react";

export type NavView =
  | "dashboard"
  | "archive"
  | "expert"
  | "settings"
  | "health";

interface SidebarRailProps {
  activeView: NavView;
  onNav: (view: NavView) => void;
}

const NAV_ITEMS: { view: NavView; icon: React.ReactNode; title: string }[] = [
  { view: "dashboard", icon: <LayoutDashboard size={20} />, title: "工作台" },
  { view: "archive", icon: <Bookmark size={20} />, title: "研究存档" },
  { view: "expert", icon: <Users size={20} />, title: "专家圆桌" },
  { view: "health", icon: <Activity size={20} />, title: "数据源健康" },
];

export function SidebarRail({ activeView, onNav }: SidebarRailProps) {
  return (
    <div className="w-14 bg-[#09090b] border-r border-zinc-800/50 flex flex-col items-center py-4 z-20 flex-shrink-0">
      <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white mb-8 shadow-[0_0_15px_rgba(37,99,235,0.4)]">
        <LineChart size={18} strokeWidth={2.5} />
      </div>

      <div className="flex flex-col gap-4 w-full">
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
      className={`w-full py-3 flex justify-center transition-colors border-l-2 focus:outline-none ${
        active
          ? "border-blue-500 text-blue-400 bg-blue-500/10"
          : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
      }`}
    >
      {icon}
    </button>
  );
}
