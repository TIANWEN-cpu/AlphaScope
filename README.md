# AI-Finance｜面向中国投资者的 AI 投研工作台

[![CI](https://github.com/TIANWEN-cpu/AI--FINANCE/actions/workflows/ci.yml/badge.svg)](https://github.com/TIANWEN-cpu/AI--FINANCE/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/python-3.11%20%7C%203.12-blue)](https://www.python.org/)
[![Frontend](https://img.shields.io/badge/frontend-Vite%20%2B%20React%2019-646CFF)](apps/web/package.json)
[![FastAPI](https://img.shields.io/badge/FastAPI-113%20APIs-009688)](docs/api.md)
[![Tests](https://img.shields.io/badge/tests-802%20passed-brightgreen)](tests)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Release](https://img.shields.io/badge/release-v1.4.0-blue)](https://github.com/TIANWEN-cpu/AI--FINANCE/releases)

AI-Finance 是一个专为 **A 股、港股、基金、定投和中文投研场景** 打造的本地化 AI 金融研究平台。它不是简单的聊天机器人，而是把行情、新闻、公告、K 线、多 Agent 分析、证据链、研究报告、量化回测和基金组合管理整合到一个可运行、可验证、可扩展的投研工作台中。

> 重要说明：本项目用于研究、学习和辅助分析，不构成任何投资建议。所有输出都应结合真实数据源、个人风险偏好和专业判断独立核验。

## 为什么适合中国用户

### 1. 聚焦中文金融语境

- 支持 A 股代码、中文股票名、公告、新闻、资金流、技术指标、基金和定投等高频中文投研场景。
- 前端交互、状态提示和错误说明均以中文为主，适合国内用户直接使用。
- Provider 架构覆盖 CNInfo、AkShare、Tushare、财联社、HKEX、SEC、FRED 等数据源，既能做本土市场研究，也能扩展到港股和全球宏观数据。

### 2. 多 Agent 协同，而不是单模型拍脑袋

单一大模型容易出现同质化偏差、过度自信和证据不可追踪。AI-Finance 采用多角色协同：

- 基本面 Agent：关注估值、盈利质量、现金流和财务结构。
- 技术面 Agent：关注 K 线、均线、MACD、RSI、支撑压力等量价信号。
- 舆情 Agent：关注新闻、公告、事件和市场情绪。
- 风控 Agent：关注波动、回撤、集中度、异常数据和风险边界。
- Critic/Chairman 层：检查证据质量、矛盾点和过度自信，降低单模型幻觉风险。

### 3. 证据链优先，减少“黑盒结论”

平台强调可追溯研究流程：

- 每条分析尽量关联数据来源、新闻、公告、行情或指标。
- 报告生成会显示后端数据源成功、失败、为空的真实状态。
- 资讯、日历、演示样本和未接入能力都会明确标注，不把本地模板包装成真实 AI 结论。

### 4. 本地可控，密钥安全

- 支持本地运行 FastAPI + Vite React 前端，敏感配置保存在本机。
- Provider API Key 由后端加密保存，前端只显示脱敏占位，不回显明文。
- 保存 Provider 配置时不会在响应中返回 plaintext `api_key`。
- 日志和错误信息经过脱敏处理，适合个人研究和团队内网部署。

### 5. 工程化程度高，可二次开发

- FastAPI 后端提供 113 个接口，覆盖聊天、SSE、行情、新闻、公告、报告、Agent、设置、量化、基金等模块。
- Vite + React 19 前端工作台包含对话式研究、多 Agent 网络、组合风控、数据源聚合、K 线多模态、报告生成、证据链、量化回测、基金定投等视图。
- 测试体系覆盖后端契约、SSE、设置安全、运行时编排、数据处理等关键路径，当前验证状态为 `802 passed, 2 skipped`。

## v1.4.0 重点更新

v1.4.0 聚焦“前端真实可用”和“状态诚实可见”，修复了一批此前容易让用户误解或交互无响应的问题。

### 新版前端工作台

- 从旧前端迁移到 Vite React 工作台，启动更快，交互更顺滑。
- 顶部股票搜索会同步更新工作台、K 线、新闻、报告、组合、回测等相关模块。
- 股票代码纯数字搜索不会再混用上一个股票名称。
- K 线页默认展示当前标的相关视图，演示样本与当前标的明确分离。

### 对话式研究与 SSE 契约修复

- `/api/chat/stream` SSE 状态事件携带 `conversation_id`。
- Orchestrator 异常时返回 JSON 500，不再伪装成成功 SSE。
- 未显式选择模式时不强行覆盖自动路由，保留后端智能调度能力。
- 前端能正确显示流式错误、状态和 Agent 输出。

### 设置中心安全修复

- Provider 增删改查、连接测试、模型列表拉取接入真实后端。
- API Key 不回显明文，保存接口响应也不会泄露密钥。
- 空 API Key 更新不会误清空已保存密钥。
- 未接入的设置页签明确显示“暂未开放”，不伪装成企业版能力。

### 多 Agent 管理闭环

- 前端启用/禁用 Agent 会持久化到 `/api/manage/agents`。
- 后端运行时会读取托管 Agent 配置。
- Standard、Deep、Auto 模式都会排除已禁用 Agent，避免前端配置和实际执行不一致。

### 新闻、报告、回测、基金模块更真实

- 新闻聚合不再把本地样本当作真实后端数据；新闻、公告、详情、搜索失败都会显示明确状态。
- 市场 ticker 和财经日历中的静态内容会标注为演示或参考。
- 报告生成会显示数据源成功、失败和为空状态；数据不足时不会生成伪完整报告。
- 回测区分“本地演示曲线”和“后端完成结果”，策略参数会真实传给后端。
- 基金定投的本地模板、规则和沙盒能力都有清晰标注，不冒充后端 AI。

## 功能总览

| 模块 | 能力 |
|------|------|
| 对话式研究 | 支持标准、深度、自动模式；SSE 流式输出；多 Agent 协同分析 |
| 股票工作台 | 行情、新闻、资金流、因子、基本面、图表和研究摘要聚合 |
| 多 Agent 网络 | Agent 配置查看、启用/禁用、运行时托管配置同步 |
| 数据源终端 | 新闻、公告、事件、市场参考 ticker、财经日历状态展示 |
| K 线/多模态 | K 线、均线、成交量、MACD/RSI、图片上传诊断 |
| 研究报告 | 按数据源质量生成报告，显示证据和缺失项 |
| 证据链 | 追踪新闻、公告、行情、报告和 Agent 输出来源 |
| 组合与风控 | 基金组合、持仓、风险指标、再平衡接口 |
| 量化回测 | 策略列表、参数配置、回测执行、运行记录 |
| 基金定投 | 基金搜索、净值、指标、定投模拟、计划管理 |
| 设置中心 | Provider 管理、API Key 加密保存、连接测试、模型列表 |

## 系统架构

```text
┌─────────────────────────────────────────────────────────────┐
│ 数据层                                                       │
│ CNInfo / AkShare / Tushare / CLS / HKEX / SEC / FRED / 自定义 │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 质量层                                                       │
│ 去重、来源评级、证据聚合、异常数据检测、跨源校验              │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 存储层                                                       │
│ SQLite、报告归档、运行记录、设置存储、可选 ChromaDB RAG       │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 分析层                                                       │
│ 多 Agent 并行分析 → Critic 质检 → Chairman 汇总               │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 服务层                                                       │
│ FastAPI、SSE、任务队列、Provider 管理、量化/基金/报告 API     │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 展示层                                                       │
│ Vite React 主前端、Streamlit 调试台、Docker/Windows 本地运行  │
└─────────────────────────────────────────────────────────────┘
```

## 快速开始

### 环境要求

- Python 3.11 或 3.12
- Node.js 20+
- 至少一个可用的大模型 API Key，建议先配置 DeepSeek
- Windows、Linux、macOS 均可运行；Windows 用户可优先使用脚本启动

### 1. 克隆项目

```bash
git clone https://github.com/TIANWEN-cpu/AI--FINANCE.git
cd AI--FINANCE
```

### 2. 安装后端依赖

```bash
pip install -r requirements.txt
cp .env.example .env
```

然后编辑 `.env`，填入自己的模型和数据源 Key。至少建议配置：

```env
DEEPSEEK_API_KEY=你的密钥
```

### 3. 启动 FastAPI 后端

```bash
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
```

启动后可访问：

- 健康检查：`http://localhost:8000/health`
- API 文档：`http://localhost:8000/docs`

### 4. 启动 Vite React 前端

```bash
cd apps/web
npm install
npm run dev
```

默认访问：`http://localhost:3000`

### 5. Windows 一键启动

```bash
scripts\start_local.bat
```

### 6. Docker 启动

```bash
cp .env.example .env
docker-compose up -d
```

默认服务：

- FastAPI：`http://localhost:8000`
- Vite 前端：`http://localhost:3000`
- Streamlit 调试台：`http://localhost:8501`

## 依赖分层

| 文件 | 用途 |
|------|------|
| `requirements-core.txt` | 核心运行依赖：Streamlit、pandas、akshare、openai、pydantic 等 |
| `requirements-api.txt` | FastAPI 服务依赖 |
| `requirements-rag.txt` | 可选 RAG / ChromaDB 依赖 |
| `requirements-dev.txt` | 测试、格式化、开发工具 |
| `requirements.txt` | 默认安装：core + api + dev，不包含可选 RAG |

```bash
pip install -r requirements.txt
pip install -r requirements-rag.txt  # 如需向量检索能力再安装
```

## 常用开发命令

### 后端测试和格式化

```bash
python -m pytest tests/ -v
ruff check backend frontend tests
ruff format --check backend frontend tests
```

### 前端类型检查和构建

```bash
npm --prefix "apps/web" run lint
npm --prefix "apps/web" run build
```

> 前端 lint 使用 TypeScript `tsc --noEmit`；不要用 Ruff 检查 `.ts` / `.tsx` 文件。

## API 能力概览

FastAPI 后端提供 113 个接口，主要包括：

| 能力 | 代表接口 |
|------|----------|
| 健康检查 | `GET /health` |
| SSE 对话 | `POST /api/chat/stream` |
| 分析任务 | `POST /api/analysis/run`, `POST /api/analysis/async` |
| 多模态分析 | `POST /api/vision/analyze` |
| Agent 管理 | `GET /api/agents`, `GET/POST /api/manage/agents` |
| Provider 设置 | `GET/POST /api/settings/providers`, `POST /api/settings/providers/{id}/test` |
| 行情数据 | `GET /api/prices/{symbol}/latest`, `POST /api/prices/{symbol}/fetch` |
| 新闻公告 | `GET /api/news`, `GET /api/news/announcements`, `GET /api/news/{id}` |
| 报告归档 | `GET /api/archive`, `GET /api/archive/{path}` |
| 量化回测 | `GET /api/quant/strategies`, `POST /api/quant/backtest`, `GET /api/quant/runs` |
| 基金研究 | `GET /api/funds/search`, `GET /api/funds/{code}/nav`, `POST /api/fund-dca/simulate` |
| 组合管理 | `GET/POST /api/fund-portfolio`, `POST /api/fund-portfolio/rebalance` |

完整接口请启动服务后查看 `http://localhost:8000/docs`。

## 项目结构

```text
backend/                # FastAPI 后端
├── api/                # REST / SSE 接口
├── runtime/            # 多 Agent 编排与模式路由
├── providers/          # 数据源插件
├── agents/             # Agent 定义与提示词
├── funds/              # 基金、定投、组合逻辑
├── vision/             # 图片和 K 线分析
├── storage/            # SQLite 存储
├── security/           # 密钥加密、脱敏和安全工具
└── settings_store.py   # Provider 设置持久化

apps/web/               # Vite React 主前端
frontend/               # Streamlit 调试台
config/                 # YAML 配置
prompts/                # 提示词模板
scripts/                # 启动、迁移、检查脚本
tests/                  # 后端测试与契约测试
docs/                   # 架构、API、部署和用户文档
data/                   # 本地运行数据，默认 gitignore
```

## 版本历史

| 版本 | 日期 | 重点 |
|------|------|------|
| v1.4.0 | 2026-05-25 | Vite React 工作台、股票搜索联动、SSE 契约修复、Provider 密钥安全、多 Agent 托管配置、新闻/报告/回测真实状态标注 |
| v1.3 | 2026-05-23 | 量化回测适配、基金/定投/组合模块、ToolRouter 10 工具、113 API、793 tests |
| v1.2 | 2026-05-23 | 前端功能补全：Settings CRUD、Expert 圆桌、TaskCenter、成本统计、模型自动拉取 |
| v1.1 | 2026-05-22 | 前端重构：深色工作台、K 线 SVG、资讯/财务/资金流/因子、SSE AI 面板 |
| v1.0.1 | 2026-05-22 | 性能优化与安全加固：缓存、并行 provider、日志脱敏、error boundary |
| v1.0 | 2026-05-21 | Local 正式版：一键启动、主工作台、专家团、K 线、报告、备份、697 tests |

## 已知边界

- 本项目是投研辅助工具，不提供确定性买卖建议。
- 部分宏观日历、市场参考 ticker、模板问答属于演示或参考内容，界面会明确标注。
- 部分外部数据源需要用户自行申请 Key，并受第三方接口稳定性、频率限制和数据授权影响。
- DCA 计划等个别模块仍有后续持久化增强空间。
- 建议发布前根据实际接入的数据源做一次端到端手测。

## 文档

- [本地快速开始](docs/local-quickstart.md)
- [用户手册](docs/user-manual/README.md)
- [系统架构](docs/architecture.md)
- [API 文档](docs/api.md)
- [前后端契约](docs/contract.md)
- [部署指南](docs/deployment.md)
- [Agent 设计](docs/agent-design.md)
- [安全说明](docs/security.md)

## License

MIT
