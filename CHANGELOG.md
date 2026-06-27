# Changelog

## v1.9.8 - 2026-06-27

> **Phase 2 续**:新增**实验记录持久化(experiment_store)**——把回测/走查/筹码/策略榜的结果落 SQLite,跨会话可查、可调阅、可横向对比。补足此前 `_local_runs` 内存态重启即丢的缺口。失败安全、只增不减(与内存态并存)。

### 实验记录持久化 experiment_store(Phase 2)
- `quant/experiment_store.py`: 自包含模块,懒创建独立表 `quant_experiments`(不改 `db._create_tables`),
  复用同一 SQLite 单例连接。`save/list/get/delete/compare/count` 全部**失败安全**(出错返回
  None/[]/False,持久化失败绝不影响运行本身——诚实降级,不假装存了)。按 mode 抽紧凑指标摘要
  供列表/对比直接用;`_prune` 保留最近 300 条防无限增长。
- 4 个运行入口(回测/走查/筹码/策略榜)统一经 `_persist_experiment()` 失败安全落库,与既有内存态
  `_local_runs` 并存(只增不减)。
- 新增端点:`GET /api/quant/experiments`(列举, 可按 mode/symbol 过滤)、
  `GET /api/quant/experiments/{run_id}`(完整载荷)、`DELETE /api/quant/experiments/{run_id}`、
  `POST /api/quant/experiments/compare`(按 run_id 列表取摘要并排)。
- 前端 `Backtesting.tsx` 新增「实验记录」Tab:类型筛选(回测/走查/筹码/策略榜)+ 记录表
  (时间/类型徽标/标的/策略/关键指标摘要/删除)+ 勾选最多 4 个一键横向对比(摘要卡并排)。
- tests/test_experiment_store.py: 11 用例(存取往返/过滤倒序/删除/对比/分模式摘要/prune/失败安全),
  用临时 SQLite 连接隔离不污染开发库。

## v1.9.7 - 2026-06-27

> **Phase 2 续**:新增**策略横向对比榜**——对同一标的一次取数、跑完全部内置策略并按指标排名,帮你快速看哪些策略在该标的历史上表现更好。复用已测回测引擎,纯本地确定性,合规(历史回测 ≠ 选股建议)。

### 策略横向对比榜 strategy leaderboard(Phase 2)
- `POST /api/quant/compare-strategies`: 一次 `_load_local_bars` 取数,所有内置策略复用同一份
  bar(各自拷贝避免污染),逐策略 `BacktestEngine.run` 回测,按 `rank_by`
  (sharpe_ratio/total_return/calmar_ratio/annual_return/win_rate)降序排名。模板策略
  `custom_rule` 无默认信号 → 跳过并在 `skipped` 标注。透出 assumptions 与免责。
- 前端 `Backtesting.tsx` 新增「策略榜」Tab(复用标的/资金状态):标的选择 + 排名指标三选
  (夏普/累计收益/Calmar) + 一键对比 → 排行榜表(累计收益/年化/最大回撤/夏普/Calmar/胜率/笔数,
  冠军行高亮 + 奖杯标),复用 AssumptionsCard 与免责声明。
- 合规: 仅历史回测对比, 不构成选股推荐;附「不代表未来、不构成投资建议」免责。
- tests/test_strategy_compare.py: 8 用例(排名形状/跳过模板/降序/非法键回退/字段/确定性/免责/路由)。

## v1.9.6 - 2026-06-27

> **Phase 2 续**:新增 A 股特色的**筹码分布(成本分布)**分析——用换手率扩散模型重建当前持仓成本结构,读出获利盘比例、平均成本、筹码集中度与上下方密集价。纯确定性、失败安全、合规(描述历史成本结构 ≠ 价格预测/荐股)。

### 筹码分布 chip distribution(A 股特色 / Phase 2)
- `quant/chip_distribution.py`: 纯函数模块(不触网)。换手率扩散——每日老筹码按 (1−t) 衰减、
  新筹码 t 份按当日价格区间三角分布铺开,逐日累积得成本分布(总量守恒)。
  - 优先用每根 K 线自带**真实换手率**;缺失时退回「量能代理」(相对成交量估算换手)并标
    `model=volume_proxy`,不冒充真实换手。
  - 输出:获利盘%、平均成本、70%/90% 筹码带与集中度、上/下方筹码密集价、逐价位占比。
  - 失败安全:K 线 <20 根返回 `insufficient` 而非抛错。
- `POST /api/quant/chip-distribution`: 优先取**原始** bar(含换手率), 不足时退回带 provider/
  preview 兜底的清洗取数(无换手 → 量能代理); 线程池执行不阻塞事件循环。
- 前端 `Backtesting.tsx` 新增「筹码分布」Tab(复用标的状态):获利盘/平均成本/集中度/建模 K 线
  四卡 + 横向筹码分布柱图(获利盘红/套牢盘绿按现价着色)+ 上/下方密集价与 70%/90% 筹码带 +
  真实换手率/量能代理建模徽标 + 免责声明。
- 合规: 「密集价」表示成本聚集而非价格目标, 附「不预测价格、不构成投资建议」免责。
- tests/test_chip_distribution.py: 17 用例(不足/分布守恒/获利盘语义/模型选择/密集价/确定性/API)。

## v1.9.5 - 2026-06-27

> **Phase 2 起步**:回测可信度继续深化——新增**样本外走查(walk-forward)稳健性分析**,回答「策略的收益是跨区间稳健,还是集中在某一段运气」这个过拟合核心问题。纯确定性、失败安全、只增不减,合规不变(描述历史 ≠ 预测/荐股)。

