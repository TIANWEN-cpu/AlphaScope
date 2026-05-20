# Agent 设计文档

## 设计理念

**模型多样性 > 单一模型质量**。5 个异构模型的集成比单一"优秀"模型更可靠，因为相关性错误会相互抵消。

## Agent 架构

### 默认 5 Agent 配置

| Agent | 角色 | 模型 | 关注维度 |
|-------|------|------|----------|
| fundamental | 基本面分析师 | Claude Sonnet 4.5 | 护城河、ROE、估值、现金流 |
| technical | 技术面分析师 | GPT-5.2 | 趋势、形态、量价、指标 |
| sentiment | 消息面分析师 | DeepSeek Chat | 新闻情绪、公告、政策 |
| risk | 风控官 | SenseNova | 波动率、回撤、流动性、主力信号 |
| retail | 散户行为分析师 | Mimo | 舆情、散户情绪、社交媒体 |

任意 Agent 失败自动降级到 DeepSeek。

### Critic 层

Critic 对每个 Agent 输出进行 7 维评分：
1. 证据质量
2. 逻辑一致性
3. 矛盾检测
4. 缺失证据识别
5. 过度自信标记
6. 证据覆盖率
7. 因子一致性

### Chairman 层

Claude Opus 4.7 综合所有 Agent 意见，产出最终决策（280 字以内）。

## 专家团系统

### 默认 10 人专家团

1. buffett (lead) — 基本面分析师
2. lynch — 成长投资
3. chanlun — 技术面分析师
4. macro — 宏观分析师
5. risk_officer — 风控官
6. sentiment — 消息面分析师
7. fund_flow — 资金面分析师
8. devil — 反方分析师
9. compliance — 合规官
10. summarizer — 总结官

### 5 种辩论模式

| 模式 | 说明 |
|------|------|
| QUICK_VOTE | 快速投票 |
| ROUNDTABLE | 圆桌讨论 |
| DEVILS_ADVOCATE | 反方辩论 |
| CHAIRMAN_RULING | 主席裁决 |
| HUMAN_INTERVENTION | 人工介入 |

## 分析模式

| 模式 | Agent 数 | 模型 | 用途 |
|------|----------|------|------|
| Standard | 3 | DeepSeek | 快速筛选 |
| Deep | 5 + Critic + Chairman | 混合 | 完整研究 |
| Auto | Pre-screen → Deep | 动态 | 平衡成本/质量 |

## 输出结构

每个 Agent 输出包含：
- `signal`: 买入/卖出/观望
- `confidence`: 0-100
- `reason`: 分析理由
- `evidence`: 证据列表
- `risks`: 风险因素
- `invalid_if`: 失效条件

## 配置方式

Agent 配置通过 YAML 文件管理：
- `config/models.yaml` — 模型分配
- `config/experts.yaml` — 专家团定义
- `config/agent_teams.yaml` — 团队模板
