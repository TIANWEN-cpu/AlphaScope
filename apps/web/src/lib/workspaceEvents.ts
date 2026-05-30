import { findStockTarget, StockTarget } from './stocks';

export const STOCK_SELECTED_EVENT = 'ai-finance:stock-selected';
const STORAGE_KEY = 'ai-finance:selected-stock';

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
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as Partial<StockTarget>;
    if (!parsed.symbol || !parsed.name || !parsed.exchange || !parsed.market) {
      return undefined;
    }
    const local = findStockTarget(parsed.symbol);
    return local?.source === 'symbol-fallback'
      ? parsed as StockTarget
      : local ?? parsed as StockTarget;
  } catch {
    return undefined;
  }
}
