import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, RefreshCcw, Server, ShieldAlert, WifiOff, XCircle } from 'lucide-react';
import { fetchApi } from '../lib/api';
import type { ProviderHealthItem } from '../types';

interface ProviderHealthResponse {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  providers: ProviderHealthItem[];
}

type UiStatus = 'healthy' | 'degraded' | 'down' | 'unknown' | 'checking';

const statusMeta: Record<UiStatus, { label: string; className: string; icon: React.ReactNode }> = {
  healthy: {
    label: '正常',
    className: 'text-emerald-400',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  degraded: {
    label: '降级',
    className: 'text-amber-400',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  down: {
    label: '不可用',
    className: 'text-red-400',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  unknown: {
    label: '未知',
    className: 'text-neutral-400',
    icon: <Activity className="h-3.5 w-3.5" />,
  },
  checking: {
    label: '检测中',
    className: 'text-neutral-400',
    icon: <Activity className="h-3.5 w-3.5 animate-pulse" />,
  },
};

const providerDisplayNames: Record<string, string> = {
  akshare: 'AkShare',
  baidu_stock: '百度股市通',
  eastmoney_datacenter: '东方财富数据中心',
  eastmoney: '东方财富',
  openbb: 'OpenBB',
  tencent: '腾讯行情',
  ths_hot: '同花顺热榜',
  tushare: 'TuShare',
  wind: 'Wind',
  ifind: 'iFinD',
  choice: 'Choice',
  jy: '聚源',
};

const dataTypeNames: Record<string, string> = {
  alternative: '另类数据',
  announcements: '公告',
  attention: '关注度',
  calendar: '日历',
  events: '事件',
  fundamentals: '基本面',
  fund_flow: '资金流',
  hot_reason: '上榜原因',
  insider: '内部人',
  institutional: '机构',
  macro: '宏观',
  news: '新闻',
  northbound: '北向资金',
  prices: '行情',
  quote: '实时行情',
  realtime: '实时',
  reports: '研报',
  risk_events: '风险事件',
  sector: '行业',
  sentiment: '情绪',
  social: '社交',
  theme: '题材',
};

const previewProviders: ProviderHealthItem[] = [
  {
    name: 'tencent',
    status: 'degraded',
    consecutive_failures: 0,
    avg_latency_ms: 80,
    last_error: '',
    last_success: '',
    empty_count: 0,
    recent_calls: 0,
    stability: 'fragile',
    risk_note: '本地预览：非官方接口可能变动，关键结论需人工核验。',
    data_types: ['prices', 'quote', 'realtime'],
    markets: ['CN'],
  },
  {
    name: 'eastmoney_datacenter',
    status: 'degraded',
    consecutive_failures: 0,
    avg_latency_ms: 620,
    last_error: '',
    last_success: '',
    empty_count: 0,
    recent_calls: 0,
    stability: 'fragile',
    risk_note: '本地预览：用于资金流、龙虎榜、解禁、两融等研究辅助数据。',
    data_types: ['fund_flow', 'events', 'risk_events', 'institutional', 'fundamentals'],
    markets: ['CN'],
  },
  {
    name: 'ths_hot',
    status: 'degraded',
    consecutive_failures: 0,
    avg_latency_ms: 1800,
    last_error: '',
    last_success: '',
    empty_count: 0,
    recent_calls: 0,
    stability: 'fragile',
    risk_note: '本地预览：热榜和题材原因波动较大，只作为情绪参考。',
    data_types: ['theme', 'hot_reason', 'sentiment'],
    markets: ['CN'],
  },
  {
    name: 'akshare',
    status: 'degraded',
    consecutive_failures: 0,
    avg_latency_ms: 0,
    last_error: '',
    last_success: '',
    empty_count: 0,
    recent_calls: 0,
    stability: 'stable',
    risk_note: '',
    data_types: ['news', 'reports', 'announcements', 'prices', 'fundamentals', 'fund_flow'],
    markets: ['CN', 'ALL'],
  },
];

const normalizeStatus = (status: ProviderHealthItem['status']): UiStatus => {
  if (status === 'healthy' || status === 'degraded') return status;
  if (status === 'unhealthy') return 'down';
  return 'unknown';
};

const sanitizeBackendText = (value?: string) => {
  if (!value) return '';
  const replacements: Array<[RegExp, string]> = [
    [/éå®æ¹æ°æ®æºå¯è½åå¨/g, '非官方数据源可能变动'],
    [/é€è¦é\u0085ç½®/g, '需要配置'],
    [/åå®è£\u0085/g, '和安装'],
    [/ä¸æ¯æ/g, '不支持'],
    [/èæº/g, '聚源'],
  ];
  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
};

const formatTime = (value?: string | number) => {
  if (!value) return '-';
  if (typeof value === 'number' && value <= 0) return '-';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatLatency = (value?: number) => {
  if (!value || value <= 0) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
};

const formatTypes = (types?: string[]) => {
  if (!types?.length) return '未声明类型';
  return types.map(type => dataTypeNames[type] || type).join(' / ');
};

const formatMarkets = (markets?: string[]) => {
  if (!markets?.length) return '未声明市场';
  return markets.join(', ');
};

const ProviderStatusBadge: React.FC<{ status: UiStatus }> = ({ status }) => {
  const meta = statusMeta[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${meta.className}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
};

export const ProviderHealthPanel: React.FC = () => {
  const [providers, setProviders] = useState<ProviderHealthItem[]>([]);
  const [summary, setSummary] = useState<Omit<ProviderHealthResponse, 'providers'> | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [usingPreview, setUsingPreview] = useState(false);

  const checkHealth = useCallback(async () => {
    setIsRefreshing(true);
    setError('');

    try {
      const healthData = await fetchApi<ProviderHealthResponse>('/api/providers/health');
      const nextProviders = healthData.providers || [];
      setProviders(nextProviders);
      setSummary({
        total: healthData.total || nextProviders.length,
        healthy: healthData.healthy || 0,
        degraded: healthData.degraded || 0,
        unhealthy: healthData.unhealthy || 0,
      });
      setUsingPreview(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : '数据源健康状态读取失败';
      setError(message);
      setProviders(previewProviders);
      setSummary({
        total: previewProviders.length,
        healthy: 0,
        degraded: previewProviders.length,
        unhealthy: 0,
      });
      setUsingPreview(true);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  const sortedProviders = useMemo(() => {
    const weight: Record<UiStatus, number> = {
      down: 0,
      degraded: 1,
      unknown: 2,
      checking: 3,
      healthy: 4,
    };
    return [...providers].sort((left, right) => {
      const statusDelta = weight[normalizeStatus(left.status)] - weight[normalizeStatus(right.status)];
      return statusDelta || left.name.localeCompare(right.name);
    });
  }, [providers]);

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xl font-medium text-neutral-100">
            <Server className="h-5 w-5 text-indigo-400" />
            数据源健康状态
          </h3>
          <p className="max-w-2xl text-sm text-neutral-400">
            监控后端 Provider 的最近调用结果、延迟、空结果和降级原因。非官方数据源仅用于研究辅助，关键结论需要人工复核。
          </p>
        </div>
        <button
          type="button"
          onClick={checkHealth}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {usingPreview && (
        <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="flex items-start gap-3">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">后端健康接口暂不可用，正在显示本地预览数据。</div>
              <div className="mt-1 text-amber-100/80">
                请确认 backend 8000 已启动，并且 CORS 允许当前前端地址。错误信息：{error}
              </div>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-neutral-500">总数</div>
            <div className="mt-1 text-lg font-semibold text-neutral-100">{summary.total}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="text-xs text-emerald-300/80">正常</div>
            <div className="mt-1 text-lg font-semibold text-emerald-300">{summary.healthy}</div>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="text-xs text-amber-300/80">降级</div>
            <div className="mt-1 text-lg font-semibold text-amber-300">{summary.degraded}</div>
          </div>
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <div className="text-xs text-red-300/80">不可用</div>
            <div className="mt-1 text-lg font-semibold text-red-300">{summary.unhealthy}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {isRefreshing && sortedProviders.length === 0 && (
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <ProviderStatusBadge status="checking" />
          </div>
        )}

        {!isRefreshing && !error && sortedProviders.length === 0 && (
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-neutral-400">
            暂无 Provider 健康记录。
          </div>
        )}

        {sortedProviders.map(provider => {
          const status = normalizeStatus(provider.status);
          const isFragile = provider.stability === 'fragile' || Boolean(provider.risk_note);
          const displayName = providerDisplayNames[provider.name] || provider.name;
          const lastError = sanitizeBackendText(provider.last_error);
          const riskNote = sanitizeBackendText(provider.risk_note);

          return (
            <div
              key={provider.name}
              className="rounded-lg border border-white/10 bg-black/20 p-4 transition-colors hover:bg-white/[0.03]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white/90">{displayName}</span>
                    <ProviderStatusBadge status={status} />
                    {usingPreview && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-neutral-300">
                        本地预览
                      </span>
                    )}
                    {isFragile && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                        <ShieldAlert className="h-3 w-3" />
                        非官方源
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">{formatTypes(provider.data_types)}</div>
                  <div className="mt-1 text-xs text-neutral-600">市场：{formatMarkets(provider.markets)}</div>
                  {lastError && (
                    <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">
                      最近失败：{lastError}
                    </div>
                  )}
                  {isFragile && (
                    <div className="mt-2 text-xs text-amber-200/80">
                      {riskNote || '非官方数据源接口可能变动，仅用于研究辅助。'}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-4 lg:min-w-[460px]">
                  <div>
                    <div className="mb-1 text-xs text-neutral-500">平均延迟</div>
                    <div className="font-mono text-sm text-neutral-300">{formatLatency(provider.avg_latency_ms)}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-neutral-500">最近成功</div>
                    <div className="text-xs text-neutral-300">{formatTime(provider.last_success)}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-neutral-500">连续失败</div>
                    <div className="font-mono text-sm text-neutral-300">{provider.consecutive_failures}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-neutral-500">空结果</div>
                    <div className="font-mono text-sm text-neutral-300">{provider.empty_count}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
