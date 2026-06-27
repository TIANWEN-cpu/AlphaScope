# Architecture (v1.9.x)

This document describes the system architecture and data flow of 研策中枢 AlphaScope — a local-first AI investment-research and quantitative decision workbench.

> 本文档随版本更新。上一版（v0.40）描述的是早期 Streamlit 形态，已与现状脱节；本文反映 **v1.9.x** 的分层架构（FastAPI 100+ 接口、自研多 Agent 编排、量化层独立、Provider 插件化）。

## System Overview

```mermaid
flowchart TB
  UI["<b>用户界面层</b><br/>Vite + React 19 工作台 · Streamlit 调试台 · Windows 一键包 / Docker"]
  API["<b>API 层 · FastAPI</b><br/>REST 100+ · SSE 流式 · 鉴权 / 设置 / 任务中心"]
  ORCH["<b>Agent 编排层（自研）</b><br/>研究员 Agent 群 · Tool Router · Critic 7 维 · Chairman 会签 · 降级策略"]
  QUANT["<b>量化层</b><br/>指标 / 因子库 · 一策略一文件(自动发现) · 回测引擎(T+1/费用/滑点/防未来函数) · 风控规则"]
  DATA["<b>数据层</b><br/>Provider 插件(20 源自动注册) · 健康检查 / 三级降级 · SQLite / 证据链 · Demo 兜底 · RAG 向量检索"]
  UI --> API --> ORCH
  API --> QUANT
  ORCH --> QUANT
  ORCH --> DATA
  QUANT --> DATA
```

每一层独立可测、可替换。新增 Provider / 策略只需放一个文件（importlib 自动发现），无需改核心代码。

## Layer Details

### 1. 数据层 · Provider 插件 (`backend/providers/`)

20 个真实数据源 + 1 个 Demo 兜底，统一 `BaseProvider` 接口：

| Provider | 市场 | 数据类型 | 说明 |
|----------|------|----------|------|
| AkShare | CN | 全品类 | 主力源，已集成 1.18.60 |
| EastMoney | CN | 新闻/资金流 | 三级兜底之一 |
| BaoStock | CN | 价格兜底 | 三级兜底之一 |
| Tushare | CN | 报告/行情 | 需 Key |
| CNInfo | CN | 公告 | S 级信任 |
| CLS (财联社) | CN | 快讯 | A 级 |
| DragonTiger | CN | 龙虎榜/游资 | — |
| Northbound | CN | 北向资金流 | — |
| SEC EDGAR | US | Filings | S 级 |
| Finnhub | US | 新闻/行情 | — |
| HKEXnews | HK | 公告 | S 级 |
| OpenBB | Global | 行情/基本面 | — |
| FRED | Global | 宏观 | A 级 |
| Reddit / StockTwits | US | 舆情 | C 级 |
| Google Trends / Wikipedia Views | Global | 另类舆情 | C 级 |
| Web Search | Global | 检索补全 | — |
| **CSV Upload** | Any | 用户行情 | 上传 CSV/Excel→schema 自动发现→入查询面，标 `source=csv_upload` |
| **HTTP/JSON (TickFlow)** | Any | 用户行情 | 配置外部 JSON 接口→字段映射→显式拉取物化→入查询面，标 `source=http_json`（v1.9.19） |
| **Demo** | — | 内置示例 | 零 Key 兜底，读 seed DB |

`ProviderRegistry` 负责 importlib 自动发现、优先级路由、`is_available()` 健康检查与失败 failover。价格取数走 **三级兜底**（AkShare → 东财 → 腾讯/BaoStock）。配置见 `config/data_sources.yaml`。健康状态经 `SourceHealthMonitor` 跟踪，可通过 `GET /api/providers/health` 查询。

> **v1.9.4 能力 schema 与质量分**：`BaseProvider.capability()` 用统一 schema 表达每个源的市场/数据类型/粒度/延迟/成本/速率/凭证/优先级/可降级（对标 tickflow tiers.yaml），经 `GET /api/providers/capabilities` 聚合透出。`observability/source_health.py` 的 `compute_quality_score()` 把健康度量化为 0–100 质量分（成功率 × 新鲜度 × 完整度）+ 红黄绿 grade，附加在 `/api/providers/health` 每个源上。`CsvUploadProvider`（`csv_provider.py`，priority=15）让用户上传自带行情零 Key 入回测/查询面，`discover_schema` 认中英文表头，数据明确标注 `user_upload` 绝不冒充在线源。