### 样本外走查 walk-forward(1.txt 量化严谨性 / Phase 2)
把历史切成顺序的 IS(样本内)+OOS(样本外)窗口,逐窗用**同一**固定参数策略回测,度量时间稳健性:
- `quant/walk_forward.py`: 纯函数模块(不触网),`run_walk_forward(strategy, bars, …)`。
  - 每窗只跑**一次**引擎,覆盖连续的 IS+OOS 切片 → 指标有正常预热,OOS 边界无人为信号断层;
    再按权益曲线在 IS/OOS 分界处切分,OOS 收益以分界权益重新归一 → 纯样本外度量。
  - 两种方案:`anchored`(锚定,IS 从首根增长)/ `rolling`(滚动,固定一折 IS 前移)。
  - 走查效率 WFE = OOS 年化 / IS 年化;聚合输出样本外胜率、收益均值/中位/离散、平均 WFE、
    一致性评分(0-100)与稳健性描述(稳健/一般/脆弱,警惕过拟合)。
  - 失败安全:历史不足以切分时返回 `insufficient` 报告而非抛错;窗口数据不足自动收敛并标 `degraded`。
  - 复用现有 `BacktestEngine`(T+1/印花税/滑点/防未来函数)与 `metrics`,不新建引擎;
    报告附 `assumptions` 与「样本外 ≠ 未来,不构成投资建议」免责声明。
- `POST /api/quant/walk-forward`: 复用回测取数链路(_load_local_bars),线程池执行不阻塞事件循环。
- 前端 `Backtesting.tsx` 新增「样本外走查」Tab(复用策略/标的/资金状态):锚定/滚动方案切换、
  窗口数设置、一致性评分/样本外胜率/收益均值/平均 WFE 四卡、稳健性判定 banner、
  「全样本累计 vs 样本外均值」过拟合提示、逐窗口 IS/OOS 明细表、回测假设卡与免责声明。
- tests/test_walk_forward.py: 15 用例(切分/锚定 vs 滚动/聚合区间/确定性/失败安全/未知策略/API 载荷)。

## v1.9.4 - 2026-06-27

> **里程碑**:落地 guide 四份战略报告合并去重后的 P1 全部未完成项——围绕「可复核 / 数据可信 / 上手低门槛 / 工程化」六项增强:低代码策略编辑器、数据核验 Agent、CSV/Excel 自带数据源、ProviderCapability 能力 schema、数据源质量评分、回测基准相对指标。配套 Issue/PR 模板与架构文档更新。只增不减,合规红线不变(不荐股/不预测/不实盘)。

### 低代码策略编辑器 + custom_rule 规则策略(1.txt + deep-research)
让用户用「字段+操作符+阈值」无代码组合买卖信号, 复用现有回测引擎(不新建引擎):
- `quant/strategies/custom_rule.py`: 规则驱动策略插件, 走同一套自动发现+BacktestEngine;
  compute_fields 提供 13 个按 bar 对齐的字段(rsi/macd/量比/距均线%/金叉态/回撤% 等),
  仅用 ≤i 数据(配合引擎 i→i+1 成交天然防未来函数); buy/sell 规则 and/or 组合。
- 前端 `StrategyLab.tsx`(新 tab「低代码策略编辑器」, 量化研究引擎组): 内置模板卡
  (RSI 超卖/均线金叉/放量突破/回调买入) + 可视化规则构建器 + 单次仓位 + 运行真实回测
  (透出累计/年化/回撤/夏普/胜率/笔数 + 引擎假设); localStorage 策略库, 三类标签
  builtin/custom/ai, 支持粘贴 AI 规则 JSON 导入。
- 编译产物 {strategy_id: "custom_rule", params:{buy_rules,sell_rules,logic,position_size_pct}}
  直接走 /api/quant/backtest。
- tests/test_custom_rule_strategy.py: 6 用例(字段对齐/and-or/NaN/触发/端到端回测)。

### 数据核验 Agent + CSV/Excel 数据源(compass §7.3 + §7.2)
让「数据缺失」不再被 LLM 脑补, 并让用户自带数据零 Key 入查询面:
- `agents/data_verifier.py`: 确定性预检(纯规则/不触网/失败不阻断), 逐维度核验
  行情/技术/基本面/资金流/舆情/证据是否齐全/新鲜/无异常; 缺失维度打标后由
  `brief_warning()` 生成「严禁编造」强约束注入简报, overall = complete/partial/insufficient。
- orchestrator 全路径(DEEP/STANDARD/AUTO 预筛/demo/无 Agent)透出 `data_verification`;
  `/api/analysis/run` 响应新增 data_verification 字段。
- `providers/csv_provider.py`: 上传 CSV/Excel → discover_schema 认中英文表头(含单位后缀)
  → 映射标准 OHLCV → 入价格查询面(priority=15, 高于 demo_seed 低于在线真源), 数据标注
  source=csv_upload/user_upload 绝不冒充在线行情。
- 新增 `/api/providers/csv/{datasets,upload,{filename}}` 上传/列举/删除端点。
- tests: test_data_verifier.py(9 用例) + test_csv_provider.py(9 用例)。

### ProviderCapability 能力 schema(deep-research 独有)
对标 tickflow tiers.yaml「能力驱动」, 用统一 schema 表达每个数据源能力:
- BaseProvider.capability(): 返回标准化能力字典(markets/data_types/data_class/
  freshness/latency_tier/cost_tier/rate_limit/trust_level/priority/requires_key/
  available/degradable), 纯读取类属性不触发网络。
