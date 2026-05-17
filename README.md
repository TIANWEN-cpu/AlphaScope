# 金融 Agent 工程工作台

> 安装日期：2026-05-16
> 位置：克隆后的仓库目录
> Python 环境：建议使用本地虚拟环境 `.venv` 或 `venvs/finance-agent-engineering`
> 当前版本：**v0.10.5（行业/概念新闻主动召回 + 关联概念简报）**

## v0.10.5 新特性（增量）

| 模块 | 主要能力 |
|---|---|
| **🏭 行业新闻主动召回** | 新增东财主题搜索链路：按行业名、经营范围关键词、关联概念词主动搜索新闻，不再只依赖大盘快讯池关键词过滤 |
| **🧩 关联概念新闻增强** | 关联概念 Tab 同时展示概念归属、快讯池命中与东财主题搜索补充，解决小盘/主题股相关新闻偏少的问题 |
| **🤖 Agent 简报补强** | 深度分析与专家圆桌纳入概念板块动态；行业简报合并快讯池 + 主题搜索，并补入新浪快讯作为第三路资讯池 |
| **🧪 测试覆盖扩展** | 新闻合并去重、主题关键词生成、多关键词搜索聚合均有离线测试；当前测试 **125 passed** |

> v0.10.5 借鉴 TradingAgents 的 router 思路，把上层“行业/概念/主营业务词”统一收敛为主题新闻搜索；接口失败仍返回空列表，不阻断主分析流程。

## v0.9 新特性（增量）

| 模块 | 主要能力 |
|---|---|
| **🧐 Critic 审稿 Agent** | `backend/critic.py`：单次批量调用，对所有 Agent 输出打 0-100 质量分，列出"站得住的证据 / 与简报矛盾 / 漏掉的证据 / 是否过度自信"，并给一个**分歧解释**（level / main_axis / summary） |
| **🧬 审稿质量入归档** | 每个 Agent 的 `review` 写入 `agent_models[k].review`；索引层附 `critic` 摘要（平均质量、过度自信数、分歧度）；Tab 8 列表行新增审稿徽标 |
| **🧪 pytest 脚手架** | 新增 `tests/` 与 `pytest.ini`，共 64 条单元测试覆盖 validators、critic、archive 摘要；`pytest>=7.0` 标记为开发依赖 |
| **🔧 工程小修** | `.gitattributes` 锁定 LF 换行；删除 `llm_agents.call_agent` 空 stub |

> v0.9 仅新增 `pytest` 一个开发依赖，运行时依赖与 v0.8 持平。

## v0.8 历史特性（保留）

| 模块 | 主要能力 |
|---|---|
| **🧪 Schema 校验** | `backend/validators.py`：Agent 与专家 JSON 输出统一规范化 |
| **🧬 证据链 + 失效条件** | `evidence` / `invalid_if` / `risks` 在 prompt、归档与 UI 端打通 |
| **📈 后验评估扩展** | `archive_tagger`：20 日收益、10 日最大回撤、3/5/10 日命中标签 |
| **⚖️ 模型组合后验表现** | `archive.get_combo_performance()` + Tab 8 后验区块 |
| **🛡️ Git 仓库 + 基线** | `main` 分支，按 baseline → step 逐次提交 |

## v0.7 历史特性（保留）

| 模块 | 主要能力 |
|---|---|
| **💡 基本面 Tab(重构)** | 财务摘要(近 4 期营收/净利/毛利率/ROE/负债率折线 + 同比柱图) / 三表股东结构 / 行业前 8 + 本股同业对比(本股加粗高亮) / 24h 文件缓存 |
| **🤖 AI 咨询(浮动)** | 侧边栏开关启用,主区出现折叠面板;6 厂商可切;30 轮自动截断;一键导出 Markdown |
| **🎓 专家团圆桌(新 Tab)** | 5 位风格化投顾(巴菲特/林奇/缠论/宏观/风控)并行 → 三段式 JSON → 5 卡片 → 投票统计 → 圆桌纪要导出归档 |
| **💰 资金流细分** | 在原资金流向 Tab 底部追加 4 类(超大/大/中/小)饼图 + 5 日柱图 + 主力进出场判定文字 |
| **📰 资讯时间轴** | 资讯研报 Tab 顶部新增"时间轴 / 分类"切换;时间轴下三源最近 10 条按时间倒序 |

## v0.7 新增依赖

```bash
python -m pip install "pyyaml>=6.0"
```

## 目录结构