> **v1.9.19 TickFlow HTTP/JSON 自定义表**：`HttpJsonProvider`（`http_json_provider.py`，priority=14）补齐「外部 JSON 接口」一路——用户配置 URL + 记录点路径 + 字段映射，显式「拉取」时（**唯一触网处**，`fetch_json` 优先 requests 回退 urllib、失败安全）把远端 JSON 经纯函数 `extract_records`/`apply_field_map` 映射成标准 OHLCV，**物化到 `data/uploads/tickflow/data/<symbol>.json`**;热路径 `get_prices` 只读物化缓存（离线确定性），数据标 `source=http_json` / `user_provided`。延续 csv 的「显式导入→离线可查」哲学，拉取失败不清空既有缓存。端点 `GET/POST /api/tickflow/sources`、`DELETE .../sources/{id}`、`POST .../sources/{id}/refresh`、`POST .../preview`（试抓返回样本 + 推断字段映射,辅助配置）。

> Demo Provider (`demo_provider.py`)：`requires_key=False`、低优先级，读取打包的 `seed/ai_finance.db`（10 只股票真实价格），数据标记 `source=demo_seed`，让用户不配 Key 也能走完整路径。

### 2. 存储与证据层

- **SQLite** — 结构化存储：新闻、研报、公告、行情、证据项、来源抓取日志、回测运行记录等。写操作线程安全（mutex）。
- **Evidence Store** (`backend/evidence_store.py`) — 证据链 CRUD，每条证据带 `evidence_type / source_url / claim / confidence / symbols / data_date`。Agent 结论力求反链到具体 `evidence_id`，构成「可审计」核心。
- **RAG** (`backend/rag/`) — 6 个模块（chunker / document_pipeline / hybrid_retriever / retriever / vector_store），可选向量库做语义检索，把相关证据注入 Agent 上下文。
- **Report Archive** (`backend/archive.py` + `archive_tagger.py`) — 每次深度分析自动归档为 Markdown，含决策、置信度、模型组合快照、Critic 质量分，支持事后复盘。

### 3. Agent 编排层（自研）(`backend/runtime/` + `backend/agents/`)

- **Orchestrator** (`runtime/orchestrator.py`) — 调度核心，三种模式：
  - **Standard** — 少量 Agent + 单模型，快速。
  - **Deep** — 5 默认角色 Agent（基本面 / 技术面 / 情绪 / 风控 / 资金行为）+ Critic + Chairman，多模型异构。
  - **Auto** — Standard 预筛，置信度模糊（30–70%）时升级到 Deep。
- **Data Verifier** (`agents/data_verifier.py`，v1.9.4) — 在任何 LLM 调用**之前**做确定性数据完整性预检：逐维度核验行情/技术/基本面/资金流/舆情/证据是否齐全·新鲜·无异常，缺失维度打标后由 `brief_warning()` 生成「严禁编造」强约束注入简报，杜绝 Agent 对缺失数据脑补。纯规则、不触网、失败不阻断；结果经全路径透出 `data_verification`。
- **Tool Router** (`runtime/tool_router.py`) — Agent 工具调用路由。
- **Critic** (`critic.py`) — 对每个 Agent 输出做 **7 维评分**：证据质量 / 逻辑一致性 / 矛盾检测 / 缺失证据 / 过度自信标记 / 证据覆盖率 / 因子一致性。
- **Chairman** (`agents/chairman.py`) — `summarize_with_chairman()` 汇总多模型信号 + 置信度 + 理由，产出最终会签结论。
- **多空辩论裁决** (`agents/debate.py`，v1.9.14) — 在风控 gate 之后**确定性**合成「看多方 / 看空方(反方质询)/ 主席裁决」:**不新增任何 LLM Agent、不触网、不增成本**,而是复用一次分析里已算出的 Agent 信号(买入/卖出/观望)+ Critic 评审分歧 + 风控否决 + `data_verifier` 数据缺失,把单一结论升级为可审计的多空对峙。反方质询四来源:看空 Agent / 看多但信心不足 / 风控一票否决 / 数据缺失·过期·异常 / Critic 中·高分歧。三份战略报告(compass/deep-research/1.txt)一致把「反方质询 + 裁决理由入报」列为差异化核心,且都警告「治理稳定前别堆 Agent」——故以纯函数失败安全合成器落地。合规:描述研究分歧与共识度/置信度,**绝不给买卖指令**,附免责;裁决小节并入研报正文,经 `/api/analysis/run` 透出 `debate`,「研究报告生成」页以**「多空辩论与裁决」面板**(裁决 banner + 看多/看空双栏 + 反方质询来源徽标,v1.9.15)可视化呈现。
- **Expert Panel** — 可配置专家团（`config/experts.yaml`），5 种辩论模式（QUICK_VOTE / ROUNDTABLE / DEVILS_ADVOCATE / CHAIRMAN_RULING / HUMAN_INTERVENTION）。
- **降级策略** — 单 Agent 失败降级备用模型并标 `degraded=true`；全部失败时走 `demo_fallback`（无 Key）或返回结构化失败，**绝不返回伪造的"正常成功"**。

