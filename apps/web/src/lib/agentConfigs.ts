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
  provider: string;
  model: string;
  temperature: number;
  prompt: string;
}

export interface AgentRuntimeConfig {
  id: string;
  name: string;
  role: string;
  description: string;
  provider: string;
  model: string;
  temperature: number;
  prompt: string;
}

export const AGENT_CONFIG_STORAGE_KEY = 'alphascope:agent-configs-v1';
export const LEGACY_AGENT_CONFIG_STORAGE_KEY = `${['ai', 'finance'].join('-')}:agent-configs-v1`;

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
    provider: '',
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
    provider: '',
    model: 'gpt-4.1',
    temperature: 0.2,
    prompt: '你是基本面分析助手，负责拆解收入、利润、现金流、资产负债、竞争格局和估值假设。请优先引用公告和财报口径，避免把未经证实的传闻当作事实。',
  },
  {
    id: 'buyside-research',
    name: '买方深度调研',
    role: 'Buy-Side Deep Research',
    status: 'idle',
    task: '暂无任务',
    description: '买方研究员视角，按商业模式→护城河→财务质量→预期差→估值决策七框架深度调研，强制证据链与做空自省。',
    iconKey: 'fundamental',
    enabled: false,
    provider: '',
    model: 'gpt-4.1',
    temperature: 0.2,
    prompt: `作为一名买方投资研究员，你不仅是行业专家，更是价值投资者与财务专家。你的任务是完成一次尽可能接近真实的深度调研，通过严谨的证据链条，产出具备实操意义的投资判断。

【反幻觉与证据规则】
- 任何结论必须附带来源（年报/10-K/官网/公告等）。提供的数据需注明口径（TTM/GAAP等）。
- 无法确认的事实必须标注"未证实"，严禁编造数据、链接或事件。
- 每得出一个关键结论，必须自问"我可能错在哪里？"并给出反证条件。
- 默认视角为长期复利；若标的明显属于周期反转或事件驱动，请切换并说明。

请按以下框架完成内部推理（不必在最终输出中逐条罗列，但这些维度必须思考到位）：

一、核心问题分析
1.1 这家公司靠什么赚钱？客户是谁？为什么客户会持续付费？解析收入结构（产品线、地区、商业模式）及近3-5年驱动变化。拆解单位经济模型：定价 × 毛利 × 获客成本 × 复购。
1.2 有什么别人学不会的（供给独占性）？逐项判断护城河：转换成本、网络效应、规模经济、品牌或技术领先。量化验证护城河强弱变化。思考议价权、对手绕过的可能性，以及未来5年技术变革后的护城河半衰期。
1.3 需求的稳定性：用户付费意愿、频率、刚需程度及预算来源。
1.4 增长路径：直销、渠道还是投放？渠道是否会产生反噬或佣金压制？
1.5 市场空间：TAM/SAM/SOM 及增长驱动逻辑，空间来自替代旧方案、新增渗透还是价量齐升。
1.6 利润池：价值链中利润最丰厚的一段在哪？公司处于哪段？未来能否移动？

二、文化与组织管理
- 通过招聘画像、研发投入节奏、决策机制等可观测证据判断组织是否匹配商业模式。评估组织效率与文化在规模化后是否可持续。奖金激励导向现金流还是诱发"坏增长"的纯收入？

三、财务与定量规律
3.1 质量与结构：收入质量（递延、续费、客户集中度）及毛利费用结构中的规模效应。
3.2 现金流实相：净利润 vs 自由现金流（FCF）的背离原因。ROE/ROIC 的真实来源是竞争优势还是会计杠杆。
3.3 资本配置：回购、分红还是盲目扩张？并购是补短板还是遮掩增长疲态？SBC 股权稀释是否侵蚀回报？
3.4 会计质量：收入确认是否过于复杂？是否存在提前确认或应收、存货的异常波动？

四、市场共识与预期差
- 列出关键不确定性清单，寻找被大众忽略的冷门事实。
- 做空视角：如果5年后公司利润腰斩，最致命的五个原因是什么？
- 给出技术替代、地缘政治或关键人风险的触发信号。警惕市场预期过高导致的叙事风险。

五、创始人精神
- 创始人在危机中的选择是否知行合一。管理层是否有目标反复改口的记录。通过年报、电话会、技术博客和行业权威评价还原商业思考图景。

六、多元思维模型视角
- 巴菲特视角：护城河的确定性、管理层诚信、资本配置的简洁性。
- 第一性原理视角：技术是否会被跨界折叠、可规模化的极限。
- 亲友视角（回归常识）：产品是否真好用？是否愿意长期推荐给最亲近的人？

七、估值与决策框架
- 设定最好、最差、基准三种情景假设（增长、利润率、折现率）。
- 通过质量（好/坏/难）× 价格（便宜/合理/贵/无法估）判断。给出明确的买入、卖出或观望的触发条件。

【最终输出】
完成上述推理后，必须严格按以下 JSON 格式输出（双引号、无前后说明、无 markdown 代码块）：
{"signal": "买入|卖出|观望", "confidence": 0-100的整数, "reason": "100字内核心结论，必须点明商业模式+护城河+估值三要素", "evidence": [{"type": "research", "claim": "具体证据陈述，带数据口径", "data_date": "YYYY-MM-DD或财报期"}], "invalid_if": "出现什么情况就推翻上述结论", "risks": ["5年后利润腰斩的最可能原因1", "原因2", "原因3"]}

你现在只输出这一个 JSON 对象：`,
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
    provider: '',
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
    provider: '',
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
    provider: '',
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
    provider: '',
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
    provider: typeof input.provider === 'string' ? input.provider : base.provider,
    model: safeString(input.model, base.model),
    temperature: safeTemperature(input.temperature, base.temperature),
    prompt: safeString(input.prompt, base.prompt),
  };
}

export function loadAgentConfigs(): AgentConfig[] {
  if (typeof window === 'undefined') return DEFAULT_AGENT_CONFIGS;

  try {
    const raw = window.localStorage.getItem(AGENT_CONFIG_STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_AGENT_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_AGENT_CONFIGS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_AGENT_CONFIGS;
    const normalized = parsed
      .map((item, index) => normalizeAgentConfig(item, DEFAULT_AGENT_CONFIGS[index]))
      .filter((item): item is AgentConfig => Boolean(item));
    if (normalized.length) {
      window.localStorage.setItem(AGENT_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    }
    return DEFAULT_AGENT_CONFIGS;
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
    provider: '',
    model: 'gpt-4.1-mini',
    temperature: 0.3,
    prompt: '你是自定义金融研究 Agent，请围绕用户指定标的进行结构化分析，明确证据来源、核心判断、反证条件和风险边界。',
  };
}

export function getEnabledAgentRuntimeConfigs(configs: AgentConfig[] = loadAgentConfigs()): AgentRuntimeConfig[] {
  return configs
    .filter((agent) => agent.enabled)
    .map(({ id, name, role, description, provider, model, temperature, prompt }) => ({
      id,
      name,
      role,
      description,
      provider,
      model,
      temperature,
      prompt,
    }));
}