- registry.get_all_capabilities() 聚合; 新增 /api/providers/capabilities 端点。
- 修复 BaseProvider 非数据类的 field(default_factory=) 默认值未实例化的潜在 bug
  (markets/data_types/rate_limit 在子类未覆盖时会是 Field 对象)。
- tests/test_provider_capability.py: 4 用例(schema/latency_tier/degradable/聚合)。

### 数据源质量评分 quality_score(compass §7.2 + 1.txt)
把数据源终端从"只有健康/降级/不可用"升级为可量化质量分:
- `observability/source_health.py` 新增纯函数 compute_quality_score: 成功率 × 新鲜度 × 完整度(0-100),
  带 good/warn/poor 红黄绿 grade; SourceHealthMonitor.get_quality_report() 汇总。
- `/api/providers/health` 为每个 provider 附加 quality_score/grade/success_rate/
  freshness_score/completeness_score + 顶层 quality_good/warn/poor 计数与 avg_quality。
- 前端 ProviderHealthPanel: 每个 provider 卡片显示质量分(红黄绿着色)+ 成功率/新鲜度。
- tests/test_source_quality.py: 6 用例(纯函数口径 + 聚合)。

### 统计指标补基准对比/超额收益/信息比率(compass §7.4-2)
对标 Qlib 口径, 补齐回测绩效的基准相关指标:
- `metrics.py` 新增纯函数: 超额收益(calc_excess_return)、信息比率(calc_information_ratio, 年化)、
  beta(calc_beta)、Jensen's alpha(calc_alpha)。
- `build_performance_summary` 接受可选 benchmark_curve: 有基准带 excess/IR/alpha/beta,
  无基准优雅降级为 0 并标记 has_benchmark=False(回测不依赖基准数据可得性)。
- engine.run() / local_runner / BacktestRunRequest / backtest_new API 全链路支持可选
  benchmark_symbol(如沪深300 sh000300); 取不到数据则跳过基准指标, 不阻断回测。
- 前端 Backtesting.tsx: has_benchmark 时渲染「超额收益/信息比率/Beta/Alpha」第二行指标卡。
- 前端 package.json 版本 1.8.0→1.9.0 对齐(1.txt 点出的不一致)。
- tests/test_metrics_benchmark.py: 10 用例(beta=1/超额=0/降级/有基准相对指标)。

## v1.9.3 - 2026-06-27

### 风控独立一票否决 gate(决策期)
对标金策智算「门下省」与 vn.py vnpy_riskmanager 插件式风控, 把风控从「只在回测里跑」
提升为「研报发布前也过的统一 gate」:

- 新建 `backend/quant/risk/`(`rules.py` + `engine.py`): 纯规则、确定性、可单测,
  规则配置化(`config/risk_rules.yaml`)。覆盖: ST/退市黑名单、单标的仓位、总仓位/
  行业集中度、AI 结论置信度门控。
- 与回测期 `risk_controller.py`(交易级,逐 bar)职责分离, 不耦合。
- orchestrator: 研报发布前跑 `RiskEngine.gate()`, 任一 critical 触发**一票否决**——
  研报保留(可追溯)但顶部红字写明理由, summary 不给出买入方向。
- `/api/analysis/run` 响应透出 `risk_gate` 字段(findings/vetoed/veto_reasons)。
- **合规红线**: 风控只做研究层风险提示与决策约束, 绝不输出买卖指令。
- 新增 `tests/test_risk_engine.py`(9 用例: 单规则 + gate 汇总 + orchestrator 集成)。

## v1.9.2 - 2026-06-27

### Agent 结论可溯源：绑定 evidence_id
此前证据链虽已存储, 但 Agent 结论没有反链到具体证据, "可审计"是半成品。本次补齐:

- **结构化证据池**: `context_builder.fetch_evidence_pool()` 返回带稳定 `evidence_id` 的证据条目,
  简报里的 `[n]` 编号与证据 ID 一一对应。
- **结论反链**: orchestrator 把每个 Agent reason/evidence 里的 `[n]` 引用解析成真实 `evidence_id`,
  幻觉引用(编号不存在)被静默丢弃。三种模式(STANDARD/DEEP/AUTO)响应统一带 `evidence_pool`。
- **API 透出**: `/api/analysis/run` 每个 agent 块带 `evidence_ids[]`, 顶层带 `evidence_pool[]`。
- **前端溯源**: AgentOpinionCards 渲染「结论溯源」标签, 点击跳转证据来源(新闻/研报/公告)。
- 新增 `tests/test_evidence_binding.py` 契约测试(4 用例)。

## v1.9.1 - 2026-06-26

### 回测可信度底线：真实 A 股交易摩擦
此前自研回测引擎用当天收盘价撮合、买入当日即可卖出、仅含佣金,会系统性高估收益。本次补齐量化项目可信度底线:

- **防未来函数**：T 日信号于 **T+1 开盘价成交**（不再用当天 close 既算信号又成交）。信号在最后一根 bar 时无下一 bar 可成交则丢弃,杜绝"事后成交"。
- **T+1 约束**：当日买入不得当日卖出（`backend/quant/constraints.py` `T1Constraint`）。
- **印花税**：卖出单边 0.05%（`TradingCostModel.stamp_duty_rate`）。
- **滑点**：买入 +0.1%、卖出 −0.1%（对买卖双方均不利方向偏离）。
- **佣金最低 5 元**：万三双边,小单保底 5 元。
- **涨跌停封板过滤**：涨停不可买入、跌停不可卖出（`PriceLimitFilter`,默认 ±10%,可设 ±5% 适配 ST）。
- **假设透明化**：每个回测结果新增 `assumptions` 字段(佣金/印花税/滑点/T+1/封板/成交价口径),API 响应同步透出,供研报展示"本次回测假设"。
- **向后兼容**：`BacktestEngine(initial_capital, commission_rate)` 旧调用零改动;`Portfolio.execute_buy/sell` 新增可选 `commission`/`stamp_duty` 参数,缺省走旧路径。
- **测试**：新增 `tests/test_backtest_constraints.py`(18 用例),覆盖成本模型/T+1/涨跌停/防未来函数/向后兼容。113 个量化相关测试全部通过。

