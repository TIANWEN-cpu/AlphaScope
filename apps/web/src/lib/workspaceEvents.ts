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