```
项目根目录
├── apps\                       # 金融 Agent 项目源码
│   ├── ai-hedge-fund\
│   └── TradingAgents\
├── backend\                    # 业务后端模块
│   ├── llm_agents.py           # 5 Agent + 主席(v0.7 注册 kimi 厂商,暴露 call_llm)
│   ├── news_data.py            # 财联社/东财/新浪/财新/研报
│   ├── fund_flow.py            # 主力资金流向(个股 + 大盘)
│   ├── fundamentals.py         # v0.7: 财务/股东/同业 + 24h 缓存
│   ├── ai_chat.py              # v0.7: AI 咨询会话/上下文注入/30 轮截断
│   ├── expert_panel.py         # v0.7: 5 专家并行 + 三段式 JSON + Markdown 纪要
│   └── archive.py              # v0.7: save_roundtable + type_filter
├── config\                     # v0.7 新增
│   └── experts.yaml            # 5 位专家人设/推荐模型/止损偏好
├── frontend\
│   ├── dashboard.py            # 8 Tab 看板(v0.7 增加专家圆桌 Tab)
│   └── components\             # v0.7 新增
│       ├── fundamentals_panel.py
│       ├── ai_chat_panel.py
│       └── expert_panel_view.py
├── cache\                      # v0.7 新增运行时
│   └── fundamentals\           # {symbol}.json 24h 缓存
├── reports\
│   ├── archive\                # AI 决策报告(type=agent)
│   ├── roundtables\            # v0.7: 圆桌纪要(type=roundtable)
│   ├── chat_history\           # v0.7: AI 咨询导出 Markdown
│   └── streamlit-*.log
├── requirements.txt            # v0.7 新增依赖声明
├── data\        notebooks\
└── venvs\
    └── finance-agent-engineering\
```

## 核心能力

### 数据层
- **akshare**：A 股 K 线/成交量/资金流向（个股+大盘）/快讯/研报/财报/股东/同业
- **OpenBB**：全球金融数据接口（备用）

### 分析层（5 Agent + 主席 + 5 专家圆桌)

每个 Agent / 专家使用最适配其任务的厂商模型，避免单一模型偏见：

| 角色 | 输入 | 模型 | 选型理由 |
|------|------|------|------|
| 🏛️ 基本面分析师 | 行业地位、研报评级、财务摘要 | **Claude** `claude-sonnet-4-5` | 深度推理 + 中文友好 |
| 📐 技术分析师 | MA/MACD/RSI/量比 | **GPT** `gpt-5.2` | 结构化模式识别 |
| 💬 舆情/情绪分析师 | 个股新闻+大盘资讯+研报+资金流 | **DeepSeek** `deepseek-chat` | 中文原生 + 长文性价比 |
| ⚠️ 风险控制师 | 波动率+回撤+主力流向 | **SenseNova** `deepseek-v4-flash` | 异源推理引擎，避免同质偏见 |
| 🏪 散户行为分析师 | 散户/主力反向信号、情绪阶段 | **Mimo** `mimo-v2.5-pro` | 提供差异化第三视角 |
| 🎩 投资委员会主席 | 综合 5 Agent 输出 | **Claude** `claude-opus-4-7` | 顶级综合判断 |

**双层兜底**：每个 Agent 调用顺序为「主厂商 → DeepSeek 兜底」。任意厂商 API 故障时自动切换，归档元数据中以 `fallback_count` 字段透明记录。

### 看板 Tab
1. 📈 K 线 & 技术指标
2. 🤖 Agent 协作分析（**模型阵容展示条** + 5 Agent 异构推理 + 报告导出）
3. 📰 资讯 & 研报（个股相关/大盘快讯/机构研报评级）
4. 💰 资金流向（5 类资金分层 + 大盘联动）
5. 📋 数据明细
6. 💡 基本面
7. 📚 **研究存档**（决策分布/活跃度/检索/模型组合统计/历史回看）

### 研究存档系统（v0.5 增强）
- 每次 LLM 深度分析自动落盘到 `reports/archive/{symbol}/{时间戳}-{股票名}.md`
- 5 分钟内同股票去重
- 索引 `index.json` 记录决策、置信度、收盘价、5 日主力净流入等关键指标
- **v0.5 新增模型组合元数据**：
  - `agent_models`：每个 Agent 的厂商/模型/信号/置信度/兜底状态快照
  - `combo_signature`：模型组合签名，用于横向对比不同组合的胜率
  - `fallback_count`：本次决策中触发兜底的 Agent 数量
- 看板可按股票名/代码/决策类型/日期范围检索
- 决策分布甜圈图 + 近 14 日活跃度柱图 + 高频研究股票 TOP + **模型组合健康度**

## 已安装核心依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| openai | 2.x | 统一 LLM SDK（base_url 适配 5 厂商） |
| openbb | 4.7.1 | 全球金融数据统一接口 |
| akshare | 1.18.60 | A 股/中国金融数据 |
| pandas | 3.0.3 | 数据分析 |
| numpy | 2.4.5 | 数值计算 |
| plotly | 6.7.0 | 交互式图表 |
| streamlit | 1.57.0 | Dashboard |
| fastapi | 0.128.8 | 后端 API |
| uvicorn | 0.40.0 | ASGI 服务器 |
| langchain | 1.3.1 | LLM 应用框架 |
| langgraph | 1.2.0 | 多 Agent 编排 |
| chromadb | 1.5.9 | 向量库 |
| mem0ai | 2.0.2 | Agent 记忆 |