## v1.8.1 - 2026-06-24

### 修复与开箱体验
- **行情涨跌幅修正**:腾讯兜底源失效时拉不到最新交易日 → 昨收取陈旧值、涨跌幅严重失真甚至恒为 0。新增**东方财富 push2his 直连**兜底,取价链路 `akshare hist → 东财直连 → 腾讯`,保证开高低收 / 昨收 / 涨跌幅准确。
- **「自定义 API 接口」开箱即用**:发布版默认 `ALLOW_LOCAL_LLM_BASE_URL=1` 放行自定义 Base URL;首次启动**自动生成持久 `AI_FINANCE_MASTER_KEY`**(每台独立、安全),保存自定义 Provider 的 Key 无需手动配置主密钥、不再依赖不安全的开发回退密钥。
- **预置常用股行情种子**:打包内置常用蓝筹 / 港股近 1 年日线,开箱即有正确价格与涨跌幅;首次启动后行情源自动补到最新交易日。

## v1.8.0 - 2026-06-19

### 多源内容能力接出为可用模块(融合 UZI-Skill,MIT)
- **龙虎榜/游资**:机构 vs 游资席位拆分 + 24 游资席位库匹配 + 近月活跃龙虎榜;杀猪盘 8 信号检测。
- **估值建模**:DCF(WACC+两阶段+5×5 敏感性)/ Comps / Quick LBO / 三表;可调假设情景分析。
- **投资人库**:59 位投资人 persona,可搜索浏览、多选一键组建专家团(桥接为 agent)或导出团队提示词。
- **研报质量门控**:确定性机械检查(禁空话/覆盖率/矛盾呈现/免责),critical 不清零拒绝发布;导出 `?gate`。

### 工作台与体验
- **自选晨报**:自选股后端持久化 + 每日聚合行情/新闻,展开内嵌估值/游资。
- **成本可见**:顶栏成本药丸(今日/7天/30天/累计 + 按模型),`/api/diagnostics/cost-summary`。
- **首次引导向导**;**研究成果一键导出 Markdown**;四个新模块统一美化 + 响应式适配。

### 工程
- 新增 10 个 API 路由 + 6 个前端模块;CI 转绿(修 `fastapi.testclient` 采集错误,版本断言改为 pyproject 单一来源)。
- 第二次全面检修:ruff 全后端 0 问题、全套 1044 测试通过、实跑端点冒烟(估值真实数据闭环)、龙虎榜未知 market 稳健性修复。

## v1.7.4 - 2026-06-05

### 年K与自定义周期
- 新增 Workbench `年K` 周期，后端支持 `frequency=1y`，从日线按自然年聚合 OHLC、成交量和成交额。
- 新增 Workbench `自定义` 周期入口，支持选择 `分时 / 日K / 周K / 月K / 年K` 粒度和对应窗口大小。
- 年K横轴显示年份，月K继续显示月份，避免把月K标签抽样误认为半年K。
- 新增年线聚合回归测试，覆盖 `normalize_frequency("年K")`、年线窗口和年度 OHLC 聚合。
- Browser-Use 实测通过：年K与自定义年K均显示年度刻度，页面 fresh `warn/error=0`。

## v1.7.3 - 2026-06-05

### K 线周期日期联动修复
- 修复 Workbench K 线周期切换后横轴日期粒度没有稳定跟随的问题。
- `分时` 兜底数据改为按分钟生成，横轴显示 `HH:mm`。
- `日K`、`周K` 横轴保持 `MM-DD`，`月K` 横轴显示 `YYYY-MM`。
- Browser-Use 实测通过：分时、日K、周K、月K 四个周期横轴均与当前选项对应，临时验证页 fresh `warn/error=0`。

## v1.7.2 - 2026-06-05

### 图表稳定与一键启动复验

- 新增 `StableChartContainer`，在容器尺寸可用后以数字宽高渲染 Recharts 图表，避免首次布局、动画切换和隐藏页签触发 `width(-1)` / `height(-1)` warning。
- 替换 Workbench、Portfolio、Backtesting、MultimodalChart、FundDcaLab 中的直接 `ResponsiveContainer` 用法。
- 修复 K 线/多模态页本地预览数据的日期生成逻辑，避免出现 `05-32`、`05-48` 等非法日期刻度。
- 版本号统一升至 `1.7.2`，覆盖 `pyproject.toml`、前端 package、桌面启动器和 Inno Setup 配置。
- 重新生成 Windows portable 目录和 `AlphaScope-portable.zip`，并确认 `_internal/pyproject.toml`、`_internal/akshare/file_fold/calendar.json`、`_internal/apps/web/dist/index.html` 均在包内。
- 打包版烟测通过：`/health` 返回 `1.7.2`，`/api/prices/600519?limit=3` 返回 `success=true`、`source_status=ok`、`degraded=false`。
- Browser-Use 打开最终打包页面后，新增 console `warning=0`、`error=0`、Recharts warning `0`。

## v1.7.1 - 2026-06-04

