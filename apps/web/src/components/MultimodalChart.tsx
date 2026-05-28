import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart as ChartIcon, 
  Settings2, 
  Eye, 
  Sparkles, 
  Play, 
  CheckCircle, 
  Sliders, 
  SlidersHorizontal,
  ChevronDown, 
  Info, 
  ImagePlus, 
  TrendingUp, 
  TrendingDown, 
  Download,
  Flame,
  Zap
} from 'lucide-react';
import { ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Cell, ReferenceLine, Tooltip } from 'recharts';
import { cn } from '../lib/utils';
import { api, normalizeDisplayError, PriceBar, TechnicalSnapshot } from '../lib/api';
import { SafeResponsiveContainer } from './SafeResponsiveContainer';

interface MultimodalChartProps {
  symbol?: string;
  stockName?: string;
}

// Generate complex financial charting data structure with mathematically accurate candlestick variables
const generateInteractiveChartData = (points: number, startPrice: number = 1720) => {
  let open = startPrice;
  const rawLength = points + 50;
  
  // 1. Generate core candlestick data (prices) with realistic daily momentum
  const rawData = Array.from({ length: rawLength }).map((_, i) => {
    // Apply minor daily market trends
    const trend = i > rawLength / 2 ? 15 : -3;
    const amplitude = startPrice * 0.02; // relative fluctuation size based on price level
    const change = (Math.random() * amplitude - (amplitude / 2)) + trend * (startPrice * 0.0001);
    const close = Math.round((open + change) * 100) / 100;
    
    // Range/amplitude of shadows
    const shadowAmp = Math.random() * (startPrice * 0.015);
    const high = Math.round((Math.max(open, close) + shadowAmp * 0.4) * 100) / 100;
    const low = Math.round((Math.min(open, close) - shadowAmp * 0.4) * 100) / 100;
    const isUp = close >= open;
    const volume = Math.round(200000 + Math.random() * 600000);

    const item = {
      open,
      close,
      high,
      low,
      up: isUp,
      volume
    };
    open = close;
    return item;
  });

  // 2. Compute authentic financial indicators (MA5, MA20, BB, MACD, RSI)
  let ema12 = rawData[0].close;
  let ema26 = rawData[0].close;
  let dea = 0;
  
  // RSI status arrays (gain / loss calculations)
  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < rawLength; i++) {
    const diff = rawData[i].close - rawData[i - 1].close;
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  const computedData = rawData.map((item, i) => {
    // ---- Real Simple Moving Averages ----
    const getSMA = (period: number) => {
      const start = Math.max(0, i - period + 1);
      const slice = rawData.slice(start, i + 1);
      const sum = slice.reduce((acc, d) => acc + d.close, 0);
      return sum / slice.length;
    };
    const ma5 = getSMA(5);
    const ma20 = getSMA(20);

    // ---- Real Bollinger Bands (2.0 Standard Deviations) ----
    let stdDev = 0;
    const bbSliceStart = Math.max(0, i - 19);
    const bbSlice = rawData.slice(bbSliceStart, i + 1);
    if (bbSlice.length > 1) {
      const variance = bbSlice.reduce((acc, d) => acc + Math.pow(d.close - ma20, 2), 0) / bbSlice.length;
      stdDev = Math.sqrt(variance);
    }
    const bbUpper = ma20 + (2.0 * stdDev);
    const bbLower = ma20 - (2.0 * stdDev);

    // ---- MACD Indicator (12, 26, 9) ----
    if (i > 0) {
      const k12 = 2 / (12 + 1);
      ema12 = item.close * k12 + ema12 * (1 - k12);
      
      const k26 = 2 / (26 + 1);
      ema26 = item.close * k26 + ema26 * (1 - k26);
    }
    const dif = ema12 - ema26;
    if (i > 0) {
      const k9 = 2 / (9 + 1);
      dea = dif * k9 + dea * (1 - k9);
    } else {
      dea = dif;
    }
    const macd = (dif - dea) * 2;

    // ---- Real RSI-14 Indicator ----
    let rsi = 50;
    const rsiPeriod = 14;
    if (i >= rsiPeriod) {
      const avgGain = gains.slice(i - rsiPeriod + 1, i + 1).reduce((sum, g) => sum + g, 0) / rsiPeriod;
      const avgLoss = losses.slice(i - rsiPeriod + 1, i + 1).reduce((sum, l) => sum + l, 0) / rsiPeriod;
      const rs = avgLoss > 0 ? avgGain / avgLoss : 999;
      rsi = 100 - (100 / (1 + rs));
    } else if (i > 0) {
      const avgGain = gains.slice(0, i + 1).reduce((sum, g) => sum + g, 0) / i;
      const avgLoss = losses.slice(0, i + 1).reduce((sum, l) => sum + l, 0) / i;
      const rs = avgLoss > 0 ? avgGain / avgLoss : 999;
      rsi = 100 - (100 / (1 + rs));
    }

    return {
      index: i,
      // Sequential dates
      date: `05-${String(Math.floor(i / 5) * 7 + (i % 5) + 1).padStart(2, '0')}`,
      ...item,
      ma5: Math.round(ma5 * 100) / 100,
      ma20: Math.round(ma20 * 100) / 100,
      bbUpper: Math.round(bbUpper * 100) / 100,
      bbLower: Math.round(bbLower * 100) / 100,
      rsi: Math.round(rsi * 100) / 100,
      macd: Math.round(macd * 100) / 100
    };
  });

  // Slice off warm-up window of 50 periods
  return computedData.slice(50);
};

