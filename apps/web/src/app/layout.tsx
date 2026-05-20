import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI-Finance | 金融 AI 分析工作台',
  description: '多 Agent 异构分析 · 专家团 · K线视觉分析 · 可审计投研报告',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
