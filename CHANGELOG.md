# Changelog

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

- 新增 `AI-Finance-Setup.bat` 一键安装启动器
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