const average = (items: number[]) => items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : 0;

const buildChartDataFromBars = (bars: PriceBar[], fallbackPoints = 35) => {
  const sorted = [...bars].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const source = sorted.slice(-Math.max(fallbackPoints, 35));
  let ema12 = source[0]?.close || 0;
  let ema26 = source[0]?.close || 0;
  let dea = 0;

  return source.map((bar, index) => {
    const close = Number(bar.close || 0);
    const open = Number(bar.open || close);
    const high = Number(bar.high || Math.max(open, close));
    const low = Number(bar.low || Math.min(open, close));
    const closes = source.slice(Math.max(0, index - 19), index + 1).map(item => Number(item.close || 0));
    const ma5 = average(source.slice(Math.max(0, index - 4), index + 1).map(item => Number(item.close || 0)));
    const ma20 = average(closes);
    const variance = closes.length > 1 ? average(closes.map(value => Math.pow(value - ma20, 2))) : 0;

    if (index > 0) {
      ema12 = close * (2 / 13) + ema12 * (1 - 2 / 13);
      ema26 = close * (2 / 27) + ema26 * (1 - 2 / 27);
    }
    const dif = ema12 - ema26;
    dea = index === 0 ? dif : dif * (2 / 10) + dea * (1 - 2 / 10);
    const macd = (dif - dea) * 2;

    const rsiWindow = source.slice(Math.max(0, index - 14), index + 1);
    let gains = 0;
    let losses = 0;
    rsiWindow.forEach((item, i) => {
      if (i === 0) return;
      const diff = Number(item.close || 0) - Number(rsiWindow[i - 1].close || 0);
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    });
    const rsi = losses === 0 ? 100 : 100 - (100 / (1 + gains / losses));

    return {
      index,
      date: String(bar.date || '').slice(5) || `${index + 1}`,
      open,
      close,
      high,
      low,
      up: close >= open,
      volume: Number(bar.volume || 0),
      ma5: Math.round(ma5 * 100) / 100,
      ma20: Math.round(ma20 * 100) / 100,
      bbUpper: Math.round((ma20 + 2 * Math.sqrt(variance)) * 100) / 100,
      bbLower: Math.round((ma20 - 2 * Math.sqrt(variance)) * 100) / 100,
      rsi: Math.round(rsi * 100) / 100,
      macd: Math.round(macd * 10000) / 10000,
    };
  });
};

const getTickerCode = (ticker: string) => ticker.match(/\d{5,6}/)?.[0] || ticker;

const tickerForSymbol = (value: string) => {
  const code = getTickerCode(value);
  if (/^\d{6}$/.test(code)) return `${code}.${code.startsWith('6') ? 'SH' : 'SZ'}`;
  return value;
};

const CHART_PRESETS = [
  {
    id: 'm_top',
    title: '贵州茅台「双顶阻力区间」研判',
    ticker: '600519.SH',
    url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
    description: '日线级别于1780-1810区间形成局部双顶结构，成交量明显萎缩背离，属于典型压力位反转验证样本。',
    signals: ['双肩双顶形态确认', '成交量阶梯性缩减', 'RSI死叉向下突破超买区'],
    assessment: '高空阻力较大，多头需防御回撤，建议逢反弹减仓至1510重位支撑。',
    confidence: 88
  },
  {
    id: 'double_bottom',
    title: '海通证券「底部箱盘底突破」',
    ticker: '600837.SH',
    url: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=600&q=80',
    description: '经历14个月中长周期下行后，在箱底7.20元构筑横盘收缩蓄能，配合大金融板块脉冲，形成极高概率底部突破。',
    signals: ['箱顶突破确认', '爆量金叉上穿年线', '主力资金红柱密集抬升'],
    assessment: '突破成功率高，建议设立回踩7.45建仓区，看空间幅度可至9.30阻力。',
    confidence: 94
  },
  {
    id: 'cup_handle',
    title: '招商银行「杯柄形态中继上涨」',
    ticker: '600036.SH',
    url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=600&q=80',
    description: '周线级别展开宽幅震荡整理。杯身筑圆弧，杯柄呈下降狭长通道整理，高频小幅换手在均线上方获得充分多头中继。',
    signals: ['杯柄下行压制轨跃出', 'MACD零轴上方二次生叉', 'MA20、MA60多头排列形成'],
    assessment: '具备中期波段加速特质，建议轻仓多试探，安全防守位设在均线处。',
    confidence: 82
  }
];

