import { Fragment, useEffect, useState } from 'react';
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
import { StockSelection } from './types';
import { api } from './lib/api';

const DEFAULT_STOCK: StockSelection = {
  symbol: '600519',
  name: '贵州茅台',
  exchange: 'SH',
  market: 'CN',
  resolved: true,
};

const needsStockIdentityRefresh = (stock: StockSelection) =>
  Boolean(stock.symbol) && (stock.resolved === false || stock.name.startsWith('股票代码 '));

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [activeStock, setActiveStock] = useState<StockSelection>(DEFAULT_STOCK);
  const stockViewKey = `${activeStock.symbol}-${activeStock.name}`;

  useEffect(() => {
    if (!needsStockIdentityRefresh(activeStock)) return;

    let cancelled = false;
    api.resolveStock(activeStock.symbol).then((result) => {
      if (cancelled || !result.success || !result.data?.symbol || !result.data.name) return;
      if (result.data.name === activeStock.name && result.data.resolved === activeStock.resolved) return;
      setActiveStock({
        symbol: result.data.symbol,
        name: result.data.name,
        exchange: result.data.exchange || activeStock.exchange,
        market: result.data.market || activeStock.market,
        resolved: result.data.resolved,
        source: result.data.source,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [activeStock]);

  return (
    <div className="flex h-screen w-full bg-[#050505] text-neutral-300 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      {/* Absolute background effects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] mix-blend-screen mix-blend-lighten" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px] mix-blend-screen mix-blend-lighten" />
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.35)_1px,transparent_1px)] bg-[length:18px_18px]"></div>
      </div>
      
      <div className="relative z-10 flex w-full h-full">
        <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />
        
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar activeStock={activeStock} onStockChange={setActiveStock} />
          
          <main className="flex-1 overflow-hidden relative">
            <div className="h-full overflow-y-auto custom-scrollbar">
              <AnimatePresence mode="wait">
              {(currentTab === 'dashboard' || currentTab === 'workbench') && (
                <Fragment key={`workbench-${stockViewKey}`}>
                  <Workbench symbol={activeStock.symbol} stockName={activeStock.name} />
                </Fragment>
              )}
              {(currentTab === 'agents' || currentTab === 'experts') && (
                <AgentsSystem key="agents" />
              )}
              {currentTab === 'market' && (
                <Fragment key={`portfolio-${stockViewKey}`}>
                  <Portfolio symbol={activeStock.symbol} stockName={activeStock.name} />
                </Fragment>
              )}
              {currentTab === 'tasks' && (
                <Fragment key={`backtesting-${stockViewKey}`}>
                  <Backtesting symbol={activeStock.symbol} stockName={activeStock.name} />
                </Fragment>
              )}
              {currentTab === 'fund_dca' && (
                <FundDcaLab key="fund_dca" />
              )}
              {currentTab === 'news' && (
                <Fragment key={`news-${stockViewKey}`}>
                  <NewsAggregator symbol={activeStock.symbol} stockName={activeStock.name} />
                </Fragment>
              )}
              {currentTab === 'chart' && (
                <Fragment key={`chart-${stockViewKey}`}>
                  <MultimodalChart symbol={activeStock.symbol} stockName={activeStock.name} />
                </Fragment>
              )}
              {currentTab === 'detailed' && (
                <Fragment key={`report-${stockViewKey}`}>
                  <ReportGenerator symbol={activeStock.symbol} stockName={activeStock.name} />
                </Fragment>
              )}
              {currentTab === 'saved' && (
                <Fragment key={`evidence-${stockViewKey}`}>
                  <EvidenceChain symbol={activeStock.symbol} stockName={activeStock.name} />
                </Fragment>
              )}
              {currentTab === 'settings' && (
                <Settings key="settings" />
              )}
              {!['dashboard', 'workbench', 'agents', 'experts', 'market', 'tasks', 'fund_dca', 'news', 'chart', 'detailed', 'saved', 'settings'].includes(currentTab) && (
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
