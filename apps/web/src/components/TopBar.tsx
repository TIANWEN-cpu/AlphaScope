import { useState } from 'react';
import { Search, RefreshCw, Maximize2, Bell } from 'lucide-react';
import { motion } from 'motion/react';
import { StockSelection } from '../types';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

interface TopBarProps {
  activeStock: StockSelection;
  onStockChange: (stock: StockSelection) => void;
}

const STOCK_ALIASES: StockSelection[] = [
  { symbol: '600519', name: '贵州茅台', exchange: 'SH' },
  { symbol: '600036', name: '招商银行', exchange: 'SH' },
  { symbol: '300750', name: '宁德时代', exchange: 'SZ' },
  { symbol: '600837', name: '海通证券', exchange: 'SH' },
  { symbol: '00700', name: '腾讯控股', exchange: 'HK' },
];

function parseStockInput(input: string, current: StockSelection): StockSelection {
  const alias = STOCK_ALIASES.find(item => input.includes(item.name) || input.includes(item.symbol));
  const code = input.match(/\d{5,6}/)?.[0] || alias?.symbol || current.symbol;
  const name = input
    .replace(/\(?\d{5,6}(\.(SH|SZ|HK|SS))?\)?/i, '')
    .replace(/[()（）]/g, '')
    .trim();
  const codeOnlyInput = Boolean(input.trim().match(/^\d{5,6}(\.(SH|SZ|HK|SS))?$/i));

  return {
    symbol: code,
    name: name || alias?.name || (codeOnlyInput ? `股票代码 ${code}` : current.name),
    exchange: code.startsWith('6') ? 'SH' : code.length === 5 ? 'HK' : 'SZ',
  };
}

function fromResolvedStock(input: string, current: StockSelection): StockSelection {
  const parsed = parseStockInput(input, current);
  return parsed;
}

export function TopBar({ activeStock, onStockChange }: TopBarProps) {
  const [searchValue, setSearchValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState('系统在线');

  const submitSearch = async (value = searchValue) => {
    if (!value.trim() || isSearching) return;

    const parsed = parseStockInput(value, activeStock);
    setIsSearching(true);
    setSearchStatus('正在校验标的并同步行情...');
    try {
      const resolved = await api.resolveStock(value.trim());
      const nextStock = resolved.success && resolved.data?.symbol
        ? {
            symbol: resolved.data.symbol,
            name: resolved.data.name || parsed.name,
            exchange: resolved.data.exchange || parsed.exchange,
            market: resolved.data.market,
            resolved: resolved.data.resolved,
            source: resolved.data.source,
          }
        : fromResolvedStock(value, activeStock);
      onStockChange(nextStock);
      setSearchValue('');

      const fetched = await api.priceFetch(nextStock.symbol, 120);
      setSearchStatus(
        fetched.success
          ? `已切换 ${nextStock.name}，同步 ${fetched.data?.fetched || 0} 条行情`
          : `已切换 ${nextStock.name}，行情拉取失败`,
      );
    } catch {
      onStockChange(parsed);
      setSearchStatus(`已切换 ${parsed.name}，后端同步失败`);
    } finally {
      setIsSearching(false);
    }
  };

  const refreshActiveStock = async () => {
    setIsSearching(true);
    setSearchStatus(`正在刷新 ${activeStock.name} 行情...`);
    const result = await api.priceFetch(activeStock.symbol, 120);
    setSearchStatus(result.success ? `行情刷新完成：${result.data?.fetched || 0} 条` : result.error || '行情刷新失败');
    setIsSearching(false);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  return (
    <header className="h-[60px] bg-black/20 border-b border-white-[0.02] backdrop-blur-md flex items-center justify-between px-6 text-neutral-400 z-10 flex-shrink-0">
      <div className="flex items-center gap-6 flex-1">
        <div className="flex items-center gap-4">
          <div className="relative w-72 flex items-center group">
            <Search className="w-4 h-4 absolute left-3.5 text-neutral-500 group-focus-within:text-indigo-400 transition-colors" />
            <input 
              type="text" 
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSearch();
              }}
              placeholder={`搜索标的 / ${activeStock.name} (${activeStock.symbol})`}
              className="w-full bg-white/[0.03] border border-white/[0.05] rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all text-neutral-200 placeholder:text-neutral-500 shadow-inner"
            />
            {isSearching && (
              <RefreshCw className="w-3.5 h-3.5 absolute right-3 text-indigo-400 animate-spin" />
            )}
          </div>
          <div className="h-5 w-px bg-white/10 mx-1"></div>
          <span className="text-sm text-neutral-400 font-medium tracking-wide flex items-center gap-2">
            A股 研究工作台
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">PRO</span>
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-5">
        <span className="hidden lg:inline text-[10px] font-mono text-neutral-500 max-w-[220px] truncate">
          {searchStatus}
        </span>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={refreshActiveStock}
          disabled={isSearching}
          title="刷新当前标的行情"
          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-neutral-500 hover:text-neutral-300 disabled:opacity-50"
        >
          <RefreshCw className={cn("w-[18px] h-[18px]", isSearching && "animate-spin text-indigo-400")} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleFullscreen}
          title="切换全屏"
          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-neutral-500 hover:text-neutral-300"
        >
          <Maximize2 className="w-[18px] h-[18px]" />
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} className="relative p-2 hover:bg-white/5 rounded-lg transition-colors text-neutral-500 hover:text-neutral-300">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-[#050505]"></span>
        </motion.button>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
          <span className="text-[11px] font-medium tracking-wider">系统在线</span>
        </div>
      </div>
    </header>
  );
}