### 4. 量化层 (`backend/quant/`)

- **回测引擎** (`engine.py`) — 自研事件驱动引擎，主循环接入真实 A 股交易摩擦：
  - **防未来函数**：T 日信号于 **T+1 开盘价成交**（不再用当天 close 既算信号又成交），最后一根 bar 的信号无下一 bar 可成交则丢弃。
  - **T+1 结算**、**印花税（卖出单边）**、**滑点**、**涨跌停封板**（见 `constraints.py` 的 `T1Constraint` / `TradingCostModel` / `LimitUpDownFilter`）。
- **策略库** (`strategies/` 包) — 一策略一文件 + `StrategyRegistry` 自动发现，内置 10 个策略（MA / MACD / RSI / 布林突破 / 海龟 / 超跌反弹 / 动量TopN / 放量突破 / **低代码 custom_rule** / **通达信 tdx**）。`custom_rule`（v1.9.4）由前端「低代码策略编辑器」编译;`tdx`（v1.9.9）由通达信公式编译器编译。二者均复用同一回测引擎、不新建引擎。
- **指标** (`metrics.py`) — Sharpe / Sortino / Calmar / Profit Factor / 年化 / 最大回撤 / 胜率；v1.9.4 补**基准相对指标**（超额收益 / 信息比率 / Jensen's alpha / beta，对标 Qlib 口径，无基准时优雅降级）。
- **样本外走查** (`walk_forward.py`，v1.9.5) — 把历史切成顺序的 IS+OOS 窗口（`anchored` 锚定 / `rolling` 滚动），逐窗用同一固定参数策略回测，度量**时间稳健性**（收益是否跨区间一致，而非集中在某段运气）。每窗只跑一次引擎覆盖连续 IS+OOS 切片（指标有预热、无信号断层），再按权益曲线在分界处切分 OOS 重新归一；输出走查效率 WFE、样本外胜率、一致性评分与稳健性描述。纯确定性、失败安全、复用回测引擎，附「样本外≠未来」免责。`POST /api/quant/walk-forward`。
- **遗传算法参数寻优** (`evolution.py`，v1.9.11) — 用**确定性、可复现**的遗传算法(全程 `random.Random(seed)` 驱动,同 seed 同结果)在策略的**数值参数空间**里搜索更优组合,适应度=复用回测引擎跑一遍取某绩效键(夏普/卡玛/索提诺/收益/胜率)。只进化参数、不进化代码(合规等同对历史做确定性参数搜索);锦标赛+均匀交叉+变异+精英保留,初始种群含「默认参数投影」故全局最优不劣于默认;失败安全(单体异常被淘汰、样本不足 insufficient、无可寻优参数 degraded)、算力有界(种群/代数夹紧+预算上限+去重缓存)。与样本外走查天然配套(寻优找最优、走查验稳健),**强免责**:样本内寻优极易过拟合。`POST /api/quant/evolve`、`GET /api/quant/param-space/{name}`。
- **筹码分布** (`chip_distribution.py`，v1.9.6) — A 股成本分布:换手率扩散模型(老筹码按 1−t 衰减、新筹码按当日价格区间三角分布铺开,逐日累积),读出获利盘%/平均成本/70%-90% 集中度/上下方筹码密集价。优先用真实换手率,缺失退回量能代理(标 `model=volume_proxy`)。纯确定性、失败安全;描述历史成本结构,不预测价格。`POST /api/quant/chip-distribution`。
- **K 线形态识别** (`patterns.py`，v1.9.16) — 从 OHLCV **按规则**确定性检出蜡烛形态(十字星/锤子线·上吊线/流星·倒锤/看涨·看跌吞没/刺透·乌云盖顶/启明星·黄昏星/红三兵·三只乌鸦)与结构信号(跳空/N 日突破跌破/MA5-20 金叉死叉/双顶·双底),每个形态规则明确可单测、标注看涨/看跌/中性,同形异义用前段趋势区分。纯确定性、失败安全(脏数据/不足→降级空形态);描述历史 K 线结构,**不预测涨跌、不构成建议**,附免责。`POST /api/quant/patterns`。「交互K线」页以**形态面板 + 专业 K 线图上的形态标记**(看涨红箭头在下 / 看跌绿箭头在上 / 中性圆点,v1.9.17)呈现。
- **策略横向对比榜** (v1.9.7) — 同一标的一次取数、跑完全部内置策略并按指标(夏普/累计收益/Calmar 等)排名,复用同一回测引擎;模板策略 `custom_rule` 跳过。纯本地确定性,仅历史对比、不构成选股建议。`POST /api/quant/compare-strategies`。
- **实验记录持久化** (`experiment_store.py`，v1.9.8) — 把回测/走查/筹码/策略榜结果落 SQLite(独立表 `quant_experiments`,懒建表不改核心 schema),跨会话可查/调阅/横比;全失败安全(持久化失败不影响运行),`_prune` 保留最近 300 条。端点 `GET/DELETE /api/quant/experiments[/{run_id}]`、`POST /api/quant/experiments/compare`。与内存态 `_local_runs` 并存。
- **研究记忆** (`research_memory.py`，v1.9.18) — 把每次 `/api/analysis/run` 的**结论快照**(买入/卖出/观望 + 置信度 + 多空裁决共识 + 风控否决 + 数据核验状态 + 收盘价)旁路落 SQLite(独立表 `research_memory`,懒建表不改核心 schema),于是同一只股票可回看「上周看多、本周转观望」这类**结论随时间的变化轨迹**。纯函数 `build_snapshot`/`compute_changes`(信号转折点 + 转积极/转谨慎方向)/`summarize_history` 可单测;全失败安全(写失败或空跑返回中性值,绝不影响分析本身),每股 `_prune` 留最近 200 条。分析流程跑完旁路记录(try/except 包裹)。端点 `GET /api/research-memory/{symbols,timeline/{symbol}}`、`DELETE .../{snapshot,symbol}/{id}`。仅记录与回看历史、不预测不建议。
- **通达信(TDX)公式编译器** (`tdx_compiler.py`，v1.9.9) — 词法→递归下降语法→向量化序列求值,把 TDX 公式子集(MA/EMA/SMA/REF/CROSS/HHV/LLV/COUNT… + 赋值/输出/AND·OR)编译成防未来函数的买卖信号,经 `TdxStrategy`(注册名 `tdx`)走现有引擎回测。纯确定性、失败安全(坏公式→无信号)。`POST /api/quant/tdx/compile` 校验预览;回测复用 `/api/quant/backtest`。
- **风控** — 双层职责分离：① 回测期 `risk_controller.py` 6 条硬规则逐 bar 拦截交易；② 决策期 `risk/engine.py`（v1.9.3）在研报发布前做独立一票否决 gate（黑名单/仓位/集中度/置信度门控，纯规则可单测），critical 触发则研报顶部红字否决、方向性结论不作为投资依据。
- **Portfolio** (`portfolio.py`) — 持仓与成本核算，`execute_buy/sell` 支持可选佣金/印花税参数。