### 已知问题修复与一键启动交付
- 修复通用文件上传文件名安全问题，保存前规范化文件名并约束最终路径位于上传目录内。
- 修复顶部搜索框 Enter 键误选择建议列表第一项的问题。
- 修复 `/api/analysis/run` 在所有 Agent 失败时仍返回成功 envelope 的问题，新增 `analysis_all_agents_failed` 错误码。
- 新增服务端股票池 CSV 导出接口 `/api/quant/stock-pool/export`，前端导出优先使用服务端端点。
- 修复 Workbench 首屏 Recharts 容器高度警告。
- 补齐 React 类型依赖和前端类型定义，恢复 `npm run lint` 与生产构建通过。
- API 版本改为读取 `pyproject.toml`，CORS 默认限制到本地来源。
- 重新验证 Windows portable 打包链路，`python build.py --zip` 可生成 `AlphaScope.exe` 和 `AlphaScope-portable.zip`。

## v1.7.0 - 2026-06-01

### 安全与真实性修复

- 知识库上传文件名改为去除路径组件并规范化非法字符，保存路径和 metadata 不再使用客户端原始文件名。
- Workbench 材料上传改为真实调用 `/api/knowledge/upload`，仅在后端确认成功后显示上传成功，失败时显示错误。
- `/api/analysis/run` 改为读取真实行情并拒绝空行情 / 零值行情，避免后端生成未标注的正常分析成功响应。
- 新闻与技术指标接口增加 `limit`、`days`、`window`、`lookback` 上限，防止超大请求驱动过量工作。
- Provider 模型列表获取移入 worker thread 并增加超时，避免阻塞 async API 路径。
- 新增上传安全、资源限制、分析保护和设置超时回归测试；定向回归 `42 passed`。

## v1.6.0 - 2026-05-31

### 新闻研究流与可配置 Agent

- 新增新版 Windows 一键安装包构建链路，`python build.py --installer` 会构建 React Web、打包 FastAPI 桌面启动器并生成 Inno Setup 安装包。
- 打包版启动器改为自动启动本地 FastAPI 和静态 Web 前端，自动写入运行时 API 地址并打开浏览器。
- 新增 GitHub Actions `Windows Installer` 工作流，可为 tag/release 生成 `AlphaScope-Setup-*.exe` 和便携 zip。
- 新闻模块新增详情弹层，可查看正文、来源、分类、影响、情绪和 AI 摘要。
- 新闻模块新增 AI 助手，支持选中新闻咨询，也支持解析用户输入的新闻链接。
- 新闻原文跳转改为优先打开真实来源；缺失真实链接时按标题、标的和来源降级到搜索跳转。
- 新闻源概览改为可收起，避免遮挡新闻列表。
- 新增 `agentConfigs` 前端配置模块，支持 Agent 数量、启用状态、名称、角色、职责、提示词、模型、温度和图标配置。
- Agent 编排迁移到系统设置页签；专家圆桌页回归运行监控视图。
- 分析请求 `run` 与 `async` 会携带启用中的 `agent_configs`。
- 清理当前前端可见品牌残留和旧内部代号，更新前端 package 与 release 文档。
- 前端 `npm run lint` 与 `npm run build` 通过，保留既有 Vite chunk size warning。

## v1.5.0 - 2026-05-30

### AlphaScope 过渡发布

- 项目更名与工作台发布链路整理。
- 为 v1.6.0 桌面分发、模型路由和新闻/研报体验增强做准备。

## v1.4.2 - 2026-05-28

### 品牌迁移与本地体验稳定性

- 项目正式更名为「研策中枢 AlphaScope」，README、前端 README、clone 地址和 Release 链接迁移到 `https://github.com/TIANWEN-cpu/AlphaScope`。
- 修复本地回测入口在后端短暂离线或策略状态过期后卡死的问题；点击运行会自动刷新本地回测状态和策略列表。
- 回测页新增“刷新状态”，并在本地 quant 接口不可用时给出明确诊断提示。
- 新闻模块刷新失败时保留上次成功结果，不再直接清空列表；空态提供“重新同步”。
- 后端新闻出库层修复历史 UTF-8/latin1 乱码字段，新闻标题、摘要、来源和公告字段恢复正常中文展示。
- 新增 `/api/settings/preferences` GET/PUT 接口和 `app_preferences` SQLite 持久化表。
- 系统设置的基础设置、网络节点、安全组、数据管理页签接入真实表单和保存操作，不再显示“配置项暂未接入”。
- 新增设置偏好与新闻乱码修复测试；前端 `npm run lint` 通过，后端定向回归 `52 passed`。

## v1.0.1 - 2026-05-22

### Windows 前端与启动修复

- 修复 v0.85 Windows 一键包遗留问题：PowerShell UTF-8 无 BOM 脚本在 GB2312 环境下解析失败。
- 修复 `start_local.ps1` 使用 `npm` 可能误打开 Notepad，导致 Next.js 3000 端口未正确启动。
- 修复 `stop_local.ps1` 使用 `$pid` 与 PowerShell 内置变量冲突的问题。
- 增强停止脚本：递归停止进程树，清理端口 3000/8000/8501 和残留 Next.js 子进程。
- 新增 `apps/web/postcss.config.js`，修复 v1.0 主前端 Tailwind CSS 未输出、`layout.css` 404、页面呈现裸 HTML 的问题。
- 启动前清理 `apps/web/.next`，避免 `next build` 覆盖 dev server 缓存后 CSS 404。
- 重做 Next.js 主工作台 UI：左侧研究控制台、中间分析区、右侧研究监控面板。
- 修复 `/health` 版本号仍为 `0.50.0` 的问题，统一为 `1.0.1`。
- 更新前端 package 版本为 `1.0.1`，补充 v1.0.1 release notes。

