# AI-Finance: Multi-Agent Financial Analysis Workbench

[![CI](https://github.com/TIANWEN-cpu/AI--FINANCE/actions/workflows/ci.yml/badge.svg)](https://github.com/TIANWEN-cpu/AI--FINANCE/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/python-3.11%20%7C%203.12-blue)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker)](https://github.com/TIANWEN-cpu/AI--FINANCE/blob/main/Dockerfile)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/TIANWEN-cpu/AI--FINANCE/blob/main/LICENSE)
[![Tests](https://img.shields.io/badge/tests-376%20passed-brightgreen)](https://github.com/TIANWEN-cpu/AI--FINANCE/tree/main/tests)
[![Release](https://img.shields.io/badge/release-v0.40.8-blue)](https://github.com/TIANWEN-cpu/AI--FINANCE/releases/tag/v0.40.8)

A production-grade engineering workbench that orchestrates heterogeneous LLM agents to analyze Chinese and global equities. Built to answer a specific question: **can a multi-model ensemble produce investment research that's more reliable than any single model?**

## The Problem

Single-LLM financial analysis has three failure modes:

1. **Homogeneous bias** — the same model family produces correlated errors. When GPT misreads a sentiment signal, Claude often misreads it the same way.
2. **No self-correction** — a solo agent has no mechanism to challenge its own conclusions.
3. **Opaque reasoning** — users see a final verdict but can't trace which data points drove it, making it impossible to calibrate trust.

This project tackles all three through architectural choices: heterogeneous models, a critic layer, and evidence-driven output.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                               │
│  Provider Plugins (20+ sources, auto-discovery, failover)   │
│  CNInfo · SEC · HKEX · Tushare · CLS · OpenBB · AkShare    │
│  + Finnhub · FRED · Reddit · Custom (user-extensible)       │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Quality Layer                              │
│  Deduplicator (fingerprint) + SourceRanker (S/A/B/C/D)      │
│  Evidence Aggregator (cross-source validation)               │
│  Anomaly Detector (price spikes, garbled text, dupes)       │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Storage Layer                              │
│  SQLite (20+ tables, thread-safe) + ChromaDB (optional RAG) │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Analysis Layer                             │
│  5 Heterogeneous Agents (parallel) → Critic → Chairman      │
│                                                             │
│  Fundamentals (Claude)  ·  Technicals (GPT)                 │
│  Sentiment (DeepSeek)   ·  Risk Control (SenseNova)         │
│  Retail Behavior (Mimo)                                     │
│                                                             │
│  Any agent failure → automatic DeepSeek fallback            │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Presentation Layer                         │
│  Streamlit Dashboard (10 tabs) · FastAPI (25+ endpoints)    │
│  Next.js Frontend (skeleton)                                │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Archive Layer                              │
│  Markdown reports + JSON index + model combination metadata  │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Python 3.11 or 3.12
- At least one LLM API key (DeepSeek recommended for starting)

### Windows

```bash
git clone https://github.com/TIANWEN-cpu/AI--FINANCE.git
cd AI--FINANCE
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys (at minimum DEEPSEEK_API_KEY)
python -m streamlit run frontend/dashboard.py --server.port 8501
```

### Linux / macOS

```bash
git clone https://github.com/TIANWEN-cpu/AI--FINANCE.git
cd AI--FINANCE
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
python -m streamlit run frontend/dashboard.py --server.port 8501
```

### Docker

```bash
git clone https://github.com/TIANWEN-cpu/AI--FINANCE.git
cd AI--FINANCE
cp .env.example .env
# Edit .env with your API keys
docker-compose up -d
# Streamlit: http://localhost:8501
# FastAPI:   http://localhost:8000
# Next.js:   http://localhost:3000
```

### FastAPI Backend (optional)

```bash
pip install -r requirements-api.txt
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
# API docs at http://localhost:8000/docs
```

### Windows .exe Installer (optional)

```bash
pip install pyinstaller
python build.py
# Output: dist/AI-Finance/AI-Finance.exe
# For installer: open installer/setup.iss with Inno Setup
```

## Dependency Management

Dependencies are split into layers. Install only what you need:

| File | Purpose | Contains |
|------|---------|----------|
| `requirements-core.txt` | Core runtime | Streamlit, pandas, akshare, openai, pydantic, etc. |
| `requirements-api.txt` | FastAPI backend | fastapi, uvicorn (+ core) |
| `requirements-rag.txt` | RAG/vector search | chromadb (optional, needs C++ Build Tools on Windows) |
| `requirements-dev.txt` | Development | pytest, ruff (+ core) |
| `requirements.txt` | Default install | core + api + dev (excludes RAG) |

```bash
pip install -r requirements.txt           # Default: core + API + dev
pip install -r requirements-core.txt      # Core only
pip install -r requirements-rag.txt       # Add RAG support
pip install -r requirements.txt -r requirements-rag.txt  # Everything
```

## API Endpoints

The FastAPI backend exposes 25+ endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/chat/stream` | POST | SSE streaming chat |
| `/api/analysis/run` | POST | Run agent analysis |
| `/api/vision/analyze` | POST | Image/K-line chart analysis |
| `/api/agents` | GET | List agent configurations |
| `/api/teams` | GET | List expert teams |
| `/api/models/providers` | GET | List model providers |
| `/api/reports/{id}` | GET | Get analysis report |
| `/api/files/upload` | POST | File upload |
| `/api/templates` | GET | Research task templates |
| `/api/costs` | GET | LLM cost statistics |
| `/api/backtest/stats` | GET | Backtest performance |

Full API documentation available at `http://localhost:8000/docs` when the API server is running.

## Design Decisions

### Why a Provider plugin architecture?

Financial data sources are unreliable. APIs change, rate limits hit, services go down. The Provider pattern gives us:

- **Uniform interface** — every source returns `NewsItem`, `ResearchReport`, `Announcement`, etc. via Pydantic models.
- **Priority-based routing** — CNInfo (official) beats AkShare (scraped) for announcements.
- **Graceful degradation** — when Tushare's API is down, the system falls back to AkShare automatically.
- **Extensible** — drop a Python file in `custom_providers/` and it's auto-discovered.

### Adding Custom Data Sources

```bash
python scripts/create_provider.py --name my_source --markets CN --types news --custom
# Implement data fetching in custom_providers/my_source.py
# Configure in config/data_sources.yaml
```

### Why a Critic agent?

Without a critic, agents produce confident-sounding but occasionally hallucinated analysis. The Critic scores each agent's output 0-100 on evidence quality, flags contradictions, and calls out overconfidence.

### Why heterogeneous models?

| Model | Role | Why |
|-------|------|-----|
| Claude Sonnet 4.5 | Fundamentals | Deep reasoning, Chinese fluency |
| GPT-5.2 | Technicals | Pattern recognition on structured data |
| DeepSeek Chat | Sentiment | Native Chinese, cost-effective |
| SenseNova | Risk Control | Different reasoning engine |
| Mimo | Retail Behavior | Genuinely different perspective |

**Model diversity matters more than individual model quality.** A 5-model ensemble outperforms a single "excellent" model because correlated failures cancel out.

### Why three analysis modes?

| Mode | Agents | Models | Use Case |
|------|--------|--------|----------|
| Standard | 3 | DeepSeek | Quick screening, high throughput |
| Deep | 5 + Critic + Chairman | Mixed | Full research with evidence |
| Auto | Pre-screen → Deep if ambiguous | Dynamic | Balanced cost/quality |

## Testing

```bash
# Run all tests (376 tests, ~6s)
python -m pytest tests/ -v

# Lint
ruff check backend/ frontend/ tests/
ruff format --check backend/ frontend/ tests/

# Or use Make
make test
make lint
make check    # lint + test
```

## Project Structure

```
backend/
├── agents/             # Agent layer
│   ├── base.py         # Agent config, prompts, model mapping
│   ├── financial_agents.py  # Agent execution
│   ├── chairman.py     # Chairman synthesis agent
│   └── validators.py   # Output schema validation
├── models/             # Model layer
│   └── provider_gateway.py  # LLM provider config, unified call
├── runtime/            # Runtime layer
│   ├── context_builder.py   # Market brief, evidence context
│   └── orchestrator.py      # Mode-aware orchestration
├── teams/              # Teams layer
│   └── team_loader.py  # Expert team YAML config loader
├── vision/             # Vision layer
│   ├── image_loader.py      # Image loading
│   ├── chart_detector.py    # Chart type detection
│   ├── kline_interpreter.py # K-line analysis
│   └── vision_agent.py      # Vision pipeline
├── api/                # FastAPI backend
│   └── main.py         # 25+ REST endpoints
├── security/           # Key vault, masking
├── ai_assistant/       # Chat orchestrator, compliance, reports
├── providers/          # 17+ data source plugins
├── quality/            # Dedup, source ranking
├── storage/            # SQLite database (20+ tables)
├── rag/                # ChromaDB vector store (optional)
├── factors/            # Quantitative factor generator
├── observability/      # Tracing, cost tracking
├── llm_agents.py       # Backward-compatible facade
├── critic.py           # Quality scoring
├── expert_panel.py     # Expert roundtable
└── pipeline.py         # End-to-end data pipeline

frontend/
├── dashboard.py        # Streamlit dashboard (10 tabs)
└── components/         # UI panels

apps/web/               # Next.js frontend (standalone Docker build)
config/                 # YAML configs (models, experts, data sources)
prompts/                # Expert/team/vision prompts
tests/                  # 312 unit tests
```

## Version History

| Version | Date | Focus |
|---------|------|-------|
| v0.40.8 | 2026-05-20 | Smoke/SSE contract/degradation tests, contract docs, 376 tests |
| v0.40.7 | 2026-05-20 | M8 Acceptance hardening: Docker Compose web service, docs update, 359 tests |
| v0.40.6 | 2026-05-20 | M7 Integration testing: 359 tests, upload endpoint verification |
| v0.40.5 | 2026-05-20 | M6 Next.js frontend: component decomposition, SSE streaming, useChat hook |
| v0.40.4 | 2026-05-20 | M5 Vision: orchestrator integration, KlineAnalysisData, ticker parameter |
| v0.40.3 | 2026-05-20 | M4 Data sources: DataSourceResult, provider health tracking, evidence context |
| v0.40.2 | 2026-05-20 | M3 Agent standardization: Pydantic schemas, team_loader fix, 10-expert team |
| v0.40.1 | 2026-05-20 | M2 FastAPI: ApiResponse wrapper, 25+ schemas, global error handling |
| v0.40 | 2026-05-20 | M1 Engineering: split requirements, pyproject.toml, ChromaDB optional |
| v0.38 | 2026-05-21 | Windows .exe packaging (PyInstaller + Inno Setup) |
| v0.36 | 2026-05-21 | Async task queue, React/Next.js frontend skeleton |
| v0.34 | 2026-05-21 | Database schema upgrade (20+ tables), model registry |
| v0.32 | 2026-05-21 | Observability tracing, document pipeline, plugin system |
| v0.30 | 2026-05-21 | Tool calling framework, hybrid RAG, scheduled monitoring |
| v0.28 | 2026-05-21 | Vision cross-validation, cost tracker, 5 debate modes |
| v0.26 | 2026-05-20 | Storage abstraction, cost tracking, JSONL logging |
| v0.24 | 2026-05-20 | FastAPI service layer (25+ endpoints, SSE streaming) |
| v0.22 | 2026-05-20 | Vision pipeline: K-line chart upload, 5th analysis mode |
| v0.20 | 2026-05-20 | Configuration UI: Model Provider Manager, Agent Studio |
| v0.18 | 2026-05-20 | Architecture restructure: modular backend decomposition |
| v0.16 | 2026-05-20 | AI assistant page: multi-mode chat, report export |
| v0.15 | 2026-05-20 | Extensible provider plugin system |
| v0.14 | 2026-05-19 | News overhaul: datacenter API, concept sorting |
| v0.13 | 2026-05-19 | Agent modes, 7 new providers, CI |
| v0.12 | 2026-05-18 | Data pipeline, event extraction, factors |
| v0.11 | 2026-05-18 | Provider plugin architecture, RAG |
| v0.10 | 2026-05-17 | Topic search, concept matching |
| v0.9 | 2026-05-17 | Critic agent, test scaffolding |
| v0.5 | 2026-05-16 | 5-model heterogeneous architecture |
| v0.1 | 2026-05-16 | Initial release |

## Documentation

- [Architecture](docs/architecture.md) — 系统架构与数据流
- [API Reference](docs/api.md) — 27 个 REST 端点文档
- [API Contract](docs/contract.md) — 前后端契约（ApiResponse/SSE/Upload 格式）
- [Deployment](docs/deployment.md) — 部署指南（本地/Docker/Windows）
- [Agent Design](docs/agent-design.md) — Agent 与专家团设计
- [Security](docs/security.md) — 安全措施与合规

## License

MIT
