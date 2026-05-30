export type AgentStatus = 'idle' | 'analyzing' | 'error';

export type AgentIconKey = 'macro' | 'fundamental' | 'quant' | 'risk' | 'data' | 'execution' | 'custom';

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  task: string;
  description: string;
  iconKey: AgentIconKey;
  enabled: boolean;
  model: string;
  temperature: number;
  prompt: string;
}

export interface AgentRuntimeConfig {
  id: string;
  name: string;
  role: string;
  description: string;
  model: string;
  temperature: number;
  prompt: string;
}

export const AGENT_CONFIG_STORAGE_KEY = 'ai-finance:agent-configs-v1';

export const DEFAULT_AGENT_CONFIGS: AgentConfig[] = [
  {
    id: 'macro-trend',
    name: '宏观趋势分析师',
    role: 'Macro Trend',
    status: 'idle',
    task: '暂无任务',
    description: '整合多源新闻与宏观经济数据，提供全球经济周期与市场大势预判。',
    iconKey: 'macro',
    enabled: true,
    model: 'gpt-4.1',
    temperature: 0.25,
    prompt: '你是宏观趋势分析师，关注政策、利率、汇率、流动性、产业周期与跨市场风险。请用可核验事实支撑判断，并明确哪些宏观变量会改变结论。',
  },
  {
    id: 'fundamental',
    name: '基本面分析助手',
    role: 'Fundamental',
    status: 'analyzing',
    task: '分析茅台 Q3 财报',
    description: '深度剖析公司财务报表、盈利能力、成长性及行业竞争格局。',
    iconKey: 'fundamental',
    enabled: true,
    model: 'gpt-4.1',
    temperature: 0.2,
    prompt: '你是基本面分析助手，负责拆解收入、利润、现金流、资产负债、竞争格局和估值假设。请优先引用公告和财报口径，避免把未经证实的传闻当作事实。',
  },
  {
    id: 'quant-strategy',
    name: '量化策略专家',
    role: 'Quant Strategy',
    status: 'analyzing',
    task: '多因子寻优计算',
    description: '基于海量市场数据，发掘统计套利机会，构建并回测多因子选股模型。',
    iconKey: 'quant',
    enabled: true,
    model: 'gpt-4.1',
    temperature: 0.15,
    prompt: '你是量化策略专家，关注因子暴露、回测稳定性、样本外表现、交易成本和拥挤度。请区分统计相关与可交易信号，并指出模型失效条件。',
  },
  {
    id: 'risk-compliance',
    name: '风险合规顾问',
    role: 'Risk & Compliance',
    status: 'idle',
    task: '暂无任务',
    description: '实时监控持仓风险敞口，评估最大回撤并确保交易符合风控阈值。',
    iconKey: 'risk',
    enabled: true,
    model: 'gpt-4.1',
    temperature: 0.1,
    prompt: '你是风险合规顾问，优先识别公告风险、财务异常、流动性压力、黑天鹅事件、仓位暴露和合规边界。请把风险等级、触发条件和缓释动作说清楚。',
  },
  {
    id: 'data-intel',
    name: '数据情报收集员',
    role: 'Data Intelligence',
    status: 'idle',
    task: '暂无任务',
    description: '结构化与非结构化数据聚合，从研报、公告和新闻中提取关键实体。',
    iconKey: 'data',
    enabled: true,
    model: 'gpt-4.1-mini',
    temperature: 0.2,
    prompt: '你是数据情报收集员，负责汇总行情、公告、新闻、研报和舆情线索。请输出结构化要点、时间戳、来源可信度和仍需核验的问题。',
  },
  {
    id: 'execution',
    name: '交易执行评估助手',
    role: 'Execution Review',
    status: 'idle',
    task: '等待指令',
    description: '评估策略信号的执行成本、滑点、流动性和订单路径，不生成实盘指令。',
    iconKey: 'execution',
    enabled: true,
    model: 'gpt-4.1-mini',
    temperature: 0.15,
    prompt: '你是交易执行评估助手，只评估模拟执行路径、流动性、滑点、盘口冲击和风控约束。不得生成实盘下单指令，必须保留人工确认步骤。',
  },
];

const VALID_ICON_KEYS = new Set<AgentIconKey>(['macro', 'fundamental', 'quant', 'risk', 'data', 'execution', 'custom']);
const VALID_STATUSES = new Set<AgentStatus>(['idle', 'analyzing', 'error']);

function safeString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function safeTemperature(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function normalizeAgentConfig(value: unknown, fallback?: AgentConfig): AgentConfig | null {
  if (!value || typeof value !== 'object') return fallback ?? null;
  const input = value as Partial<AgentConfig>;
  const base = fallback ?? DEFAULT_AGENT_CONFIGS[0];
  const iconKey = VALID_ICON_KEYS.has(input.iconKey as AgentIconKey) ? input.iconKey as AgentIconKey : base.iconKey;
  const status = VALID_STATUSES.has(input.status as AgentStatus) ? input.status as AgentStatus : 'idle';

  return {
    id: safeString(input.id, base.id),
    name: safeString(input.name, base.name),
    role: safeString(input.role, base.role),
    status,
    task: safeString(input.task, status === 'analyzing' ? '执行模拟诊断指令...' : '暂无任务'),
    description: safeString(input.description, base.description),
    iconKey,
    enabled: typeof input.enabled === 'boolean' ? input.enabled : true,
    model: safeString(input.model, base.model),
    temperature: safeTemperature(input.temperature, base.temperature),
    prompt: safeString(input.prompt, base.prompt),
  };
}

export function loadAgentConfigs(): AgentConfig[] {
  if (typeof window === 'undefined') return DEFAULT_AGENT_CONFIGS;

  try {
    const raw = window.localStorage.getItem(AGENT_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_AGENT_CONFIGS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_AGENT_CONFIGS;
    const normalized = parsed
      .map((item, index) => normalizeAgentConfig(item, DEFAULT_AGENT_CONFIGS[index]))
      .filter((item): item is AgentConfig => Boolean(item));
    return normalized.length ? normalized : DEFAULT_AGENT_CONFIGS;
  } catch {
    return DEFAULT_AGENT_CONFIGS;
  }
}

export function saveAgentConfigs(configs: AgentConfig[]) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(AGENT_CONFIG_STORAGE_KEY, JSON.stringify(configs));
  window.dispatchEvent(new CustomEvent('agent-configs-changed', { detail: configs }));
}

export function createCustomAgentConfig(index: number): AgentConfig {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    name: `自定义研究员 ${index}`,
    role: 'Custom Agent',
    status: 'idle',
    task: '暂无任务',
    description: '面向特定投研问题的自定义分析席位。',
    iconKey: 'custom',
    enabled: true,
    model: 'gpt-4.1-mini',
    temperature: 0.3,
    prompt: '你是自定义金融研究 Agent，请围绕用户指定标的进行结构化分析，明确证据来源、核心判断、反证条件和风险边界。',
  };
}

export function getEnabledAgentRuntimeConfigs(configs: AgentConfig[] = loadAgentConfigs()): AgentRuntimeConfig[] {
  return configs
    .filter((agent) => agent.enabled)
    .map(({ id, name, role, description, model, temperature, prompt }) => ({
      id,
      name,
      role,
      description,
      model,
      temperature,
      prompt,
    }));
}