## v1.0 - 2026-05-21

### 正式版发布

- 本地一键启动
- 主工作台（Next.js）
- API 配置（5 家 LLM 厂商）
- 专家团分析（10 位专家）
- K 线图分析（视觉 AI）
- 文件上传（图片/PDF/CSV/Excel）
- 报告保存和导出
- 历史记录持久化
- 本地备份恢复
- 完整用户手册
- 测试全绿（697 passed）

## v0.90 - 2026-05-21

### Release Candidate

- 功能冻结，进入稳定化阶段
- 全面测试验证（697 tests passed）
- Lint 和格式化检查通过
- Next.js 构建验证通过
- CI 全绿
- 整理 release notes
- 更新用户手册

## v0.85 - 2026-05-21

### Windows 一键包

- 新增 `AlphaScope-Setup.bat` 一键安装启动器
- 新增 `scripts/install_deps.ps1` 自动依赖安装
- 新增 `scripts/create_shortcut.ps1` 桌面快捷方式创建
- 增强 `scripts/check_env.py` 支持 `--fix` 自动修复
- 增强 `scripts/start_local.ps1` 支持首次运行检测
- 更新 `scripts/start_local.bat` 集成首次运行安装

## v0.81 - 2026-05-21

### User Manual

- 完整用户手册，包含 8 个章节
  - 安装指南 - 环境准备与安装步骤
  - 快速开始 - 5 分钟上手流程
  - 模型接入配置 - LLM API Key 配置
  - 数据源接入 - 20+ 数据源配置
  - 专家团使用 - 10 位专家协作分析
  - K 线图分析 - 视觉 AI 技术分析
  - 报告管理与导出 - 查看、搜索、导出
  - 常见问题与故障排除 - FAQ 与诊断

## v0.15 - 2026-05-20

### Provider Plugin Architecture

- Refactored `_auto_register_providers()` to use dynamic module scanning (`importlib` + `pkgutil`). All 20 providers are now auto-discovered -- no more hardcoded imports in registry.py.
- Added `custom_providers/` directory for user-created data sources. Drop a file, configure in YAML, done.
- Added `scripts/create_provider.py` -- CLI generator for provider skeletons.
- Added `BaseProvider.is_available()` classmethod for dependency checking before instantiation.
- Added `ProviderRegistry.reload()` for hot-reload during development.
- Dashboard source health panel now shows built-in vs custom provider distinction with reload button.
- All 11 previously unregistered providers (finnhub, fred, northbound, google_trends, reddit, stocktwits, wikipedia_views, choice, ifind, jy, wind) are now auto-discovered.

## v0.14 - 2026-05-19

### News Section Overhaul

**Root cause fixes for empty concept/industry news:**

- `fetch_stock_concepts` — rewrote from serial 50-board scan to East Money datacenter API (`RPT_F10_CORETHEME_BOARDTYPE`), 1 HTTP request returns all boards in <1s.
- `fetch_industry_name` — added datacenter API as primary source, uses `board_type="行业"` to reliably identify industry boards. Fixed misidentification (e.g. "权重股" for 宁德时代 → "电力设备").
- `fetch_keyword_news_em` — fixed Chinese keyword URL encoding in search cookie (`urllib.parse.quote`), which caused `curl_cffi` latin-1 encoding error returning 0 results.

### Concept Relevance Sorting

- Uses `IS_PRECISE` and `BOARD_RANK` fields from datacenter API to sort concepts by relevance.
- Precise matches (★) ranked first, then industry boards, then generic/index boards.
- Example: 贵州茅台 → ★白酒, ★超级品牌, ★电商概念 (instead of 大盘股, 标准普尔, 央视50).

### News Tags

- `get_concept_news` and `get_industry_news` now attach `matched_keywords` to each news item.
- Dashboard displays matched keywords as colored tag chips below each news title.
- Concept news tags (blue), industry news tags (amber).
- `fetch_keyword_news_em` results include `topic` field showing the search keyword.

### Cache Optimization

- Concept/industry/main-business cache TTL reduced from 86400s (24h) to 3600s (1h).
- Concept blacklist reduced from 12 to 5 entries.

### Dependencies

- Fixed `curl_cffi` import failure silently returning `[]` — added `requests` as fallback HTTP client.

## v0.13.1 - 2026-05-19

### Utility Modules
- Added `backend/utils/datetime_util.py` — datetime parsing and timezone normalization for Chinese financial data sources. Handles 10+ datetime formats, normalizes to Asia/Shanghai timezone.
- Added `backend/utils/tracer.py` — lightweight span-based tracing system with thread-safe ring buffer, context manager and decorator APIs. Can be optionally upgraded to OpenTelemetry.

### Code Review Fixes
- Fixed `frontend/dashboard.py`: removed duplicate `@st.cache_data` decorator on `get_stock_list()`, fixed undefined `logger` reference.
- Fixed `backend/utils/tracer.py`: thread-safe `_trace_counter` increment in `start_span()`.
- Fixed `backend/archive.py`: removed redundant `import re` inside function body.
- Fixed `backend/expert_panel.py`: `TypeError` in `__main__` self-test when printing evidence dicts.
- Fixed `backend/archive_tagger.py`: `_save_index()` now uses atomic write (temp file + replace).
- Fixed `backend/storage/db.py`: added `threading.Lock` around all `insert_*` + `commit` operations to prevent concurrent SQLite writes.

### Pipeline
- Pipeline `_to_news_row` / `_to_report_row` / `_to_announcement_row` now normalize datetime strings via `normalize_dt_str()`.
- Added `@st.cache_data(ttl=300)` to `get_stock_list()` in dashboard.

