# Contributing

Thanks for your interest in contributing to AI-Finance.

## Getting Started

```bash
git clone https://github.com/TIANWEN-cpu/AI--FINANCE.git
cd AI--FINANCE
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Development Workflow

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run lint and tests before submitting:

```bash
ruff check backend/ frontend/ tests/
ruff format --check backend/ frontend/ tests/
python -m pytest tests/ -v
```

4. Submit a pull request with a clear description of what changed and why

## Code Style

- Python 3.11+
- Ruff for linting and formatting (config in `ruff.toml`)
- Type hints encouraged but not required
- No comments unless the "why" is non-obvious

## Adding a Data Provider

1. Create `backend/providers/your_provider.py` extending `BaseProvider`
2. Implement `get_news()`, `get_reports()`, `get_announcements()` as applicable
3. Add config entry in `config/data_sources.yaml`
4. Add tests in `tests/test_your_provider.py`

## Adding an Agent

1. Add agent function in `backend/llm_agents.py`
2. Register in the agent mode config (`config/models.yaml`)
3. Update the market brief builder if the agent needs custom data

## Reporting Issues

Open a GitHub issue with:
- Steps to reproduce
- Expected vs actual behavior
- Python version and OS

## Security

See [SECURITY.md](SECURITY.md) for reporting security vulnerabilities.