## API 配置

`.env` 文件需提供以下 5 组凭证（可任选子集，未配置的厂商对应 Agent 会自动切到兜底）：

```bash
DEEPSEEK_API_KEY=...        # DeepSeek 官方
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
CLAUDE_API_KEY=...          # Claude 官方或第三方代理
CLAUDE_BASE_URL=https://...  # 自动追加 /v1
GPT_API_KEY=...
GPT_BASE_URL=https://...     # 自动追加 /v1
MIMO_API_KEY=...            # 小米 Mimo
MIMO_BASE_URL=https://...    # 自动追加 /v1
SENSENOVA_API_KEY=...       # 商汤日日新
SENSENOVA_BASE_URL=https://api.sensenova.cn/compatible-mode/v1
```

## 快速启动

### 启动看板
```bash
python -m streamlit run frontend/dashboard.py --server.port 8501 --server.headless true
```
访问 http://localhost:8501

### 端到端验证（5 Agent 异构 + 自动存档）
```bash
python -W ignore backend/test_archive_e2e.py
```

### 探测厂商真实可用模型
```bash
python backend/test_all_apis_v4.py
```

## 架构

```
[数据层] akshare(行情/资金/资讯) + OpenBB(备用)
    ↓
[分析层] 5 Agent 并行（5 厂商异构 LLM）
    ├─ 🏛️ 基本面 → Claude Sonnet 4.5
    ├─ 📐 技术 → GPT-5.2
    ├─ 💬 舆情 → DeepSeek Chat
    ├─ ⚠️ 风控 → SenseNova DeepSeek-V4-Flash
    └─ 🏪 散户 → Mimo v2.5-pro
              ↓ (任一厂商故障 → DeepSeek 兜底)
    🎩 主席 → Claude Opus 4.7（综合输出执行决议）
    ↓
[展示层] Streamlit + Plotly（7 Tab，含模型阵容透视）
    ↓
[沉淀层] 研究存档（Markdown + JSON 索引 + 模型组合元数据）
```

## 决策质量验证案例（贵州茅台 600519）

异构架构在以下数据汇聚下做出"分歧明显，建议 3 成试探仓"的执行决议：
- ✅ 产品涨价利好（基本面 Claude 看多）
- ✅ MA5 上穿 MA20，MACD 红柱（技术 GPT 看多）
- ⚠️ 近 5 日主力净流出 -44.61 亿（风控 SenseNova 看空）
- ⚠️ 散户净流入 + 主力流出（散户 Mimo 警示接盘风险）
- 🤔 舆情 DeepSeek：识别"机构借利好出货"

最终 5 Agent 投票：**1 买 / 0 卖 / 4 观**，主席 Claude Opus 输出含具体仓位（3 成试探）+ 止损（MA60 或 -7%）+ 加仓信号（突破 1750 + 主力回流）的执行决议，质量明显优于任一单模型方案。

## 版本演进

| 版本 | 日期 | 关键变更 |
|------|------|------|
| **v0.10.5** | **2026-05-17** | **行业/概念主题新闻主动搜索；快讯池 + 主题搜索合并去重；Agent/专家圆桌纳入关联概念动态** |
| v0.10.4 | 2026-05-17 | 反查股票所属概念板块，新增“关联概念”资讯区与 LLM 概念简报 |
| v0.10.3 | 2026-05-17 | 从经营范围抽取行业级关键词，提升宽泛行业小盘股新闻召回 |
| v0.10.2 | 2026-05-17 | 接入东财个股搜索 API，优先拉取按股票代码检索的专属新闻 |
| v0.10.1 | 2026-05-17 | 行业识别回退与主营产品关键词收窄，降低误匹配 |
| v0.10 | 2026-05-17 | 个股公告、行业新闻、主营业务进入 Agent 和专家圆桌简报 |
| v0.9 | 2026-05-17 | 审稿 Agent、分歧解释、测试脚手架 |
| v0.1 | 2026-05-16 | 基础环境 + akshare 数据层 |
| v0.2 | 2026-05-16 | 4 Agent + DeepSeek 单源推理 + Streamlit 看板 |
| v0.3 | 2026-05-16 | 接入新闻 + 研报 + 资金流向 |
| v0.4 | 2026-05-16 | 研究存档系统（索引 + 检索 + 可视化） |
| **v0.5** | **2026-05-16** | **5 厂商异构架构 + 散户 Agent + 模型组合元数据 + 双层兜底** |

## 空间占用

当前约 1.2 GB（含报告归档）。
