import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Compass, Sparkles, X } from 'lucide-react';

/**
 * 5 分钟黄金路径引导(纯新增,可跳过)。
 *
 * 战略报告 §7.1: 新用户不知从哪开始,第一次打开就迷失。本组件用一张 6 步卡片
 * 把主线串起来(搜股 → 工作台 → 研报 → 证据链 → 回测 → 导出),降低 5 分钟上手门槛。
 *
 * 自判断显示: 仅当用户未看过此引导时弹出。不复用路由(本应用为状态驱动 SPA,
 * 无 React Router),仅在 App 根挂载一个浮层,关闭即写入 localStorage。
 *
 * 与 Onboarding.tsx 互补: Onboarding 解决"配不配 Key / Demo 入口",
 * 本组件解决"配好之后该先点哪"。
 */

const TOUR_SEEN_KEY = 'alphascope:golden-path-seen';

interface Step {
  title: string;
  hint: string;
  /** 引导用户接着去哪个侧栏 Tab(供"去试试"按钮跳转)。 */
  tab?: string;
}

const STEPS: Step[] = [
  { title: '① 搜一只股票', hint: '在顶部搜索框输入"茅台"或代码 600519,进入股票工作台。看行情、新闻、公告、资金流和因子卡片。', tab: 'dashboard' },
  { title: '② 生成 AI 研报', hint: '在工作台点「生成研究」,多 Agent(基本面/技术面/舆情/风控/资金)并行辩论,Critic 交叉检查,Chairman 汇总结论,全程 SSE 流式展示。', tab: 'detailed' },
  { title: '③ 追溯证据链', hint: '研报里每条结论都可点开看引用来源——新闻、公告、行情、资金流。这是"可审计"的核心:结论不是凭空而来。', tab: 'saved' },
  { title: '④ 跑一个回测', hint: '在「量化回测与执行」选策略(双均线/MACD/RSI/布林…),看净值、夏普、最大回撤。回测带真实 A 股摩擦:T+1、印花税、滑点、防未来函数。', tab: 'tasks' },
  { title: '⑤ 导出报告', hint: '回测与研报均可导出(Markdown/CSV),用于复盘或归档。', tab: 'detailed' },
  { title: '⑥ 配置你自己的模型', hint: '想用真实 AI 分析?到「设置」填自己的 API Key(DeepSeek/智谱/OpenAI…)。或保持 Demo 模式继续体验。', tab: 'settings' },
];

export function GoldenPathTour({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [show, setShow] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(TOUR_SEEN_KEY)) return;
    // 延迟一点,避免和 Onboarding 弹窗同时弹出抢焦点。
    const t = window.setTimeout(() => setShow(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  const close = () => {
    if (typeof window !== 'undefined') window.localStorage.setItem(TOUR_SEEN_KEY, '1');
    setShow(false);
  };

  const next = () => {
    if (idx < STEPS.length - 1) setIdx(idx + 1);
    else close();
  };

  const goToTab = () => {
    const tab = STEPS[idx].tab;
    if (tab && onNavigate) onNavigate(tab);
    close();
  };

  if (!show) return null;

  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0c12] p-6 shadow-2xl ring-1 ring-black/70">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-100">5 分钟黄金路径</h2>
              <p className="mt-0.5 text-[12px] text-neutral-500">从搜股到导出报告,6 步走完主线。</p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            title="关闭"
            className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 进度点 */}
        <div className="mb-4 flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= idx ? 'bg-emerald-400' : 'bg-white/10'}`}
            />
          ))}
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-100">
            <Sparkles className="h-4 w-4 text-emerald-300" />
            {step.title}
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">{step.hint}</p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={close}
            className="text-[12px] text-neutral-500 transition-colors hover:text-neutral-300"
          >
            跳过引导
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToTab}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
            >
              去试试
            </button>
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
            >
              {isLast ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> 完成
                </>
              ) : (
                <>
                  下一步 <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