### Dependencies
- Pinned all dependency versions in `requirements.txt` with `==`.

### Tests
- Added `tests/test_agent_modes.py` — 27 tests for AnalysisMode enum, AgentModeEntry, AgentModeConfig, ModeResolver singleton (including thread safety), and convenience functions.
- Added `tests/test_datetime_util.py` — tests for datetime parsing across 10+ formats, timezone normalization, and display formatting.
- Added `tests/test_tracer.py` — tests for Span, Tracer ring buffer, traced context manager, traced_func decorator, and stats.

## v0.13.0 - 2026-05-19

### Agent Mode System (Highest Priority)
- Added `backend/agent_modes.py` — three-tier analysis mode system: Standard (3 agents, DeepSeek, fast/cheap), Deep (5 agents + critic + chairman, Claude/GPT, full analysis), Auto (pre-screen then escalate if ambiguous).
- Added `config/models.yaml` — declarative model configuration replacing hardcoded `AGENT_MODEL_CONFIG`, supports hot-reload.
- Added `run_agents_with_mode()` in `llm_agents.py` — mode-aware agent execution with automatic evidence/factor injection based on mode.
- Added `_run_auto_mode()` — quick pre-screen with cheap model, escalates to full DEEP analysis if confidence is between 30-70.
- Dashboard sidebar now has mode selector radio button (标准/深入/自动).
- Analysis results show mode indicator badge with escalation status.

### New Data Sources (7 Providers)
- Added `backend/providers/finnhub_provider.py` — US stock sentiment, insider trading, ESG data (free tier: 60 req/min).
- Added `backend/providers/fred_provider.py` — Federal Reserve Economic Data, 800,000+ economic time series (completely free).
- Added `backend/providers/northbound_provider.py` — 沪深港通北向资金 flow data (free via AkShare).
- Added `backend/providers/reddit_provider.py` — r/wallstreetbets sentiment via PRAW (free, 60 req/min).
- Added `backend/providers/google_trends_provider.py` — retail attention via search volume (free, 50 req/day).
- Added `backend/providers/stocktwits_provider.py` — US retail sentiment with bullish/bearish voting (free REST API).
- Added `backend/providers/wikipedia_views_provider.py` — company page views as attention indicator (free REST API).

### Evidence Aggregator
- Added `backend/quality/evidence_aggregator.py` — cross-source data validation, multi-source confidence boost, contradiction detection.
- Replaces simple "first one wins" fallback with "collect and cross-validate from N sources".

### Anomaly Detector
- Added `backend/quality/anomaly_detector.py` — detects zero/negative prices, limit-up/down violations, garbled titles, duplicate timestamps.

### Prompt Injection Protection
- Added `validate_stock_code()` in `validators.py` — whitelist validation for 6-digit A-share codes.
- Added `sanitize_prompt_input()` — removes injection patterns (ignore instructions, system prompt, jailbreak attempts).
- Added `sanitize_stock_data_for_prompt()` — validates stock code and sanitizes text fields before LLM prompts.

### Thread-Safe Singletons
- Fixed `DataPipeline`, `Database`, `VectorStore` singletons with double-checked locking via `threading.Lock()`.
- Fixed Retriever error propagation: now raises `ResourceUnavailableError` instead of returning `None`.

### BaseProvider Enhancement
- Added new fields to `BaseProvider`: `data_class`, `freshness`, `cost_tier`, `rate_limit`, `requires_key`.
- Enables intelligent routing based on data category, freshness requirements, and cost constraints.

### Engineering Hardening
- Added `.github/workflows/ci.yml` — GitHub Actions CI with ruff lint + pytest on Python 3.10/3.11/3.12.
- Added `.env.example` — complete environment variable template with all required API keys.
- Added `Makefile` — unified commands: `make test`, `make lint`, `make run`, `make docker-build`.
- Updated `docker-compose.yml` — added resource limits (CPU/memory) and health checks.
- Moved 9 stray test files from `backend/` to `tests/probes/`.

### Data Pipeline Integration
- Added `backend/pipeline.py` — `DataPipeline` class wiring Provider → Dedup → SourceRank → SQLite → ChromaDB into a unified ingestion flow.
- Pipeline supports: `ingest_news()`, `ingest_reports()`, `ingest_announcements()`, `ingest_prices()`, `ingest_fundamentals()`, `ingest_fund_flow()`, `search_evidence()`.
- All pipeline operations are logged to `source_fetch_logs` for observability.

### Ingestion Scheduler Jobs
- Added `backend/ingestion/jobs.py` — concrete fetch jobs for CN news (5min), CN reports (1hr), CN announcements (1hr), market snapshot (1hr), CN prices (daily), US SEC filings (15min).
- `create_default_scheduler()` factory creates a fully configured `DataScheduler` with all default jobs.

### Provider Fixes
- **HKEX Provider**: Implemented proper HTML parsing for HKEXnews search results with fallback link extraction.
- **SEC Provider**: Implemented ticker-to-CIK lookup using SEC's official `company_tickers.json` with in-memory caching. Fixed `_symbol_to_cik()` to return actual CIK numbers.

### Event Extraction
- Added `backend/events/extractor.py` — rule-based event extractor classifying news/announcements into 8 event types (earnings, dividend, M&A, financing, litigation, policy, supply_chain, insider) with sentiment scoring and importance rating.
- Pipeline automatically enriches news with event_type/sentiment and announcements with category during ingestion.
- Supports batch extraction via `extract_events_from_news()` and `extract_events_from_announcements()`.