### 5. 视觉/多模态 (`backend/vision/`)

图像 / K 线图分析带真实数据交叉验证：检测图表类型 → LLM 解读趋势/支撑阻力/形态 → 拉取真实 OHLCV → 视觉结论与真实数据比对，避免模型「自信地看图说话」。

> **专业 K 线渲染**（`LightweightKLine.tsx` + `lightweight-charts`，v1.9.12–1.9.13）：**主仪表盘(对话式研究)**与**「交互K线」页**两处 K 线均可在 **专业**（TradingView Lightweight Charts，真缩放/平移/十字光标/价格刻度对齐）与 **经典**（recharts 自绘蜡烛)两种渲染器间一键切换,默认专业。组件自包含、可复用(支持 MA5/MA10/MA20 细粒度显隐),沿用既有 OHLCV 数据不新取数,对时间去重升序、均线跳过预热 NaN(脏数据不崩);**懒加载**为共享异步分块,主包体积不变。遵循「只增不替」:经典模式完整保留。

### 6. API 层 (`backend/api/`)

FastAPI 提供 100+ REST / SSE 接口，按域拆分（`quant.py` / `analysis.py` / `news.py` / `evidence.py` / `settings.py` / `providers.py` / `diagnostics.py` / `monitor.py` 等）。SSE 流式用于 AI 对话与研报生成进度。回测响应透出 `assumptions` 字段，让「本次回测假设」对用户可见。

