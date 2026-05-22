"use client";

import { useState } from "react";
import { SidebarRail, type NavView } from "@/components/SidebarRail";
import { TopNavigation } from "@/components/TopNavigation";
import { KLinePanel } from "@/components/KLinePanel";
import { DataTabsPanel } from "@/components/DataTabsPanel";
import { AIAgentPanel } from "@/components/AIAgentPanel";
import { ArchivePanel } from "@/components/ArchivePanel";
import { ExpertPanel } from "@/components/ExpertPanel";
import { HealthPanel } from "@/components/HealthPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { Bot } from "lucide-react";

export default function HomePage() {
  const [activeView, setActiveView] = useState<NavView>("dashboard");
  const [stockSymbol, setStockSymbol] = useState("600519");
  const [stockName, setStockName] = useState("贵州茅台");
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(true);
  const [agentWidth, setAgentWidth] = useState(480);

  const handleSelectStock = (symbol: string, name: string) => {
    setStockSymbol(symbol);
    setStockName(name);
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    const handleMouseMove = (mouseEvent: MouseEvent) => {
      const newWidth = window.innerWidth - mouseEvent.clientX - 8;
      setAgentWidth(Math.max(300, Math.min(1200, newWidth)));
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-300 font-sans overflow-hidden selection:bg-blue-500/30">
      <SidebarRail activeView={activeView} onNav={setActiveView} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNavigation
          activeSymbol={stockSymbol}
          activeName={stockName}
          onSelectStock={handleSelectStock}
        />

        {activeView === "dashboard" && (
          <DashboardView
            symbol={stockSymbol}
            stockName={stockName}
            isAgentPanelOpen={isAgentPanelOpen}
            setIsAgentPanelOpen={setIsAgentPanelOpen}
            agentWidth={agentWidth}
            startResizing={startResizing}
          />
        )}

        {activeView === "archive" && <ArchivePanel />}
        {activeView === "expert" && <ExpertPanel />}
        {activeView === "health" && <HealthPanel />}
        {activeView === "settings" && <SettingsPanel />}
      </div>
    </div>
  );
}

function DashboardView({
  symbol,
  stockName,
  isAgentPanelOpen,
  setIsAgentPanelOpen,
  agentWidth,
  startResizing,
}: {
  symbol: string;
  stockName: string;
  isAgentPanelOpen: boolean;
  setIsAgentPanelOpen: (v: boolean) => void;
  agentWidth: number;
  startResizing: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex-1 p-2 pb-0 gap-2 flex min-h-0 animate-fade-in relative">
      {/* Left: K-line + Data tabs */}
      <div className="flex-1 flex flex-col gap-2 min-w-0 pb-2">
        <div className="flex-[3] bg-[#18181b] rounded-lg border border-zinc-800/80 overflow-hidden flex flex-col shadow-xl">
          <KLinePanel symbol={symbol} stockName={stockName} />
        </div>
        <div className="flex-[2] bg-[#18181b] rounded-lg border border-zinc-800/80 overflow-hidden flex flex-col shadow-xl">
          <DataTabsPanel symbol={symbol} stockName={stockName} />
        </div>
      </div>

      {/* Toggle button when panel is closed */}
      {!isAgentPanelOpen && (
        <button
          onClick={() => setIsAgentPanelOpen(true)}
          title="展开 AI 工作台"
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-[#18181b] border border-zinc-800/80 border-r-0 text-zinc-400 p-2.5 rounded-l-lg hover:text-zinc-200 hover:bg-zinc-800 transition-colors z-50 shadow-[0_0_15px_rgba(0,0,0,0.5)] flex items-center justify-center group"
        >
          <Bot size={20} className="group-hover:scale-110 transition-transform" />
          <span className="w-2 h-2 rounded-full bg-blue-500 absolute top-1 right-1 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
        </button>
      )}

      {/* Right: AI Agent Panel */}
      {isAgentPanelOpen && (
        <>
          <div
            onMouseDown={startResizing}
            className="w-2 -mx-1 z-20 cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors"
          />
          <div
            style={{ width: agentWidth }}
            className="bg-[#18181b] rounded-lg border border-zinc-800/80 overflow-hidden flex flex-col shadow-xl mb-2 flex-shrink-0"
          >
            <AIAgentPanel
              symbol={symbol}
              stockName={stockName}
              onClose={() => setIsAgentPanelOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
