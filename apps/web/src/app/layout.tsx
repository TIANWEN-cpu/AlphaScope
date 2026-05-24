import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI-Finance | 金融 AI 分析工作台',
  description: '多 Agent 异构分析 · 专家团 · K线视觉分析 · 可审计投研报告',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {/* Absolute background effects */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px] mix-blend-screen" />
          <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')", backgroundBlendMode: 'overlay'}} />
        </div>
        {children}
      </body>
    </html>
  );
}
