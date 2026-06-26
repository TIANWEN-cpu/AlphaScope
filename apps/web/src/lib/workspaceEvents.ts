import { findStockTarget, StockTarget } from './stocks';

export const STOCK_SELECTED_EVENT = 'alphascope:stock-selected';
const STORAGE_KEY = 'alphascope:selected-stock';
const LEGACY_STORAGE_KEY = `${['ai', 'finance'].join('-')}:selected-stock`;

export interface StockSelectedPayload {
  stock: StockTarget;
  source: 'topbar' | 'chart' | 'report' | 'system';
  selectedAt: string;
}

export function dispatchStockSelected(stock: StockTarget, source: StockSelectedPayload['source'] = 'system') {
  const payload: StockSelectedPayload = {
    stock,
    source,
    selectedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stock));
  window.dispatchEvent(new CustomEvent<StockSelectedPayload>(STOCK_SELECTED_EVENT, { detail: payload }));
}

export function subscribeStockSelected(handler: (payload: StockSelectedPayload) => void) {
  const listener = (event: Event) => {
    const payload = (event as CustomEvent<StockSelectedPayload>).detail;
    const local = findStockTarget(payload.stock.symbol);
    const stock = local?.source === 'symbol-fallback' ? payload.stock : local ?? payload.stock;
    const normalizedPayload = { ...payload, stock };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stock));
    handler(normalizedPayload);
  };

  window.addEventListener(STOCK_SELECTED_EVENT, listener);
  return () => window.removeEventListener(STOCK_SELECTED_EVENT, listener);
}

export function getPersistedStock(): StockTarget | undefined {
  const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as Partial<StockTarget>;
    if (!parsed.symbol || !parsed.name || !parsed.exchange || !parsed.market) {
      return undefined;
    }
    const local = findStockTarget(parsed.symbol);
    const stock = local?.source === 'symbol-fallback'
      ? parsed as StockTarget
      : local ?? parsed as StockTarget;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stock));
    return stock;
  } catch {
    return undefined;
  }
}

export const TAB_CHANGE_EVENT = 'alphascope:tab-change';

export function dispatchTabChange(tab: string) {
  window.dispatchEvent(new CustomEvent<{ tab: string }>(TAB_CHANGE_EVENT, { detail: { tab } }));
}

export function subscribeTabChange(handler: (tab: string) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<{ tab: string }>).detail?.tab);
  window.addEventListener(TAB_CHANGE_EVENT, listener);
  return () => window.removeEventListener(TAB_CHANGE_EVENT, listener);
}

/**
 * Settings 变更事件(provider/模型路由增删改后广播)。
 * 消费方:Workbench/NewsAggregator/FundDcaLab/MultimodalChart/ReportGenerator 等
 * 在 mount 时读一次 /api/settings/providers 的组件 —— 订阅此事件后可即时刷新模型列表,
 * 不必等用户 F5。
 */
export const SETTINGS_CHANGED_EVENT = 'alphascope:settings-changed';

export type SettingsChangeKind = 'providers' | 'ai-routes' | 'agents';

export function dispatchSettingsChanged(kind: SettingsChangeKind = 'providers') {
  window.dispatchEvent(new CustomEvent<{ kind: SettingsChangeKind }>(SETTINGS_CHANGED_EVENT, { detail: { kind } }));
}

export function subscribeSettingsChanged(handler: (kind: SettingsChangeKind) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<{ kind: SettingsChangeKind }>).detail?.kind);
  window.addEventListener(SETTINGS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, listener);
}

/**
 * 自选股清单变更事件(add/remove 后广播)。
 * 消费方:Portfolio(及其它展示 watchlist 的组件),收到后重新拉取 /api/watchlist。
 */
export const WATCHLIST_CHANGED_EVENT = 'alphascope:watchlist-changed';

export function dispatchWatchlistChanged() {
  window.dispatchEvent(new CustomEvent(WATCHLIST_CHANGED_EVENT));
}

export function subscribeWatchlistChanged(handler: () => void) {
  const listener = () => handler();
  window.addEventListener(WATCHLIST_CHANGED_EVENT, listener);
  return () => window.removeEventListener(WATCHLIST_CHANGED_EVENT, listener);
}
