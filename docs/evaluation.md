# Evaluation

How we assess the quality of AI-Finance's analysis output.

## Current Test Coverage

- **265 unit tests** across 15 test files
- Coverage: validators, critic, archive, datetime utils, tracing, data pipeline, dedup, source ranking, database, scheduler, providers (SEC, HKEX), factors, agent modes, schema models
- All tests pass on Python 3.11 and 3.12

```bash
python -m pytest tests/ -v
# 265 passed in ~4s
```

## What We Measure

### 1. Agent Output Quality

The Critic scores each agent on a 0-100 scale across 7 dimensions:

| Dimension | What It Measures |
|-----------|-----------------|
| Evidence quality | Are claims backed by actual data? |
| Logical consistency | Does the conclusion follow from the evidence? |
| Contradiction detection | Does the output contradict the market brief? |
| Missing evidence | Did the agent ignore relevant data? |
| Overconfidence | High conviction + weak evidence? |
| Evidence coverage | What fraction of available evidence was used? |
| Factor consistency | Does the conclusion align with quantitative factors? |

Archived decisions include these scores, enabling longitudinal analysis.

### 2. Model Combination Performance

Each archived decision stores the full model combination snapshot:

```json
{
  "agent_models": {
    "fundamentals": {"vendor": "claude", "model": "claude-sonnet-4-5", "signal": "buy", "confidence": 75},
    "technicals": {"vendor": "gpt", "model": "gpt-5.2", "signal": "hold", "confidence": 60},
    ...
  },
  "combo_signature": "claude-sonnet-4-5|gpt-5.2|deepseek-chat|...",
  "fallback_count": 0
}
```

This enables queries like: "What's the win rate when Claude + GPT agree but DeepSeek disagrees?"

### 3. Data Pipeline Reliability

Tracked via `source_fetch_logs` table:

- Fetch success/failure rate per provider
- Latency per provider
- Record counts per fetch
- Error messages for failed fetches

Visible in the "Source Health" dashboard tab.

### 4. Deduplication Effectiveness

The Deduplicator uses content fingerprinting. Metrics:

- Duplicate rate across sources (expected: 15-30% for major news)
- False positive rate (legitimate distinct articles incorrectly merged)

### 5. Event Extraction Accuracy

The rule-based event extractor classifies into 8 types:

- Earnings, Dividend, M&A, Financing, Litigation, Policy, Supply Chain, Insider

Each event gets a sentiment score (-1 to +1) and importance rating (1-5).

## Evaluation Methodology

### Automated

- Unit tests validate deterministic logic (validators, dedup, scoring)
- Integration tests validate data flow (pipeline, database operations)

### Manual

- Periodic review of archived decisions against actual stock performance
- Critic score distribution analysis (are scores calibrating well?)
- Model combination comparison (which ensembles perform best?)

### Known Gaps

- No automated backtesting pipeline yet (planned)
- No ground truth labels for sentiment accuracy
- No systematic evaluation of RAG retrieval quality
- Critic scores are relative, not calibrated against human expert ratings

## Case Study: Kweichow Moutai (600519)

Heterogeneous architecture produced "divergent views, suggest 30% pilot position":

- Fundamentals (Claude): bullish — product price increase
- Technicals (GPT): bullish — MA5 crossed above MA20, MACD histogram positive
- Risk Control (SenseNova): bearish — main force net outflow -4.461B over 5 days
- Retail Behavior (Mimo): caution — retail inflow + main outflow = potential bag-holding
- Sentiment (DeepSeek): identified "institutions selling into good news"

Final vote: **1 buy / 0 sell / 4 hold**. Chairman (Claude Opus) produced executive decision with:
- Position: 30% pilot
- Stop loss: MA60 or -7%
- Add signal: breakout above 1750 + main force return

This demonstrated the value of model diversity: no single model captured the full picture.

## Reproducing Results

```bash
# Run full test suite
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_critic.py -v

# Check code quality
ruff check backend/ frontend/ tests/
ruff format --check backend/ frontend/ tests/
```

Note: LLM-dependent tests require valid API keys in `.env`. Pure logic tests (validators, dedup, etc.) run without API access.
