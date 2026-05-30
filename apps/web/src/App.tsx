import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Workbench } from './components/Workbench';
import { AgentsSystem } from './components/AgentsSystem';
import { Portfolio } from './components/Portfolio';
import { Backtesting } from './components/Backtesting';
import { NewsAggregator } from './components/NewsAggregator';
import { MultimodalChart } from './components/MultimodalChart';
import { ReportGenerator } from './components/ReportGenerator';
import { EvidenceChain } from './components/EvidenceChain';
import { PlaceholderModule } from './components/PlaceholderModule';
import { Settings } from './components/Settings';
import { FundDcaLab } from './components/FundDcaLab';
import type { TabID } from './types';

const VISIBLE_TABS: TabID[] = ['dashboard', 'workbench', 'agents', 'experts', 'market', 'tasks', 'fund_dca', 'news', 'chart', 'detailed', 'saved', 'settings'];

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabID>('dashboard');
  const [settingsInitialTab, setSettingsInitialTab] = useState<string>('api');

  const openAgentSettings = () => {
    setSettingsInitialTab('agents');
    setCurrentTab('settings');
  };

  return (
    <div className="flex h-screen w-full bg-[#050505] text-neutral-300 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      {/* Absolute background effects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] mix-blend-screen mix-blend-lighten" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px] mix-blend-screen mix-blend-lighten" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0.7px,transparent_0.7px)] bg-[length:6px_6px] opacity-[0.025] mix-blend-overlay"></div>
      </div>
      
      <div className="relative z-10 flex w-full h-full">
        <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />
        
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          
          <main className="flex-1 overflow-hidden relative">
            <div className="h-full overflow-y-auto custom-scrollbar">
              <AnimatePresence mode="wait">
              {(currentTab === 'dashboard' || currentTab === 'workbench') && (
                <Workbench key="workbench" />
              )}
              {(currentTab === 'agents' || currentTab === 'experts') && (
                <AgentsSystem onOpenAgentSettings={openAgentSettings} />
              )}
              {currentTab === 'market' && (
                <Portfolio key="portfolio" />
              )}
              {currentTab === 'tasks' && (
                <Backtesting key="backtesting" />
              )}
              {currentTab === 'fund_dca' && (
                <FundDcaLab key="fund_dca" />
              )}
              {currentTab === 'news' && (
                <NewsAggregator key="news" />
              )}
              {currentTab === 'chart' && (
                <MultimodalChart key="chart" />
              )}
              {currentTab === 'detailed' && (
                <ReportGenerator key="detailed" />
              )}
              {currentTab === 'saved' && (
                <EvidenceChain key="saved" />
              )}
              {currentTab === 'settings' && (
                <Settings initialTab={settingsInitialTab} />
              )}
              {!VISIBLE_TABS.includes(currentTab) && (
                <PlaceholderModule key="placeholder" tab={currentTab} />
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  </div>
);
}
