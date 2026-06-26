import { type ReactNode, useState, useEffect } from 'react';

/**
 * KeepAlive —— 缓存已访问过的 tab，避免每次切换都重新挂载 + 重新请求数据。
 *
 * 工作原理：
 * - 首次切换到某个 tab 时挂载它；
 * - 切走时改为 display:none 隐藏（不卸载），保留其内部 state / 已请求数据；
 * - 再次切回时直接显示，无需重新挂载与请求。
 *
 * 这能显著降低"切页卡顿"——尤其对于 Portfolio / NewsAggregator / Backtesting
 * 这类一进页面就打多个 fetch 的重型组件。
 *
 * 注意：隐藏的组件仍在 React 树中，其 useEffect 不会重新执行，
 * 因此页面切换是纯展示层切换，O(1) 成本。
 */
interface KeepAliveProps {
  /** 当前激活的 tab id */
  active: string;
  /** 所有 tab id -> 渲染函数 的映射 */
  tabs: Record<string, () => ReactNode>;
}

export function KeepAlive({ active, tabs }: KeepAliveProps) {
  // 记录已经被访问过的 tab（只增不减），首次访问后才挂载
  const [visited, setVisited] = useState<Set<string>>(() => new Set([active]));

  useEffect(() => {
    setVisited((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev);
      next.add(active);
      return next;
    });
  }, [active]);

  return (
    <>
      {Array.from(visited).map((tabId) => {
        const render = tabs[tabId];
        if (!render) return null;
        const isActive = tabId === active;
        return (
          <div
            key={tabId}
            // 隐藏而非卸载：display:none 不占布局、不触发重排，
            // 同时组件生命周期（state/已订阅数据）完整保留
            style={isActive ? undefined : { display: 'none' }}
            aria-hidden={!isActive}
          >
            {render()}
          </div>
        );
      })}
    </>
  );
}
