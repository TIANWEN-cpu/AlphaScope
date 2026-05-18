# Changelog

## v0.10.6 - 2026-05-18

- Isolated fallback LLM credentials so provider-specific or custom API keys are not reused when switching to the DeepSeek fallback.
- Rejected private, local, and otherwise non-public custom LLM base URLs by default unless explicitly enabled through environment configuration.
- Hardened archive file handling with safe names, archive-root path checks, and atomic index writes.
- Improved Eastmoney search handling with no-cookie first requests, validated article URLs, and an explicit `curl_cffi` dependency.
- Replaced broad JSON-object extraction with balanced-brace scanning for LLM responses.
- Made AI chat hot-reload compatibility use function signature inspection instead of TypeError string matching.
- Loaded fundamentals data sources in parallel on cache misses.
