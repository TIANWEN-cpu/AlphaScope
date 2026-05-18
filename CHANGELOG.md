# Changelog

## v0.12.0 - 2026-05-18

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

### Evidence-Driven Agent Output
- Added `fetch_evidence_context()` in `llm_agents.py` — retrieves RAG evidence and formats it for agent prompts.
- `build_market_brief()` now accepts optional `evidence_context` parameter to include data platform evidence.
- `run_all_agents()` automatically fetches evidence context before building the market brief.
- Updated `critic.md` with 6th scoring dimension: evidence coverage rate.
- `build_critic_prompt()` now accepts `available_evidence` parameter for evidence coverage assessment.

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