### Quantitative Factor Generation
- Added `backend/factors/generator.py` — `FactorGenerator` computing 5 factor dimensions: news sentiment, event signal, analyst rating, fund flow, price momentum.
- All factors normalized to [-1.0, 1.0] with configurable weights for composite scoring.
- `fetch_factor_context()` in `llm_agents.py` injects factor analysis into agent market briefs.
- `run_all_agents()` and `run_batch_critic()` now include factor context for more informed analysis.
- Added `frontend/components/factor_panel.py` — interactive factor display in the Agent analysis tab.
- Updated `critic.md` with 7th scoring dimension: factor consistency.

### Evidence-Driven Agent Output
- Added `fetch_evidence_context()` in `llm_agents.py` — retrieves RAG evidence and formats it for agent prompts.
- `build_market_brief()` now accepts optional `evidence_context` and `factor_context` parameters.
- `run_all_agents()` automatically fetches evidence + factor context before building the market brief.
- Updated `critic.md` with 6th/7th scoring dimensions: evidence coverage rate, factor consistency.
- `build_critic_prompt()` now accepts `available_evidence` and `factor_context` parameters.

### Frontend: Source Health Dashboard
- Added Tab 10 "📊 数据源健康" to the Streamlit dashboard.
- New `frontend/components/source_health_panel.py` — displays Provider health table, fetch log statistics, RAG index status, and database record counts.
- Added `render_trust_badge()` helper for S/A/B/C/D trust level display.

### Tests
- Added `tests/test_schema_models.py` — tests for all Pydantic models (NewsItem, ResearchReport, Announcement, PriceBar, FundFlow, EvidenceItem, EvidenceBundle, AgentReport).
- Added `tests/test_dedup.py` — tests for Deduplicator fingerprint and dedup logic.
- Added `tests/test_source_rank.py` — tests for SourceRanker trust scoring and ranking.
- Added `tests/test_db.py` — tests for Database insert/upsert with temporary SQLite.
- Added `tests/test_scheduler.py` — tests for FetchJob tick/execute and DataScheduler lifecycle.
- Added `tests/test_pipeline.py` — tests for DataPipeline data conversion and status.
- Added `tests/test_sec_provider.py` — tests for SEC CIK lookup and filing parsing.
- Added `tests/test_hkex_provider.py` — tests for HKEX HTML parsing and category guessing.
- Added `tests/test_factors.py` — tests for FactorGenerator, FactorReport, rating scores, event category scores, and convenience functions.

### Integration
- Updated `news_data.py` `fetch_*_via_provider()` functions to route through `DataPipeline` first (v0.12), then Provider Registry (v0.11), then original functions (fallback).
- Updated dashboard footer to v0.12.

## v0.11.0 - 2026-05-18

### Provider Plugin Architecture
- Added `backend/providers/` with `BaseProvider` abstract class and `ProviderRegistry` for automatic source selection, priority ranking, and failover.
- Implemented 9 concrete providers: AkShare, Tushare Pro, BaoStock, OpenBB, SEC EDGAR, HKEXnews, CNInfo, CLS, EastMoney.
- Added `config/data_sources.yaml` for centralized provider configuration (enabled/disabled, priority, timeout, retry).

### Standardized Data Models
- Added `backend/schemas/` with Pydantic models: `NewsItem`, `ResearchReport`, `Announcement`, `PriceBar`, `FundFlow`, `EvidenceItem`, `EvidenceBundle`, `AgentReport`.
- All provider outputs now conform to standardized schemas for consistent downstream consumption.

### Data Quality Layer
- Added `backend/quality/dedup.py` — fingerprint-based deduplication for news, reports, and announcements.
- Added `backend/quality/source_rank.py` — source trust level scoring (S/A/B/C/D) from config.

### Storage Layer
- Added `backend/storage/db.py` — SQLite database with 6 core tables: `news_items`, `research_reports`, `announcements`, `price_bars`, `source_fetch_logs`, `evidence_items`.

### Ingestion Pipeline
- Added `backend/ingestion/scheduler.py` — `DataScheduler` with configurable fetch intervals and health tracking.

### RAG Layer
- Added `backend/rag/chunker.py` — `TextChunker` for document segmentation.
- Added `backend/rag/vector_store.py` — ChromaDB-backed vector store with collection management.
- Added `backend/rag/retriever.py` — unified retriever integrating chunking and vector search.

### Observability
- Added `backend/observability/source_health.py` — `SourceHealthMonitor` for provider status tracking and reporting.

### Docker Support
- Added `Dockerfile` with multi-stage build and health check.
- Added `docker-compose.yml` with app + Redis services.

### Integration
- Extended `news_data.py` with `fetch_news_via_provider()`, `fetch_reports_via_provider()`, `fetch_announcements_via_provider()` that route through Provider Registry with automatic fallback to existing functions.
- Updated `requirements.txt` with new dependencies: pydantic, tenacity, aiohttp, chromadb, apscheduler.

## v0.10.6 - 2026-05-18

- Isolated fallback LLM credentials so provider-specific or custom API keys are not reused when switching to the DeepSeek fallback.
- Rejected private, local, and otherwise non-public custom LLM base URLs by default unless explicitly enabled through environment configuration.
- Hardened archive file handling with safe names, archive-root path checks, and atomic index writes.
- Improved Eastmoney search handling with no-cookie first requests, validated article URLs, and an explicit `curl_cffi` dependency.
- Replaced broad JSON-object extraction with balanced-brace scanning for LLM responses.
- Made AI chat hot-reload compatibility use function signature inspection instead of TypeError string matching.
- Loaded fundamentals data sources in parallel on cache misses.