> **系统监控中心**（`observability/monitor.py` + `GET /api/monitor/snapshot`，v1.9.10）把数据源 / 回测引擎 / 实验记录 / 模型成本 / 工具调用 / 执行追踪六路健康信号聚合成单一快照:每个组件采集器独立失败安全(采集失败仅标 `unknown`、不拖垮整体),状态分级为纯函数可单测,系统总状态取「任一 poor→poor、任一 warn→warn、否则 good」(`unknown` 不参与判定)。纯本地聚合、不触网,仅反映系统自身运行状态,不构成任何投资建议。

### 7. 用户界面层

- **`apps/web`** — Vite + React 19 + TypeScript 工作台，状态驱动 SPA（无 React Router），Sidebar 分两组（投研核心 / 量化研究引擎）约 17 个模块。SSE 流式对话、证据链反查、回测交易明细与免责声明、**低代码策略编辑器**（字段+操作符+阈值无代码组合信号）、**样本外走查 Tab**（IS/OOS 窗口稳健性体检，v1.9.5）、**筹码分布 / 策略榜 / 实验记录 Tab**（v1.9.6–1.9.8）、**策略进化 Tab**（遗传算法参数寻优 + 收敛曲线 + 一键转样本外走查，v1.9.11）、**系统监控中心**（v1.9.10，单页总览数据源/引擎/成本/调用健康，20s 自动刷新）、**研究记忆**（v1.9.18，同一股票结论随时间变化轨迹 + 转折点 + 置信度趋势）已接入。
- **Streamlit 调试台** — 保留用于快速实验与诊断（非主交付形态）。
- **Windows 一键包** — PyInstaller + Inno Setup，首启自动生成 master key 做 AES-GCM 加密。

## Data Flow Example

```
用户选 600519 (贵州茅台)
    ↓
Provider 层取数: 新闻(CLS+AkShare) · 公告(CNInfo) · 行情(AkShare,三级兜底) · 资金流
    ↓
质量层: 去重 → 来源排序 → 跨源验证 → 异常检测
    ↓
存储: SQLite(结构化) + Evidence Store(证据) + RAG(向量索引)
    ↓
RAG 检索相关证据 + 因子生成器算 5 维分数, 注入 Agent 上下文
    ↓
数据核验(data_verifier): 逐维度预检, 缺失维度打标「严禁编造」注入简报
    ↓
5 Agent 并行分析(注入证据+因子) → Critic 7 维评分 → Chairman 会签
    ↓
研报生成(质量门控: 禁空话/覆盖率/矛盾呈现/免责, critical 不清零拒绝发布)
    ↓
前端展示 + 自动归档; 用户可一键回测(带真实摩擦) + 导出
```

## Thread Safety & 并发

- 共享状态用双重检查锁：Database 写操作 mutex、VectorStore collection 操作 mutex、Task Queue 串行化。
- async 路由解阻塞：长任务（资金流、模型列表）移入 worker thread + 超时，避免阻塞事件循环（见 v1.9.0 性能优化）。
- 关键路径有 TTL 缓存（如资金流），上游不可用时返回缓存并标 `degraded=true`。

## Configuration

| 文件 | 用途 | 热重载 |
|------|------|--------|
| `config/models.yaml` | 每个 Agent 的模型分配 | 是 |
| `config/data_sources.yaml` | Provider 优先级 / 超时 / 重试 | 是 |
| `config/experts.yaml` | 专家人设定义 | 否 |
| `config/agent_teams.yaml` | Agent 编队 / 辩论模式 | 是 |
| `.env` | API Key 与 Base URL（AES-GCM 加密存储） | 否 |

## Compliance

所有能力限定于「研究、回测、决策支持、可审计」范畴：**不荐股、不预测、不承诺收益、不接实盘 / 自动下单**。回测页与导出报告显著标注「回测结果不代表未来收益」。