const STOCKS = [
  { name: '贵州茅台', ticker: '600519.SH', startPrice: 1720 },
  { name: '招商银行', ticker: '600036.SH', startPrice: 33.50 },
  { name: '海通证券', ticker: '600837.SH', startPrice: 7.80 }
];

// Custom Candlestick Component for Recharts Bar
const Candlestick = (props: any) => {
  const { x, y, width, height, payload, yAxis } = props;
  if (!payload) return null;

  const { open, close, high, low } = payload;
  const isUp = close >= open;
  const strokeColor = isUp ? '#f43f5e' : '#10b981';

  let yOpen, yClose, yHigh, yLow;

  if (yAxis && typeof yAxis.scale === 'function') {
    yOpen = yAxis.scale(open);
    yClose = yAxis.scale(close);
    yHigh = yAxis.scale(high);
    yLow = yAxis.scale(low);
  } else {
    // Math interpolator fallback
    const bodyRange = Math.abs(close - open);
    const scaleFactor = bodyRange > 0 ? height / bodyRange : 0;
    const maxVal = Math.max(open, close);
    
    yOpen = scaleFactor > 0 ? y + (maxVal - open) * scaleFactor : y;
    yClose = scaleFactor > 0 ? y + (maxVal - close) * scaleFactor : y + height;
    yHigh = scaleFactor > 0 ? y + (maxVal - high) * scaleFactor : y;
    yLow = scaleFactor > 0 ? y + (maxVal - low) * scaleFactor : y + height;
  }

  const cx = x + width / 2;
  const rectY = Math.min(yOpen, yClose);
  const rectHeight = Math.max(Math.abs(yOpen - yClose), 1);

  return (
    <g>
      {/* High-Low shadow line */}
      <line
        x1={cx}
        y1={yHigh}
        x2={cx}
        y2={yLow}
        stroke={strokeColor}
        strokeWidth={1.5}
      />
      {/* Real-Body rect */}
      <rect
        x={x}
        y={rectY}
        width={width}
        height={rectHeight}
        fill={strokeColor}
        stroke={strokeColor}
        strokeWidth={1.5}
      />
    </g>
  );
};

