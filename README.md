# AI-Finance: Multi-Agent Financial Analysis Workbench

[![CI](https://github.com/TIANWEN-cpu/AI--FINANCE/actions/workflows/ci.yml/badge.svg)](https://github.com/TIANWEN-cpu/AI--FINANCE/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/python-3.11%20%7C%203.12-blue)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker)](https://github.com/TIANWEN-cpu/AI--FINANCE/blob/main/Dockerfile)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/TIANWEN-cpu/AI--FINANCE/blob/main/LICENSE)
[![Tests](https://img.shields.io/badge/tests-265%20passed-brightgreen)](https://github.com/TIANWEN-cpu/AI--FINANCE/tree/main/tests)

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
│  Provider Plugins (9 sources, auto-priority, failover)      │
│  CNInfo · SEC · HKEX · Tushare · CLS · OpenBB · AkShare    │
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
│  SQLite (6 tables, thread-safe) + ChromaDB (vector RAG)     │
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
│  Streamlit Dashboard (10 tabs) · Factor Panel · Source Health│
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Archive Layer                              │
│  Markdown reports + JSON index + model combination metadata  │
└─────────────────────────────────────────────────────────────┘
```

## Design Decisions

### Why a Provider plugin architecture?

Financial data sources are unreliable. APIs change, rate limits hit, services go down. The Provider pattern gives us:

- **Uniform interface** — every source returns `NewsItem`, `ResearchReport`, `Announcement`, etc. via Pydantic models. Downstream code never cares which source the data came from.
- **Priority-based routing** — CNInfo (official) beats AkShare (scraped) for announcements. Configured in `data_sources.yaml`, not hardcoded.
- **Graceful degradation** — when Tushare's API is down, the system falls back to AkShare automatically. No manual intervention.

### Why a Critic agent?

Without a critic, agents produce confident-sounding but occasionally hallucinated analysis. The Critic (v0.9) does what a human editor would:

- Scores each agent's output 0-100 on evidence quality
- Flags contradictions against the market brief
- Calls out overconfidence (high conviction + weak evidence)
- Generates a divergence explanation when agents disagree

This doesn't guarantee correctness, but it catches a class of errors that solo agents reliably miss.

### Why SQLite + ChromaDB?

- **SQLite** for structured data (news, reports, price bars). It's zero-config, handles concurrent reads well with our thread-safe locking, and the dataset is small enough that PostgreSQL would be overengineering.
- **ChromaDB** for semantic search over evidence. When an agent needs "all announcements mentioning supply chain disruption in the past 30 days," vector search finds matches that keyword search misses.

The two serve different query patterns. Trying to force both into one system would compromise both.

### Why Streamlit?

It's the fastest path from "Python function" to "interactive dashboard with charts." For a research prototype where the primary users are developers and analysts iterating on the analysis logic, Streamlit's tradeoff (limited UI customization, single-threaded model) is acceptable. A production system would likely need a proper frontend, but that's premature optimization at this stage.

### Why heterogeneous models?

Each model has a different strength:

| Model | Role | Why |
|-------|------|-----|
| Claude Sonnet 4.5 | Fundamentals | Deep reasoning, Chinese fluency |
| GPT-5.2 | Technicals | Pattern recognition on structured data |
| DeepSeek Chat | Sentiment | Native Chinese, cost-effective for high-volume text |
| SenseNova | Risk Control | Different reasoning engine — breaks correlation |
| Mimo | Retail Behavior | Provides a genuinely different perspective |

The key insight: **model diversity matters more than individual model quality**. A 5-model ensemble where 3 models are "good" and 2 are "okay" outperforms a single "excellent" model, because correlated failures cancel out.

### Why three analysis modes?

Not every analysis needs 5 agents + critic + chairman. The mode system (v0.13) lets users choose:

- **Standard** — 3 agents, DeepSeek only, fast and cheap. Good for screening.
- **Deep** — 5 heterogeneous agents + critic + chairman. Full analysis with evidence and factor injection.
- **Auto** — pre-screen with Standard, escalate to Deep only when confidence is ambiguous (30-70%).

This is a cost/speed/quality tradeoff, and the right answer depends on the use case.

## Data Quality

The pipeline has four quality gates:

1. **Deduplication** — fingerprint-based. Same article from two sources? Merged.
2. **Source ranking** — S/A/B/C/D trust levels. Official filings (CNInfo, SEC) rank higher than scraped news.
3. **Cross-source validation** — when the same event appears in multiple sources, confidence increases. When sources contradict, the system flags the conflict.
4. **Anomaly detection** — zero/negative prices, limit-up/down violations, garbled titles, duplicate timestamps.

No single gate is sufficient. The combination reduces noise without discarding legitimate edge-case signals.

## Agent Output Validation

Every agent output goes through `validators.py`:

- Signal normalization (buy/sell/hold, including Chinese aliases)
- Confidence clamping (0-100, with NaN/None handling)
- Evidence structuring (type + claim + source, max 10 items)
- Risk normalization (string → list)

The Critic then adds a second layer:

- Evidence coverage rate — did the agent actually use the available data?
- Factor consistency — does the agent's conclusion align with quantitative factors?
- Overconfidence detection — high conviction with weak evidence triggers a flag

Archived decisions include full model combination metadata (`agent_models`, `combo_signature`, `fallback_count`), enabling post-hoc analysis of which model combinations produce better outcomes.

## Agent Mode System

Three analysis modes with different cost/quality tradeoffs:

| Mode | Agents | Models | Use Case |
|------|--------|--------|----------|
| Standard | 3 | DeepSeek | Quick screening, high throughput |
| Deep | 5 + Critic + Chairman | Mixed (Claude/GPT/DeepSeek/SenseNova/Mimo) | Full research, evidence + factor injection |
| Auto | Pre-screen → Deep if ambiguous | Dynamic | Balanced cost/quality |

Model configuration is declarative (`config/models.yaml`) and supports hot-reload. No code changes needed to swap models.

## Quantitative Factors

The FactorGenerator computes 5 dimensions, all normalized to [-1, 1]:

| Factor | Source | Signal |
|--------|--------|--------|
| News Sentiment | NLP on headlines | Positive/negative tone |
| Event Signal | Rule-based extractor | Earnings surprise, M&A, litigation |
| Analyst Rating | Broker reports | Buy/hold/sell consensus |
| Fund Flow | Capital flow data | Main force vs. retail divergence |
| Price Momentum | Technical indicators | Trend strength |

These factors are injected into agent prompts and used by the Critic's 7th scoring dimension (factor consistency).

## Current Limitations

- **Chinese market focus** — A-share data coverage is deep; US/HK coverage is functional but thinner.
- **No real-time trading integration** — this is a research tool, not a trading system. Signals are for human review, not automated execution.
- **LLM cost** — Deep mode with 5 agents + critic can cost $0.50-2.00 per analysis. Standard mode brings this under $0.10.
- **Streamlit single-threaded model** — concurrent users share state. Fine for single-user research, problematic for team deployment.
- **No backtesting framework** — archived decisions enable manual post-hoc analysis, but there's no automated backtest pipeline yet.

## Next Steps

- [ ] Backtesting framework — automated P&L tracking against archived decisions
- [ ] US market deepening — 10-K/10-Q parsing, earnings call transcripts
- [ ] Real-time alerting — push notifications when factor scores cross thresholds
- [ ] Multi-user support — proper auth and workspace isolation
- [ ] Model fine-tuning — train a lightweight model on archived decision quality data

## Quick Start

```bash
# Install
pip install -r requirements.txt

# Configure API keys
cp .env.example .env
# Edit .env with your keys (at minimum DEEPSEEK_API_KEY)

# Run
python -m streamlit run frontend/dashboard.py --server.port 8501

# Or with Docker
docker-compose up -d
```

## Testing

```bash
# Run all tests (265 tests, ~4s)
python -m pytest tests/ -v

# Lint
ruff check backend/ frontend/ tests/
ruff format --check backend/ frontend/ tests/
```

## Project Structure

```
backend/
├── providers/          # 9 data source plugins (AkShare, SEC, HKEX, ...)
├── schemas/            # Pydantic data models (NewsItem, Announcement, ...)
├── quality/            # Dedup, source ranking, evidence aggregation, anomaly detection
├── storage/            # SQLite database (thread-safe)
├── ingestion/          # Scheduled data collection jobs
├── rag/                # ChromaDB vector store + retriever
├── events/             # Rule-based event extractor (8 event types)
├── factors/            # Quantitative factor generator (5 dimensions)
├── utils/              # Datetime parsing, tracing
├── llm_agents.py       # 5-agent orchestration + mode system
├── critic.py           # Quality scoring + divergence detection
├── expert_panel.py     # 5-persona roundtable discussion
└── pipeline.py         # End-to-end data pipeline

frontend/
├── dashboard.py        # Streamlit dashboard (10 tabs)
└── components/         # UI panels (fundamentals, chat, factors, ...)

config/
├── models.yaml         # LLM model configuration (hot-reload)
├── experts.yaml        # Expert persona definitions
└── data_sources.yaml   # Provider priority/timeout/retry config

tests/                  # 265 unit tests
```

## Version History

| Version | Date | Focus |
|---------|------|-------|
| v0.14 | 2026-05-19 | News optimization: datacenter API for concepts & industry, 1 request vs 50+ |
| v0.13.1 | 2026-05-19 | Dependency fixes, CI hardening, governance docs, README rewrite |
| v0.13 | 2026-05-19 | Agent modes, 7 new providers, evidence aggregation, CI |
| v0.12 | 2026-05-18 | Data pipeline, event extraction, quantitative factors |
| v0.11 | 2026-05-18 | Provider plugin architecture, data quality layer, RAG |
| v0.10 | 2026-05-17 | Topic search, concept matching, industry inference |
| v0.9 | 2026-05-17 | Critic agent, test scaffolding |
| v0.5 | 2026-05-16 | 5-model heterogeneous architecture |
| v0.1 | 2026-05-16 | Initial release |

## License

MIT
