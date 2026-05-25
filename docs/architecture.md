# Architecture (v0.40)

This document describes the system architecture and data flow of AI-Finance.

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                 Presentation Layer                        │
│  Streamlit Dashboard · FastAPI (27 endpoints) · Vite UI  │
└───────────────────────────┬─────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Analysis Layer                           │
│  5 Agents → Critic → Chairman · Expert Panel (10 experts)│
│  Intent Router · Vision Pipeline · Compliance Checker    │
└───────────────────────────┬─────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Quality Layer                           │
│  Dedup · SourceRank · Evidence Aggregator · Anomaly Det  │
└───────────────────────────┬─────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Data & Storage Layer                         │
│  20+ Providers · SQLite (20+ tables) · ChromaDB (opt.)  │
│  Pipeline · Context Builder · Model Registry · Task Queue│
└─────────────────────────────────────────────────────────┘
```

Each layer is independently testable and replaceable.

## Layer Details

### 1. Provider Layer (`backend/providers/`)

20+ data source plugins behind a unified `BaseProvider` interface:

| Provider | Market | Data Type | Trust Level |
|----------|--------|-----------|-------------|
| CNInfo | CN | Announcements | S |
| SEC EDGAR | US | Filings | S |
| HKEXnews | HK | Announcements | S |
| Tushare Pro | CN | Reports, prices | A |
| CLS | CN | News flash | A |
| OpenBB | Global | Prices, fundamentals | A |
| EastMoney | CN | News, reports | B |
| AkShare | CN | All-round | B |
| BaoStock | CN | Price fallback | C |
| Finnhub | US | News, prices | B |
| FRED | Global | Macro data | A |
| Northbound | CN | Fund flow | B |
| Reddit | US | Sentiment | C |
| Google Trends | Global | Sentiment | C |

`ProviderRegistry` handles auto-discovery, priority routing, and failover. Configuration lives in `config/data_sources.yaml`.

Each provider tracks health status (HEALTHY/DEGRADED/UNHEALTHY) via `_record_success()`/`_record_failure()`. Health status available at `GET /api/providers/health`.

### 2. Quality Layer (`backend/quality/`)

Four independent quality gates:

- **Deduplicator** — content fingerprinting. Same article from two sources? Merged.
- **SourceRanker** — trust-level scoring (S/A/B/C/D) from config.
- **EvidenceAggregator** — cross-source validation. Multi-source agreement boosts confidence; contradictions are flagged.
- **AnomalyDetector** — zero/negative prices, limit violations, garbled text, duplicate timestamps.

### 3. Storage Layer (`backend/storage/`)

- **SQLite** — 6 core tables: `news_items`, `research_reports`, `announcements`, `price_bars`, `source_fetch_logs`, `evidence_items`. All write operations are thread-safe (mutex-locked).
- **ChromaDB** — vector store for semantic search over evidence. Used by the RAG retriever.

### 4. Ingestion Layer (`backend/ingestion/`)

`DataScheduler` runs configurable fetch jobs:

| Job | Interval | Source |
|-----|----------|--------|
| CN News | 5 min | CLS, AkShare |
| CN Reports | 1 hr | Tushare, EastMoney |
| CN Announcements | 1 hr | CNInfo, AkShare |
| Market Snapshot | 1 hr | AkShare |
| CN Prices | Daily | AkShare, BaoStock |
| US SEC Filings | 15 min | SEC EDGAR |

### 5. Analysis Layer (`backend/llm_agents.py`)

Three analysis modes:

**Standard Mode** — 3 agents, DeepSeek only:
1. Fundamentals Analyst
2. Technical Analyst
3. Sentiment Analyst

**Deep Mode** — 5 heterogeneous agents + Critic + Chairman:
1. Fundamentals (Claude Sonnet 4.5)
2. Technicals (GPT-5.2)
3. Sentiment (DeepSeek Chat)
4. Risk Control (SenseNova)
5. Retail Behavior (Mimo v2.5-pro)
6. Critic — scores all outputs, flags contradictions
7. Chairman (Claude Opus 4.7) — produces final executive decision

**Auto Mode** — pre-screen with Standard, escalate to Deep if confidence is ambiguous (30-70%).

All agents have automatic DeepSeek fallback on provider failure.

### 6. Vision Pipeline (`backend/vision/`)

Image/K-line chart analysis with real data cross-validation:

1. `detect_chart()` — LLM-based chart type detection (kline/line/bar/table)
2. `interpret_kline()` — LLM extracts trend, support/resistance, patterns
3. `_fetch_real_price_data()` — fetches actual OHLCV from providers
4. `_compare_vision_with_real_data()` — cross-validates vision vs reality

User can provide ticker to skip detection follow-up. Results include `KlineAnalysisData` and `RealDataComparison` schemas.

### 7. Evidence & Factor Injection

Before agents analyze, the system automatically:

1. Retrieves relevant evidence from ChromaDB via RAG
2. Computes 5 quantitative factors (sentiment, events, ratings, fund flow, momentum)
3. Injects both into the market brief

This grounds agent reasoning in actual data, not just the model's training knowledge.

### 8. Critic Layer (`backend/critic.py`)

The Critic evaluates each agent's output on 7 dimensions:

1. Evidence quality
2. Logical consistency
3. Contradiction detection
4. Missing evidence identification
5. Overconfidence flagging
6. Evidence coverage rate
7. Factor consistency

Output: per-agent scores (0-100), divergence explanation, and aggregate quality metrics.

### 8. Presentation Layer (`frontend/dashboard.py`)

Streamlit dashboard with 10 tabs:

1. K-line & Technical Indicators
2. Agent Analysis (mode selector + model lineup)
3. News & Reports
4. Fund Flow
5. Data Details
6. Fundamentals
7. Research Archive
8. Expert Roundtable
9. Factor Analysis
10. Source Health

### 9. Archive Layer (`backend/archive.py`)

Every deep analysis is automatically archived:

```
reports/archive/{symbol}/{timestamp}-{stock_name}.md
reports/archive/index.json
```

Archive metadata includes:
- Decision (buy/sell/hold)
- Confidence score
- Agent model combination snapshot
- Fallback count
- Critic quality metrics

This enables post-hoc analysis of which model combinations produce better outcomes.

## Data Flow Example

```
User selects stock 600519 (Kweichow Moutai)
    ↓
Pipeline fetches: news (CLS + AkShare), announcements (CNInfo),
  reports (Tushare), prices (AkShare), fund flow (AkShare)
    ↓
Quality layer: dedup → rank → cross-validate → anomaly check
    ↓
Storage: SQLite (structured) + ChromaDB (indexed)
    ↓
RAG retrieves relevant evidence for 600519
    ↓
Factor generator computes 5-dimensional scores
    ↓
5 agents analyze in parallel (injected with evidence + factors)
    ↓
Critic scores all outputs, flags issues
    ↓
Chairman synthesizes executive decision
    ↓
Dashboard displays results + auto-archives to reports/
```

## Thread Safety

All shared state uses double-checked locking:

- `Database` singleton — mutex on all write operations
- `VectorStore` singleton — mutex on collection operations
- `DataPipeline` singleton — mutex on ingestion operations

This is necessary because Streamlit runs each page load in a separate thread.

## Configuration

| File | Purpose | Hot-reload |
|------|---------|------------|
| `config/models.yaml` | LLM model assignments per agent | Yes |
| `config/data_sources.yaml` | Provider priority, timeout, retry | Yes |
| `config/experts.yaml` | Expert persona definitions | No |
| `.env` | API keys and base URLs | No |
