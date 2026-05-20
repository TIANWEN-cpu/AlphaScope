'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  mode?: string;
  evidence?: Array<{ type: string; claim: string }>;
  agents?: Record<string, { signal: string; confidence: number; reason: string }>;
  timestamp: string;
}

const MODES = [
  { id: 'free', name: '自由问答', icon: '💬', desc: '快速问答' },
  { id: 'standard', name: '标准分析', icon: '⚡', desc: '3 Agent 快速' },
  { id: 'deep', name: '深度分析', icon: '🔬', desc: '5 Agent + Critic' },
  { id: 'expert', name: '专家团', icon: '🎓', desc: '多专家圆桌' },
  { id: 'vision', name: 'K线分析', icon: '📊', desc: '上传图表分析' },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('free');
  const [stockSymbol, setStockSymbol] = useState('');
  const [stockName, setStockName] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          mode,
          stock_symbol: stockSymbol || undefined,
          stock_name: stockName || undefined,
        }),
      });
      const data = await res.json();

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.content || '未获取到回复',
        mode: data.mode,
        evidence: data.evidence,
        agents: data.agents,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `请求失败: ${err}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r p-4 flex flex-col">
        <h1 className="text-xl font-bold mb-4">🧠 AI Finance</h1>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-600">股票代码</label>
          <input
            type="text"
            value={stockSymbol}
            onChange={(e) => setStockSymbol(e.target.value)}
            placeholder="600519"
            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-600">股票名称</label>
          <input
            type="text"
            value={stockName}
            onChange={(e) => setStockName(e.target.value)}
            placeholder="贵州茅台"
            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-600">分析模式</label>
          <div className="mt-1 space-y-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  mode === m.id
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'hover:bg-gray-100'
                }`}
              >
                {m.icon} {m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto text-xs text-gray-400">
          v0.36 · 5 模式 · 20+ 数据源
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-20">
              <p className="text-2xl mb-2">🧠 AI 智能助手</p>
              <p>选择分析模式，输入问题开始对话</p>
              <p className="text-sm mt-1">
                支持自由问答 · 标准分析 · 深度分析 · 专家团 · K线图分析
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border shadow-sm'
                }`}
              >
                {msg.role === 'assistant' && msg.mode && (
                  <div className="text-xs text-gray-400 mb-1">
                    {MODES.find((m) => m.id === msg.mode)?.icon}{' '}
                    {MODES.find((m) => m.id === msg.mode)?.name}
                  </div>
                )}
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>

                {/* Agent Voting */}
                {msg.agents && Object.keys(msg.agents).length > 0 && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-gray-500">
                      🗳️ Agent 投票详情
                    </summary>
                    <div className="mt-1 space-y-1">
                      {Object.entries(msg.agents).map(([key, agent]) => (
                        <div key={key} className="flex justify-between">
                          <span>{key}</span>
                          <span>
                            {agent.signal} ({agent.confidence}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Evidence Chain */}
                {msg.evidence && msg.evidence.length > 0 && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-gray-500">
                      📎 证据链 ({msg.evidence.length} 条)
                    </summary>
                    <div className="mt-1 space-y-1">
                      {msg.evidence.map((ev, j) => (
                        <div key={j}>
                          [{ev.type}] {ev.claim}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="text-xs text-gray-400 mt-1">{msg.timestamp}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border rounded-2xl px-4 py-3">
                <div className="animate-pulse text-gray-400">分析中...</div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t bg-white p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="输入你的问题..."
              className="flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              发送
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-72 bg-white border-l p-4 overflow-y-auto">
        <h3 className="font-medium mb-3">📊 分析面板</h3>
        <div className="text-sm text-gray-600">
          <p>模式: {MODES.find((m) => m.id === mode)?.name}</p>
          {stockSymbol && <p>标的: {stockName}({stockSymbol})</p>}
          <p>消息数: {messages.length}</p>
        </div>

        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">模式说明</h4>
          {MODES.map((m) => (
            <div key={m.id} className="text-xs text-gray-500 mb-1">
              {m.icon} <strong>{m.name}</strong>: {m.desc}
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">数据源</h4>
          <div className="text-xs text-gray-500">
            <p>AkShare · Tushare · CNInfo</p>
            <p>SEC · HKEX · Finnhub</p>
            <p>CLS · 东财 · 财联社</p>
            <p>17+ Provider 自动发现</p>
          </div>
        </div>
      </div>
    </div>
  );
}
