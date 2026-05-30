import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  FileImage,
  ImagePlus,
  LineChart as LineChartIcon,
  RefreshCw,
  SearchCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '../lib/utils';
import { STOCK_UNIVERSE, StockTarget, findStockTarget, formatStockLabel } from '../lib/stocks';
import { dispatchStockSelected, getPersistedStock, subscribeStockSelected } from '../lib/workspaceEvents';

type ChartTab = 'vision' | 'kline';
type Indicator = 'macd' | 'rsi';

interface KLinePoint {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  up: boolean;
  ma5: number;
  ma20: number;
  macd: number;
  rsi: number;
}

interface VisionSource {
  id: string;
  title: string;
  ticker: string;
  url?: string;
  kind: 'generated' | 'uploaded';
  confidence: number;
  description: string;
  signals: string[];
  assessment: string;
}

const formatNumber = (value: number, digits = 2) => value.toFixed(digits);

function mulberry32(seed: number) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromSymbol(symbol: string) {
  return symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function generateKLineData(stock: StockTarget, points = 48): KLinePoint[] {
  const random = mulberry32(seedFromSymbol(stock.symbol));
  const raw: Omit<KLinePoint, 'ma5' | 'ma20' | 'macd' | 'rsi'>[] = [];
  let open = stock.startPrice;

  for (let i = 0; i < points; i++) {
    const drift = stock.market === 'A股' ? 0.002 : 0.001;
    const swing = (random() - 0.47) * stock.startPrice * 0.035;
    const close = Math.max(0.5, open * (1 + drift) + swing);
    const high = Math.max(open, close) + random() * stock.startPrice * 0.014;
    const low = Math.max(0.1, Math.min(open, close) - random() * stock.startPrice * 0.014);
    const volume = 120000 + Math.round(random() * 950000);

    raw.push({
      date: `05-${String(i + 1).padStart(2, '0')}`,
      open: Number(open.toFixed(2)),
      close: Number(close.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      volume,
      up: close >= open,
    });
    open = close;
  }

  let ema12 = raw[0].close;
  let ema26 = raw[0].close;
  let dea = 0;

  return raw.map((item, index) => {
    const slice5 = raw.slice(Math.max(0, index - 4), index + 1);
    const slice20 = raw.slice(Math.max(0, index - 19), index + 1);
    const ma5 = slice5.reduce((sum, point) => sum + point.close, 0) / slice5.length;
    const ma20 = slice20.reduce((sum, point) => sum + point.close, 0) / slice20.length;

    if (index > 0) {
      ema12 = item.close * (2 / 13) + ema12 * (11 / 13);
      ema26 = item.close * (2 / 27) + ema26 * (25 / 27);
    }
    const dif = ema12 - ema26;
    dea = index === 0 ? dif : dif * (2 / 10) + dea * (8 / 10);

    const gains = raw.slice(Math.max(1, index - 13), index + 1).map((point, i, arr) => {
      const prev = i === 0 ? raw[Math.max(0, index - arr.length)] : arr[i - 1];
      return Math.max(0, point.close - prev.close);
    });
    const losses = raw.slice(Math.max(1, index - 13), index + 1).map((point, i, arr) => {
      const prev = i === 0 ? raw[Math.max(0, index - arr.length)] : arr[i - 1];
      return Math.max(0, prev.close - point.close);
    });
    const avgGain = gains.reduce((sum, value) => sum + value, 0) / Math.max(1, gains.length);
    const avgLoss = losses.reduce((sum, value) => sum + value, 0) / Math.max(1, losses.length);
    const rsi = avgLoss === 0 ? 78 : 100 - (100 / (1 + avgGain / avgLoss));

    return {
      ...item,
      ma5: Number(ma5.toFixed(2)),
      ma20: Number(ma20.toFixed(2)),
      macd: Number(((dif - dea) * 2).toFixed(2)),
      rsi: Number(rsi.toFixed(2)),
    };
  });
}

function buildVisionSource(stock: StockTarget, kind: VisionSource['kind'] = 'generated', url?: string, fileName?: string): VisionSource {
  const tone = stock.startPrice > 100 ? '高价核心资产' : '中低价弹性标的';
  return {
    id: `${kind}-${stock.symbol}-${fileName ?? 'kline'}`,
    title: kind === 'uploaded'
      ? `自定义上传图像「${fileName}」`
      : `${stock.name} ${stock.symbol} 动态K线形态截图`,
    ticker: stock.symbol,
    url,
    kind,
    confidence: kind === 'uploaded' ? 81 : 87,
    description: `${stock.name} 属于${stock.sector}方向，当前样本按${tone}的量价结构生成，用于演示多模态形态识别、支撑压力与资金行为归因。`,
    signals: [
      '短期价格位于 MA5 与 MA20 交汇区，适合观察方向选择',
      '成交量较前段温和放大，需结合资金流验证持续性',
      stock.market === 'A股' ? '涨跌停、换手率与主题热度会影响次日情绪' : '港股标的需额外关注汇率与南向资金',
    ],
    assessment: `${stock.name} 当前更适合做研究辅助判断：先核验价格、资金流和公告，再决定是否进入交易计划。本页面不构成投资建议。`,
  };
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as KLinePoint;
  const changePct = ((data.close - data.open) / data.open) * 100;
  return (
    <div className="min-w-44 rounded-xl border border-white/10 bg-[#111]/95 p-3 text-[11px] text-neutral-300 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between border-b border-white/5 pb-2 font-mono">
        <span>{label}</span>
        <span className={data.up ? 'text-rose-400' : 'text-emerald-400'}>
          {data.up ? '+' : ''}{formatNumber(changePct)}%
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
        <span className="text-neutral-500">开盘</span><span>{data.open}</span>
        <span className="text-neutral-500">最高</span><span className="text-rose-400">{data.high}</span>
        <span className="text-neutral-500">最低</span><span className="text-emerald-400">{data.low}</span>
        <span className="text-neutral-500">收盘</span><span>{data.close}</span>
        <span className="text-neutral-500">成交量</span><span>{(data.volume / 10000).toFixed(1)}万</span>
      </div>
    </div>
  );
}

function Candlestick(props: any) {
  const { x, width, payload, yAxis } = props;
  if (!payload || !yAxis?.scale) return null;

  const point = payload as KLinePoint;
  const color = point.up ? '#f43f5e' : '#10b981';
  const cx = x + width / 2;
  const yOpen = yAxis.scale(point.open);
  const yClose = yAxis.scale(point.close);
  const yHigh = yAxis.scale(point.high);
  const yLow = yAxis.scale(point.low);
  const rectY = Math.min(yOpen, yClose);
  const rectHeight = Math.max(Math.abs(yOpen - yClose), 1);

  return (
    <g>
      <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={1.4} />
      <rect x={x} y={rectY} width={width} height={rectHeight} fill={color} stroke={color} rx={0.5} />
    </g>
  );
}

export function MultimodalChart() {
  const initialStock = getPersistedStock() ?? STOCK_UNIVERSE[0];
  const [selectedStock, setSelectedStock] = useState<StockTarget>(initialStock);
  const [activeTab, setActiveTab] = useState<ChartTab>('vision');
  const [indicator, setIndicator] = useState<Indicator>('macd');
  const [showMA, setShowMA] = useState(true);
  const [isDiagnosticRunning, setIsDiagnosticRunning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string | undefined>();
  const [visionSource, setVisionSource] = useState<VisionSource>(() => buildVisionSource(initialStock));
  const [saveMessage, setSaveMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chartData = useMemo(() => generateKLineData(selectedStock), [selectedStock]);
  const selectableStocks = useMemo(
    () => [selectedStock, ...STOCK_UNIVERSE].filter((stock, index, list) => (
      list.findIndex((item) => item.symbol === stock.symbol) === index
    )),
    [selectedStock],
  );
  const lastPoint = chartData[chartData.length - 1];
  const firstPoint = chartData[0];
  const rangeReturn = ((lastPoint.close - firstPoint.open) / firstPoint.open) * 100;

  useEffect(() => {
    return subscribeStockSelected(({ stock }) => {
      const resolved = findStockTarget(stock.symbol) ?? stock;
      setSelectedStock(resolved);
      setVisionSource(buildVisionSource(resolved));
      setShowResult(false);
      setActiveTab('vision');
    });
  }, []);

  useEffect(() => {
    if (uploadedUrl) {
      return () => URL.revokeObjectURL(uploadedUrl);
    }
    return undefined;
  }, [uploadedUrl]);

  useEffect(() => {
    if (!isDiagnosticRunning) return;

    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          window.clearInterval(timer);
          setIsDiagnosticRunning(false);
          setShowResult(true);
          return 100;
        }
        return Math.min(100, prev + 12);
      });
    }, 220);

    return () => window.clearInterval(timer);
  }, [isDiagnosticRunning]);

  const selectStock = (stock: StockTarget) => {
    setSelectedStock(stock);
    setVisionSource(buildVisionSource(stock));
    setShowResult(false);
    dispatchStockSelected(stock, 'chart');
  };

  const startDiagnosis = () => {
    setProgress(0);
    setShowResult(false);
    setIsDiagnosticRunning(true);
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (uploadedUrl) {
      URL.revokeObjectURL(uploadedUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setUploadedUrl(objectUrl);
    setVisionSource(buildVisionSource(selectedStock, 'uploaded', objectUrl, file.name));
    setActiveTab('vision');
    setShowResult(false);
    event.target.value = '';
  };

  const useGeneratedKline = () => {
    if (uploadedUrl) {
      URL.revokeObjectURL(uploadedUrl);
      setUploadedUrl(undefined);
    }
    setVisionSource(buildVisionSource(selectedStock));
    setShowResult(false);
  };

  const saveDiagnosis = () => {
    const record = {
      stock: selectedStock,
      source: visionSource,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem('ai-finance:last-vision-diagnosis', JSON.stringify(record));
    setSaveMessage('诊断记录已保存到本地预览缓存。');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="flex h-full max-w-[1600px] flex-col overflow-hidden p-6 text-neutral-300 lg:p-8"
    >
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-display font-medium text-white">
            <LineChartIcon className="h-6 w-6 text-indigo-400" />
            K线 / 多模态解析端
          </h2>
          <p className="mt-1.5 text-xs font-mono text-neutral-500">
            顶部搜索会同步到本页；也可以上传截图，让视觉诊断绑定当前标的并输出可核验的形态结论。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            data-testid="chart-stock-select"
            value={selectedStock.symbol}
            onChange={(event) => {
              const stock = STOCK_UNIVERSE.find((item) => item.symbol === event.target.value);
              if (stock) selectStock(stock);
            }}
            className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-mono text-neutral-200 outline-none focus:border-indigo-500/50"
          >
            {selectableStocks.map((stock) => (
              <option key={stock.symbol} value={stock.symbol} className="bg-neutral-950">
                {formatStockLabel(stock)}
              </option>
            ))}
          </select>
          <div className="flex rounded-xl border border-white/5 bg-white/[0.02] p-1">
            <button
              type="button"
              data-testid="chart-tab-vision"
              onClick={() => setActiveTab('vision')}
              className={cn('rounded-lg px-4 py-1.5 text-xs font-medium transition-all', activeTab === 'vision' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300')}
            >
              图像诊断
            </button>
            <button
              type="button"
              data-testid="chart-tab-kline"
              onClick={() => setActiveTab('kline')}
              className={cn('rounded-lg px-4 py-1.5 text-xs font-medium transition-all', activeTab === 'kline' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300')}
            >
              交互K线
            </button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <div className="min-h-0 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.015]">
          <AnimatePresence mode="wait">
            {activeTab === 'vision' ? (
              <motion.div
                key="vision"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex h-full min-h-0 flex-col"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-black/30 px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold text-neutral-200">{visionSource.title}</p>
                    <p data-testid="chart-current-stock-label" className="mt-1 text-[10px] font-mono text-neutral-500">
                      当前标的：{formatStockLabel(selectedStock)} · {selectedStock.sector}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                    <button
                      data-testid="chart-upload-image"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-neutral-300 transition-colors hover:bg-white/[0.06]"
                    >
                      <Upload className="h-4 w-4" />
                      上传K线截图
                    </button>
                    <button
                      data-testid="chart-use-generated"
                      onClick={useGeneratedKline}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-neutral-300 transition-colors hover:bg-white/[0.06]"
                    >
                      <RefreshCw className="h-4 w-4" />
                      使用生成K线
                    </button>
                  </div>
                </div>

                <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/60 p-5">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:24px_24px]" />
                  {visionSource.url ? (
                    <img
                      data-testid="chart-upload-preview"
                      src={visionSource.url}
                      alt={visionSource.title}
                      className="relative z-10 max-h-full max-w-full rounded-xl border border-white/10 object-contain shadow-2xl"
                    />
                  ) : (
                    <div data-testid="chart-generated-kline" className="relative z-10 h-full min-h-[360px] w-full rounded-xl border border-white/10 bg-[#070707] p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                          <CartesianGrid stroke="#ffffff" strokeOpacity={0.04} vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 10 }} stroke="#222" />
                          <YAxis domain={['auto', 'auto']} tick={{ fill: '#737373', fontSize: 10 }} stroke="#222" />
                          <Tooltip content={<CustomTooltip />} />
                          {showMA && <Line type="monotone" dataKey="ma5" stroke="#facc15" strokeWidth={1.4} dot={false} />}
                          {showMA && <Line type="monotone" dataKey="ma20" stroke="#38bdf8" strokeWidth={1.4} dot={false} />}
                          <Bar dataKey="close" barSize={7} shape={<Candlestick />} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {isDiagnosticRunning && (
                    <motion.div
                      initial={{ y: -180 }}
                      animate={{ y: [-180, 180, -180] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute left-0 right-0 z-20 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_20px_rgba(129,140,248,0.9)]"
                    />
                  )}

                  <div data-testid="chart-source-badge" className="absolute left-5 top-5 z-20 rounded-lg border border-white/10 bg-black/70 px-3 py-1.5 text-[10px] font-mono text-neutral-300 backdrop-blur">
                    {visionSource.kind === 'uploaded' ? '用户上传' : '生成K线'} · {selectedStock.symbol}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 bg-black/35 px-5 py-4">
                  <p className="max-w-2xl text-xs leading-relaxed text-neutral-400">{visionSource.description}</p>
                  <button
                    data-testid="chart-start-vision"
                    onClick={startDiagnosis}
                    disabled={isDiagnosticRunning}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-semibold transition-all',
                      isDiagnosticRunning
                        ? 'border-indigo-500/20 bg-indigo-950/40 text-indigo-300'
                        : 'border-indigo-500 bg-indigo-600 text-white shadow-[0_0_18px_rgba(99,102,241,0.25)] hover:bg-indigo-500'
                    )}
                  >
                    <Sparkles className="h-4 w-4" />
                    {isDiagnosticRunning ? `解析中 ${progress}%` : '启动图像诊断'}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="kline"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex h-full min-h-0 flex-col"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-black/30 px-5 py-4">
                  <div>
                    <p data-testid="chart-kline-stock-label" className="text-xs font-semibold text-neutral-200">{formatStockLabel(selectedStock)} 量价沙盘</p>
                    <p className="mt-1 text-[10px] font-mono text-neutral-500">区间收益 {rangeReturn >= 0 ? '+' : ''}{formatNumber(rangeReturn)}% · 最新价 {lastPoint.close}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-400">
                      <input type="checkbox" checked={showMA} onChange={() => setShowMA((value) => !value)} />
                      显示均线
                    </label>
                    <div className="flex rounded-lg border border-white/5 bg-black/30 p-0.5">
                      {(['macd', 'rsi'] as Indicator[]).map((item) => (
                        <button
                          key={item}
                          onClick={() => setIndicator(item)}
                          className={cn('rounded px-3 py-1 text-[10px] font-mono uppercase', indicator === item ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300')}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col bg-black/45 p-4">
                  <div className="min-h-0 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -24, bottom: 0 }}>
                        <CartesianGrid stroke="#ffffff" strokeOpacity={0.04} vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 10 }} stroke="#222" />
                        <YAxis domain={['auto', 'auto']} tick={{ fill: '#737373', fontSize: 10 }} stroke="#222" />
                        <Tooltip content={<CustomTooltip />} />
                        {showMA && <Line type="monotone" dataKey="ma5" stroke="#facc15" strokeWidth={1.5} dot={false} />}
                        {showMA && <Line type="monotone" dataKey="ma20" stroke="#38bdf8" strokeWidth={1.5} dot={false} />}
                        <Bar dataKey="close" barSize={7} shape={<Candlestick />} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="my-3 h-px bg-white/5" />
                  <div className="h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 4, right: 10, left: -24, bottom: 0 }}>
                        <CartesianGrid stroke="#ffffff" strokeOpacity={0.04} vertical={false} />
                        <XAxis dataKey="date" hide />
                        <YAxis tick={{ fill: '#737373', fontSize: 10 }} stroke="#222" />
                        <Tooltip content={<CustomTooltip />} />
                        {indicator === 'macd' ? (
                          <Bar dataKey="macd" barSize={4}>
                            {chartData.map((entry, index) => (
                              <Cell key={index} fill={entry.macd >= 0 ? '#f43f5e' : '#10b981'} fillOpacity={0.75} />
                            ))}
                          </Bar>
                        ) : (
                          <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
                        )}
                        {indicator === 'rsi' && <ReferenceLine y={70} stroke="#f43f5e" strokeOpacity={0.35} strokeDasharray="3 3" />}
                        {indicator === 'rsi' && <ReferenceLine y={30} stroke="#10b981" strokeOpacity={0.35} strokeDasharray="3 3" />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10">
              <Eye className="h-4 w-4 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">多模态诊断报告</h3>
              <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">图像识别与量价归因</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-white/5 bg-black/25 p-3">
              <p className="mb-1 text-[10px] text-neutral-500">解析标的</p>
              <p className="font-semibold text-neutral-200">{selectedStock.name}</p>
              <p className="mt-1 font-mono text-[10px] text-indigo-300">{selectedStock.symbol}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/25 p-3">
              <p className="mb-1 text-[10px] text-neutral-500">数据形态</p>
              <p className="font-semibold text-neutral-200">{visionSource.kind === 'uploaded' ? '上传截图' : '生成K线'}</p>
              <p className="mt-1 font-mono text-[10px] text-emerald-300">置信度 {visionSource.confidence}%</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
            <AnimatePresence mode="wait">
              {isDiagnosticRunning && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center"
                >
                  <div className="relative flex h-16 w-16 items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-400"
                    />
                    <FileImage className="h-6 w-6 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-100">正在解析图像与量价结构</p>
                    <p className="mt-1 text-[11px] text-neutral-500">扫描趋势线、成交量、均线、指标背离与异常波动</p>
                  </div>
                </motion.div>
              )}

              {!isDiagnosticRunning && showResult && (
                <motion.div data-testid="chart-diagnosis-result" key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-indigo-300">诊断结论</p>
                    <h4 className="text-sm font-semibold text-white">{visionSource.title}</h4>
                    <p className="mt-2 text-xs leading-relaxed text-neutral-400">{visionSource.assessment}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">识别信号</p>
                    {visionSource.signals.map((signal) => (
                      <div key={signal} className="flex gap-2.5 rounded-lg border border-white/5 bg-black/25 p-3 text-xs text-neutral-300">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-300" />
                        <span>{signal}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-100/80">
                    AI 图像诊断只作为研究辅助。若要进入交易决策，请继续核验实时行情、公告、资金流与风险事件。
                  </div>

                  <button data-testid="chart-save-diagnosis" onClick={saveDiagnosis} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-neutral-300 transition-colors hover:bg-white/[0.06]">
                    <Download className="h-3.5 w-3.5" />
                    保存诊断记录
                  </button>
                  {saveMessage && (
                    <p className="text-[11px] text-emerald-300">{saveMessage}</p>
                  )}
                </motion.div>
              )}

              {!isDiagnosticRunning && !showResult && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center text-neutral-500">
                  <ImagePlus className="h-9 w-9 text-neutral-600" />
                  <div>
                    <p className="text-sm text-neutral-300">选择标的、上传截图或使用生成K线后开始解析</p>
                    <p className="mt-1 max-w-sm text-[11px] leading-relaxed">
                      顶部搜索、下拉选股和上传图像都会绑定到当前诊断上下文，避免“搜索了股票但解析的是别的图”的断层。
                    </p>
                  </div>
                  <div data-testid="chart-sync-badge" className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">
                    <SearchCheck className="h-3.5 w-3.5" />
                    当前同步：{formatStockLabel(selectedStock)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/5 pt-4 text-center text-[10px] font-mono text-neutral-500">
            <div className="rounded-lg bg-black/20 p-2">
              <Activity className="mx-auto mb-1 h-3.5 w-3.5 text-rose-400" />
              涨跌幅 {rangeReturn >= 0 ? '+' : ''}{formatNumber(rangeReturn)}%
            </div>
            <div className="rounded-lg bg-black/20 p-2">
              <BarChart3 className="mx-auto mb-1 h-3.5 w-3.5 text-indigo-300" />
              样本 {chartData.length} 日
            </div>
            <div className="rounded-lg bg-black/20 p-2">
              <Sparkles className="mx-auto mb-1 h-3.5 w-3.5 text-emerald-300" />
              可追踪
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
