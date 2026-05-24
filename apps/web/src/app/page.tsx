"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SidebarRail, type NavView } from "@/components/SidebarRail";
import { TopBar } from "@/components/TopBar";
import { KLinePanel } from "@/components/KLinePanel";
import { DataTabsPanel } from "@/components/DataTabsPanel";
import { AIAgentPanel } from "@/components/AIAgentPanel";
import { NewsPanel } from "@/components/NewsPanel";
import { FundFlowPanel } from "@/components/FundFlowPanel";
import { FundamentalsPanel } from "@/components/FundamentalsPanel";
import { DataDetailPanel } from "@/components/DataDetailPanel";
import { AgentAnalysisPanel } from "@/components/AgentAnalysisPanel";
import { ArchivePanel } from "@/components/ArchivePanel";
import { ExpertPanel } from "@/components/ExpertPanel";
import { HealthPanel } from "@/components/HealthPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { TaskCenter } from "@/components/TaskCenter";
import { QuantLabPanel } from "@/components/QuantLabPanel";
import { FundDcaPanel } from "@/components/FundDcaPanel";
import { PortfolioPanel } from "@/components/PortfolioPanel";
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
    <div className="flex h-screen w-full bg-[#050505] text-neutral-300 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      <div className="relative z-10 flex w-full h-full">
        <SidebarRail activeView={activeView} onNav={setActiveView} />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />

          <main className="flex-1 overflow-hidden relative">
            <div className="h-full overflow-y-auto custom-scrollbar">
              <AnimatePresence mode="wait">
                {activeView === "dashboard" && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                  >
                    <DashboardView
                      symbol={stockSymbol}
                      stockName={stockName}
                      isAgentPanelOpen={isAgentPanelOpen}
                      setIsAgentPanelOpen={setIsAgentPanelOpen}
                      agentWidth={agentWidth}
                      startResizing={startResizing}
                    />
                  </motion.div>
                )}

                {activeView === "news" && (
                  <motion.div key="news" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                    <NewsPanel symbol={stockSymbol} stockName={stockName} />
                  </motion.div>
                )}
                {activeView === "fundflow" && (
                  <motion.div key="fundflow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                    <FundFlowPanel symbol={stockSymbol} stockName={stockName} />
                  </motion.div>
                )}
                {activeView === "fundamentals" && (
                  <motion.div key="fundamentals" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                    <FundamentalsPanel symbol={stockSymbol} stockName={stockName} />
                  </motion.div>
                )}
                {activeView === "data" && (
                  <motion.div key="data" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                    <DataDetailPanel symbol={stockSymbol} stockName={stockName} />
                  </motion.div>
                )}
                {activeView === "agent" && (
                  <motion.div key="agent" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                    <AgentAnalysisPanel symbol={stockSymbol} stockName={stockName} />
                  </motion.div>
                )}
                {activeView === "archive" && (
                  <motion.div key="archive" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                    <ArchivePanel />
                  </motion.div>
                )}
                {activeView === "expert" && (
                  <motion.div key="expert" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                    <ExpertPanel stockSymbol={stockSymbol} stockName={stockName} />
                  </motion.div>
                )}
                {activeView === "health" && (
                  <motion.div key="health" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                    <HealthPanel />
                  </motion.div>
                )}
                {activeView === "settings" && (
                  <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                    <SettingsPanel />
                  </motion.div>
                )}
                {activeView === "tasks" && (
                  <motion.div key="tasks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                    <TaskCenter />
                  </motion.div>
                )}
                {activeView === "quant" && (
                  <motion.div key="quant" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                    <QuantLabPanel />
                  </motion.div>
                )}
                {activeView === "fund" && (
                  <motion.div key="fund" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                    <FundDcaPanel />
                  </motion.div>
                )}
                {activeView === "portfolio" && (
                  <motion.div key="portfolio" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                    <PortfolioPanel />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>
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
    <div className="flex-1 p-4 gap-4 flex min-h-0 h-full">
      {/* Left: K-line + Data tabs */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex-[3] bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-xl backdrop-blur-md">
          <KLinePanel symbol={symbol} stockName={stockName} />
        </div>
        <div className="flex-[2] bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-xl backdrop-blur-md">
          <DataTabsPanel symbol={symbol} stockName={stockName} />
        </div>
      </div>

      {/* Toggle button when panel is closed */}
      {!isAgentPanelOpen && (
        <button
          onClick={() => setIsAgentPanelOpen(true)}
          title="展开 AI 工作台"
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/[0.02] border border-white/5 border-r-0 text-neutral-400 p-2.5 rounded-l-lg hover:text-neutral-200 hover:bg-white/[0.05] transition-colors z-50 shadow-[0_0_15px_rgba(0,0,0,0.5)] flex items-center justify-center group"
        >
          <Bot size={20} className="group-hover:scale-110 transition-transform" />
          <span className="w-2 h-2 rounded-full bg-indigo-500 absolute top-1 right-1 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
        </button>
      )}

      {/* Right: AI Agent Panel */}
      {isAgentPanelOpen && (
        <>
          <div
            onMouseDown={startResizing}
            className="w-2 -mx-1 z-20 cursor-col-resize hover:bg-indigo-500/30 active:bg-indigo-500/50 transition-colors rounded"
          />
          <div
            style={{ width: agentWidth }}
            className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-xl flex-shrink-0 backdrop-blur-md"
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