// Rich customized financial chart tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const hasCandle = typeof data.open === 'number' && typeof data.close === 'number';
    const isUp = hasCandle ? data.close >= data.open : (Number(data.macd || 0) >= 0);
    const changePct = hasCandle && data.open
      ? (((data.close - data.open) / data.open) * 100).toFixed(2)
      : '';
    
    return (
      <div className="bg-[#171717]/95 border border-[#2d2d2d] rounded-xl p-3 shadow-2xl font-mono text-[11px] space-y-1.5 min-w-[170px] text-neutral-300 backdrop-blur-md">
        <div className="flex justify-between items-center border-b border-white/5 pb-1.5 mb-2">
          <span className="font-semibold text-neutral-400">{label || data.date}</span>
          <span className={isUp ? 'text-rose-500 font-bold' : 'text-emerald-500 font-bold'}>
            {hasCandle ? `${isUp ? '▲' : '▼'} ${isUp ? '+' : ''}${changePct}%` : `RSI ${data.rsi ?? '--'}`}
          </span>
        </div>
        {hasCandle ? (
          <>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">开盘价 Open:</span>
              <span className="text-neutral-200">{data.open}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">最高价 High:</span>
              <span className="text-rose-400">{data.high}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">最低价 Low:</span>
              <span className="text-emerald-400">{data.low}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">收盘价 Close:</span>
              <span className={isUp ? 'text-rose-500 font-semibold' : 'text-emerald-500 font-semibold'}>{data.close}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">成交量 Vol:</span>
              <span className="text-indigo-400">{(data.volume / 10000).toFixed(1)}万股</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">MACD:</span>
              <span className={Number(data.macd || 0) >= 0 ? 'text-rose-400' : 'text-emerald-400'}>{data.macd ?? '--'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">RSI:</span>
              <span className="text-indigo-300">{data.rsi ?? '--'}</span>
            </div>
          </>
        )}
        
        {data.ma5 && (
          <div className="flex justify-between gap-4 border-t border-white/5 pt-1.5 mt-2 text-[10px]">
            <span className="text-yellow-500/80">MA5 均线:</span>
            <span className="text-yellow-500 font-semibold">{data.ma5}</span>
          </div>
        )}
        {data.ma20 && (
          <div className="flex justify-between gap-4 text-[10px]">
            <span className="text-emerald-500/80">MA20 均线:</span>
            <span className="text-emerald-500 font-semibold">{data.ma20}</span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export function MultimodalChart({ symbol = '600519', stockName = '贵州茅台' }: MultimodalChartProps) {
  const [selectedStock, setSelectedStock] = useState(STOCKS[0]);
  const [chartData, setChartData] = useState(() => generateInteractiveChartData(35, 1720));
  const [selectedPreset, setSelectedPreset] = useState(CHART_PRESETS[0]);
  const [technicalSnapshot, setTechnicalSnapshot] = useState<TechnicalSnapshot | null>(null);
  const [chartStatus, setChartStatus] = useState('正在同步行情数据');
  const [showMA, setShowMA] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [secondaryIndicator, setSecondaryIndicator] = useState<'rsi' | 'macd'>('macd');
  const [isDiagnosticRunning, setIsDiagnosticRunning] = useState(false);
  const [showAIVisualResult, setShowAIVisualResult] = useState(false);
  const [diagnosticProgress, setDiagnosticProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'kline' | 'preset'>('kline');
  const [uploadedImage, setUploadedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [visionReport, setVisionReport] = useState('');

  const activeSymbol = getTickerCode(selectedStock.ticker);
  const stockOptions = [
    selectedStock,
    ...STOCKS.filter(item => getTickerCode(item.ticker) !== activeSymbol),
  ];
  const technicalSummary = (technicalSnapshot?.summary || {}) as Record<string, unknown>;
  const supportResistance = (technicalSnapshot?.support_resistance || {}) as Record<string, unknown>;
  const latestPoint = chartData[chartData.length - 1];
  const supportLevels = Array.isArray(supportResistance.support) ? supportResistance.support as number[] : [];
  const resistanceLevels = Array.isArray(supportResistance.resistance) ? supportResistance.resistance as number[] : [];

  useEffect(() => {
    setSelectedStock({
      name: stockName,
      ticker: tickerForSymbol(symbol),
      startPrice: Number(latestPoint?.close || 1720),
    });
    setActiveTab('kline');
    setShowAIVisualResult(false);
  }, [symbol, stockName]);

  useEffect(() => {
    let cancelled = false;

    async function loadChartData() {
      setChartStatus(`正在加载 ${selectedStock.name} (${activeSymbol}) 后端行情与技术指标...`);
      const [technicalResult, priceResult] = await Promise.allSettled([
        api.technical(activeSymbol, 250),
        api.prices(activeSymbol, 180),
      ]);

      if (cancelled) return;

      let bars: PriceBar[] = [];
      if (technicalResult.status === 'fulfilled' && technicalResult.value.success && technicalResult.value.data) {
        setTechnicalSnapshot(technicalResult.value.data);
        const indicatorBars = technicalResult.value.data.bars;
        if (Array.isArray(indicatorBars)) {
          bars = indicatorBars as PriceBar[];
        }
      }

      if (!bars.length && priceResult.status === 'fulfilled' && priceResult.value.success && priceResult.value.data?.bars?.length) {
        bars = priceResult.value.data.bars;
      }

      if (!bars.length) {
        const fetched = await api.priceFetch(activeSymbol, 180);
        if (!cancelled && fetched.success) {
          const reloaded = await api.prices(activeSymbol, 180);
          if (!cancelled && reloaded.success && reloaded.data?.bars?.length) {
            bars = reloaded.data.bars;
          }
        }
      }

      if (cancelled) return;

      if (bars.length) {
        setChartData(buildChartDataFromBars(bars, 80));
        setChartStatus(`已接入后端 ${bars.length} 根K线，图表由真实行情驱动`);
      } else {
        setChartData(generateInteractiveChartData(35, selectedStock.startPrice));
        setChartStatus('后端暂未返回行情，当前显示本地兜底曲线');
      }
    }

    loadChartData();
    return () => {
      cancelled = true;
    };
  }, [activeSymbol, selectedStock.name]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const preview = String(reader.result || '');
      const base64 = preview.split(',')[1] || '';
      setUploadedImage({ base64, mimeType: file.type || 'image/png', preview });
      setVisionReport('');
      setShowAIVisualResult(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAIVisionDiagnosis = async () => {
    setIsDiagnosticRunning(true);
    setDiagnosticProgress(0);
    setShowAIVisualResult(false);
    setVisionReport('');

    if (uploadedImage?.base64) {
      const result = await api.visionReport({
        image_base64: uploadedImage.base64,
        mime_type: uploadedImage.mimeType,
        ticker: activeSymbol,
        user_context: `${selectedStock.name} ${activeSymbol} K线截图诊断`,
      });
      setVisionReport(result.success && result.data?.report ? result.data.report : normalizeDisplayError(result.error, '视觉模型暂未返回结构化报告。'));
    } else if (activeTab === 'kline') {
      setVisionReport(
        `${selectedStock.name} (${activeSymbol}) 后端技术摘要：收盘 ${technicalSummary.close || latestPoint?.close || '--'}，MA5 ${technicalSummary.ma5 || latestPoint?.ma5 || '--'}，MA20 ${technicalSummary.ma20 || latestPoint?.ma20 || '--'}，RSI ${technicalSummary.rsi || latestPoint?.rsi || '--'}。`,
      );
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isDiagnosticRunning) {
      interval = setInterval(() => {
        setDiagnosticProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsDiagnosticRunning(false);
            setShowAIVisualResult(true);
            return 100;
          }
          return prev + 10;
        });
      }, 250);
    }
    return () => clearInterval(interval);
  }, [isDiagnosticRunning]);

  const diagnosticSignals = (activeTab === 'kline' || uploadedImage)
    ? [
        `收盘价 ${technicalSummary.close || latestPoint?.close || '--'}，MA5 ${technicalSummary.ma5 || latestPoint?.ma5 || '--'}，MA20 ${technicalSummary.ma20 || latestPoint?.ma20 || '--'}`,
        `MACD ${technicalSummary.macd || latestPoint?.macd || '--'}，RSI ${technicalSummary.rsi || latestPoint?.rsi || '--'}，量比 ${technicalSummary.volume_ratio || '--'}`,
        `支撑位 ${supportLevels.join(' / ') || '--'}，压力位 ${resistanceLevels.join(' / ') || '--'}`,
      ]
    : selectedPreset.signals;

  const diagnosticAssessment = visionReport || (
    activeTab === 'kline'
      ? `${selectedStock.name} 当前图表已接入后端行情与技术指标。若 RSI 接近超买区且价格逼近压力位，应降低追高仓位；若价格回踩支撑并放量企稳，可作为进一步分析入口。`
      : selectedPreset.assessment
  );

  const saveDiagnostic = () => {
    const content = [
      `# ${selectedStock.name} (${activeSymbol}) 技术诊断`,
      '',
      `- 数据状态: ${chartStatus}`,
      `- 收盘价: ${technicalSummary.close || latestPoint?.close || '--'}`,
      `- RSI: ${technicalSummary.rsi || latestPoint?.rsi || '--'}`,
      `- MACD: ${technicalSummary.macd || latestPoint?.macd || '--'}`,
      '',
      diagnosticAssessment,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeSymbol}-technical-diagnosis.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="p-6 lg:p-8 max-w-[1600px] mx-auto text-neutral-300 flex flex-col h-full overflow-hidden"
    >
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-display font-medium text-white flex items-center gap-3">
            <ChartIcon className="w-6.5 h-6.5 text-indigo-400" />
            K线 / 多模态解析端
          </h2>
          <p className="text-xs text-neutral-500 mt-1.5 font-mono">
            {chartStatus}
          </p>
        </div>

        {/* Tab-toggle layout */}
        <div className="flex bg-white/[0.02] p-1 border border-white/5 rounded-xl self-start md:self-auto shadow-inner">
          <button 
            onClick={() => setActiveTab('preset')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all",
              activeTab === 'preset' ? "bg-white/10 text-white shadow" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            多模态演示样本 (视觉接口可诊断上传图)
          </button>
          <button 
            onClick={() => setActiveTab('kline')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all",
              activeTab === 'kline' ? "bg-white/10 text-white shadow" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            互动行情沙盘 (量价指标调配)
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0 overflow-hidden">
        
        {/* Left Column: Chart Area (Preset Image Mode or Interactive Line chart mode) */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          
          <AnimatePresence mode="wait">
            {activeTab === 'preset' ? (
              <motion.div 
                key="preset"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                className="flex-1 flex flex-col gap-6 min-h-0"
              >
                {/* Highlight Preset Selecting List */}
                <div className="grid grid-cols-3 gap-4 flex-shrink-0">
                  {CHART_PRESETS.map((p) => {
                    const isSelected = selectedPreset.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPreset(p);
                          setShowAIVisualResult(false);
                        }}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all cursor-pointer relative",
                          isSelected 
                            ? "bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]" 
                            : "bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.03]"
                        )}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold text-neutral-200 line-clamp-1">{p.title.split('「')[0]}</span>
                          <span className="text-[10px] font-mono text-neutral-500 uppercase shrink-0">{p.ticker}</span>
                        </div>
                        <p className="text-[10px] font-mono text-indigo-400 font-medium line-clamp-1">{p.title.match(/「(.*?)」/)?.[1]}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Main Visual Frame with scanner */}
                <div className="flex-1 bg-white/[0.01] border border-white/5 rounded-2xl overflow-hidden relative flex flex-col min-h-0 min-w-0">
                  {/* Subtle Background Net */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
                  
                  {/* The visual image frame */}
                  <div className="flex-1 relative flex items-center justify-center p-4 bg-black/60 min-h-0 min-w-0 overflow-hidden shadow-inner">
                    <img 
                      src={uploadedImage?.preview || selectedPreset.url} 
                      alt={uploadedImage ? `${selectedStock.name} 上传截图` : selectedPreset.title} 
                      className={cn(
                        "max-h-full max-w-full rounded-lg object-contain opacity-65",
                        !uploadedImage && "mix-blend-screen",
                      )}
                    />

                    {/* Active Scanning Bar */}
                    {isDiagnosticRunning && (
                      <motion.div 
                        initial={{ y: -50 }}
                        animate={{ y: [0, 360, 0] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_15px_rgba(129,140,248,0.8)] z-10"
                      />
                    )}

                    {/* Overlaid ticker tag preview */}
                    <div className="absolute top-4 left-4 bg-black/70 border border-white/10 rounded px-2.5 py-1 text-[10px] font-mono select-none flex items-center gap-1.5 backdrop-blur-md">
                      <Zap className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                      CODENAME: {selectedPreset.id.toUpperCase()} 
                    </div>

                    <div className="absolute top-4 right-4 bg-black/70 border border-white/10 rounded px-2.5 py-1 text-[10px] font-mono select-none flex items-center gap-1.5 backdrop-blur-md">
                      CONFIDENCE: <span className="text-emerald-400 font-bold">{selectedPreset.confidence}%</span>
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="p-4 px-5 border-t border-white/5 bg-black/40 flex-shrink-0 flex items-center justify-between">
                    <div className="min-w-0 mr-4">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 block mb-0.5">多模态特征识别摘要</span>
                      <p className="text-xs text-neutral-300 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-xl italic">
                        "{uploadedImage ? `${selectedStock.name} 本地K线截图已载入，可调用后端视觉接口诊断。` : selectedPreset.description}"
                      </p>
                    </div>

                    <label className="px-3 py-2 mr-3 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer flex-shrink-0 bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 border border-white/10">
                      <ImagePlus className="w-4 h-4" />
                      上传截图
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>

                    <button 
                      onClick={handleAIVisionDiagnosis}
                      disabled={isDiagnosticRunning}
                      className={cn(
                        "px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 tracking-wide cursor-pointer flex-shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.2)]",
                        isDiagnosticRunning 
                          ? "bg-indigo-950/40 border border-indigo-500/20 text-indigo-400" 
                          : "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500"
                      )}
                    >
                      <Sparkles className="w-4 h-4" />
                      {isDiagnosticRunning ? `多模态解构中 (${diagnosticProgress}%)` : `启动 Vision 图像诊断`}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="kline"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                className="flex-1 flex flex-col gap-5 min-h-0"
              >
                {/* Advanced parameters selectors */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex-shrink-0">
                  <div className="flex flex-wrap gap-4 items-center">
                    {/* Stock selection dropdown */}
                    <div className="flex items-center gap-2.5 border-r border-white/10 pr-4 mr-2">
                      <span className="text-[11px] font-mono text-neutral-500 uppercase">标的:</span>
                      <select 
                        value={selectedStock.ticker}
                        onChange={(e) => {
                          const stock = STOCKS.find(s => s.ticker === e.target.value);
                          if (stock) setSelectedStock(stock);
                        }}
                        className="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-xs text-indigo-400 font-semibold font-mono focus:outline-none focus:border-indigo-500/50 cursor-pointer transition-colors"
                      >
                        {stockOptions.map(s => (
                          <option key={s.ticker} value={s.ticker} className="bg-neutral-900 text-neutral-200">
                            {s.name} ({s.ticker})
                          </option>
                        ))}
                      </select>
                    </div>

                    <span className="text-xs font-mono text-neutral-400 flex items-center gap-1.5 mr-1">
                      <SlidersHorizontal className="w-3.5 h-3.5" /> 技术参数:
                    </span>
                    
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-neutral-400 select-none">
                      <input 
                        type="checkbox" 
                        checked={showMA} 
                        onChange={() => setShowMA(!showMA)}
                        className="rounded border-white/10 text-indigo-600 focus:ring-0 w-3.5 h-3.5 bg-black/40"
                      />
                      均线 (MA5、MA20)
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-neutral-400 select-none">
                      <input 
                        type="checkbox" 
                        checked={showBB} 
                        onChange={() => setShowBB(!showBB)}
                        className="rounded border-white/10 text-indigo-600 focus:ring-0 w-3.5 h-3.5 bg-black/40"
                      />
                      布林通道 (Bollinger Bands)
                    </label>
                  </div>

                  {/* Secondary select */}
                  <div className="flex bg-black/20 p-0.5 rounded-lg border border-white/5 items-center">
                    <button 
                      onClick={() => setSecondaryIndicator('macd')}
                      className={cn(
                        "px-3 py-1 rounded text-[10px] font-mono uppercase cursor-pointer",
                        secondaryIndicator === 'macd' ? "bg-white/10 text-white font-medium" : "text-neutral-500 hover:text-neutral-300"
                      )}
                    >
                      MACD
                    </button>
                    <button 
                      onClick={() => setSecondaryIndicator('rsi')}
                      className={cn(
                        "px-3 py-1 rounded text-[10px] font-mono uppercase cursor-pointer",
                        secondaryIndicator === 'rsi' ? "bg-white/10 text-white font-medium" : "text-neutral-500 hover:text-neutral-300"
                      )}
                    >
                      RSI
                    </button>
                  </div>
                </div>

                {/* Composed Chart Frame */}
                <div className="flex-1 bg-white/[0.01] border border-white/5 rounded-2xl overflow-hidden flex flex-col p-4 bg-black/40 min-h-0 min-w-0">
                  {/* Top Chart Box */}
                  <div className="flex-1 min-h-0 relative">
                    <SafeResponsiveContainer minHeight={220}>
                      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid stroke="#ffffff" strokeOpacity={0.03} strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 9, fontFamily: 'monospace' }} stroke="#ffffff" strokeOpacity={0.03} />
                        <YAxis domain={['auto', 'auto']} tick={{ fill: '#6b7280', fontSize: 9, fontFamily: 'monospace' }} stroke="#ffffff" strokeOpacity={0.03} />
                        <Tooltip content={<CustomTooltip />} />
                        
                        {showBB && (
                          <Area type="monotone" dataKey="bbUpper" stroke="none" fill="#4f46e5" fillOpacity={0.05} />
                        )}
                        {showBB && (
                          <Line type="monotone" dataKey="bbLower" stroke="#4f46e5" strokeOpacity={0.3} strokeWidth={1} dot={false} strokeDasharray="3 3" />
                        )}
                        {showBB && (
                          <Line type="monotone" dataKey="bbUpper" stroke="#4f46e5" strokeOpacity={0.3} strokeWidth={1} dot={false} strokeDasharray="3 3" />
                        )}

                        {showMA && (
                          <Line type="monotone" dataKey="ma5" stroke="#eab308" strokeWidth={1.5} dot={false} />
                        )}
                        {showMA && (
                          <Line type="monotone" dataKey="ma20" stroke="#10b981" strokeWidth={1.5} dot={false} />
                        )}

                        {/* Financially accurate Candlestick using Custom shape */}
                        <Bar dataKey="close" barSize={6} shape={<Candlestick />} />
                      </ComposedChart>
                    </SafeResponsiveContainer>
                  </div>

                  {/* Horizontal Sep */}
                  <div className="h-px bg-white/5 my-2 flex-shrink-0" />

                  {/* Secondary Chart Box */}
                  <div className="h-28 flex-shrink-0 min-h-0">
                    <SafeResponsiveContainer minHeight={112}>
                      <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid stroke="#ffffff" strokeOpacity={0.03} strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="date" hide />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 9, fontFamily: 'monospace' }} stroke="#ffffff" strokeOpacity={0.03} />
                        <Tooltip content={<CustomTooltip />} />
                        
                        {secondaryIndicator === 'macd' ? (
                          <Bar dataKey="macd" barSize={3}>
                            {chartData.map((entry, index) => (
                              <Cell key={`macd-cell-${index}`} fill={entry.macd >= 0 ? '#f43f5e' : '#10b981'} fillOpacity={0.7} />
                            ))}
                          </Bar>
                        ) : (
                          <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
                        )}

                        {secondaryIndicator === 'rsi' && (
                          <ReferenceLine y={70} stroke="#f43f5e" strokeOpacity={0.3} strokeDasharray="3 3" label={{ value: '超买 70', fill: '#f43f5e', fontSize: 8, position: 'insideRight' }} />
                        )}
                        {secondaryIndicator === 'rsi' && (
                          <ReferenceLine y={30} stroke="#10b981" strokeOpacity={0.3} strokeDasharray="3 3" label={{ value: '超卖 30', fill: '#10b981', fontSize: 8, position: 'insideRight' }} />
                        )}
                      </ComposedChart>
                    </SafeResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: AI Diag Results Layout */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex flex-col relative overflow-hidden min-h-[400px]">
          <div className="absolute top-0 right-0 p-3 opacity-20 text-indigo-400 pointer-events-none">
            <ChartIcon className="w-24 h-24 stroke-[0.3]" />
          </div>
          
          <div className="flex gap-2.5 items-center mb-5 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">Vision 智能多模态报告</h3>
              <p className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">Multimodal Diagnostic Logs</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 text-xs text-neutral-400 leading-relaxed pr-1 flex flex-col">
            <AnimatePresence mode="wait">
              {isDiagnosticRunning && (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col justify-center items-center py-12 gap-4 text-center font-mono text-[11px]"
                >
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-0 border-[2px] border-indigo-500/30 border-t-indigo-400 rounded-full"
                    />
                    <ChartIcon className="w-6 h-6 text-indigo-400 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-white block font-medium mb-1">正在加载图像像素矩阵并解析形态特征...</span>
                    <span className="text-neutral-500">[1/3] 卷积滤波器提取趋势顶点坐标</span>
                  </div>
                </motion.div>
              )}

              {!isDiagnosticRunning && showAIVisualResult && (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                  className="space-y-5"
                >
                  <div className="bg-indigo-500/5 border border-indigo-505/20 rounded-xl p-4">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-400 block mb-1">诊断标的</span>
                    <h4 className="text-sm font-semibold text-neutral-100 flex items-center justify-between mb-2">
                      {activeTab === 'kline' || uploadedImage ? `${selectedStock.name} 后端技术诊断` : selectedPreset.title}
                      <span className="text-xs font-mono font-medium text-neutral-500">{activeSymbol}</span>
                    </h4>
                    <p className="text-neutral-400 text-xs italic">
                      {uploadedImage ? '已调用 /api/vision/report 解析上传截图。' : `行情接入状态：${chartStatus}`}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 block">多模态网络定性信号</span>
                    <div className="space-y-2">
                      {diagnosticSignals.map((sig, i) => (
                        <div key={i} className="flex gap-2.5 items-start text-xs bg-black/20 p-2.5 rounded-lg border border-white/5">
                          <CheckCircle className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                          <span className="text-neutral-300 font-medium">{sig}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 block">量化决策建议</span>
                    <p className="text-xs text-neutral-300 leading-relaxed bg-black/30 border border-white/[0.05] p-3.5 rounded-xl whitespace-pre-line">
                      {diagnosticAssessment}
                    </p>
                  </div>

                  <div className="border-t border-white/5 pt-3.5 flex gap-3 text-center justify-between items-center text-[10px] font-mono">
                    <span className="text-neutral-500">数据来源: FastAPI /api/prices + /api/technical</span>
                    <button onClick={saveDiagnostic} className="flex items-center gap-1 bg-white/5 text-neutral-400 px-2 py-1 rounded hover:bg-white/10 transition-colors">
                      <Download className="w-3 h-3" /> 保存记录
                    </button>
                  </div>
                </motion.div>
              )}

              {!isDiagnosticRunning && !showAIVisualResult && (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center text-center p-8 text-neutral-500 gap-3"
                >
                  <Eye className="w-8 h-8 text-neutral-600 animate-pulse" />
                  <p className="text-[11px] leading-relaxed max-w-xs font-sans">
                    {activeTab === 'preset' 
                      ? '请在左侧选择预设或上传K线截图，然后点击“启动 Vision 图像诊断”调用后端视觉分析。' 
                      : '当前处于动态行情沙盘模式，K线、均线、MACD/RSI 均由后端行情计算。点击诊断可生成技术摘要。'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>

    </motion.div>
  );
}
