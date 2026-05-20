"use client";

const MODES = [
  { id: "free", name: "自由问答", icon: "💬", desc: "快速问答" },
  { id: "standard", name: "标准分析", icon: "⚡", desc: "3 Agent 快速" },
  { id: "deep", name: "深度分析", icon: "🔬", desc: "5 Agent + Critic" },
  { id: "expert", name: "专家团", icon: "🎓", desc: "多专家圆桌" },
  { id: "vision", name: "K线分析", icon: "📊", desc: "上传图表分析" },
];

interface SidebarProps {
  stockSymbol: string;
  stockName: string;
  mode: string;
  onStockSymbolChange: (v: string) => void;
  onStockNameChange: (v: string) => void;
  onModeChange: (v: string) => void;
  onClear: () => void;
}

export function Sidebar({
  stockSymbol,
  stockName,
  mode,
  onStockSymbolChange,
  onStockNameChange,
  onModeChange,
  onClear,
}: SidebarProps) {
  return (
    <div className="w-64 bg-white border-r p-4 flex flex-col">
      <h1 className="text-xl font-bold mb-4">🧠 AI Finance</h1>

      <div className="mb-4">
        <label className="text-sm font-medium text-gray-600">股票代码</label>
        <input
          type="text"
          value={stockSymbol}
          onChange={(e) => onStockSymbolChange(e.target.value)}
          placeholder="600519"
          className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      <div className="mb-4">
        <label className="text-sm font-medium text-gray-600">股票名称</label>
        <input
          type="text"
          value={stockName}
          onChange={(e) => onStockNameChange(e.target.value)}
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
              onClick={() => onModeChange(m.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                mode === m.id
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : "hover:bg-gray-100"
              }`}
            >
              {m.icon} {m.name}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onClear}
        className="mt-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
      >
        清空对话
      </button>

      <div className="mt-auto text-xs text-gray-400">
        v0.40 · 5 模式 · 20+ 数据源
      </div>
    </div>
  );
}

export { MODES };
