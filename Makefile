.PHONY: help install dev test lint run clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install production dependencies
	pip install -r requirements.txt

dev: ## Install dev dependencies
	pip install -r requirements.txt
	pip install ruff black mypy pytest-cov

test: ## Run all tests
	python -m pytest tests/ -v

test-cov: ## Run tests with coverage
	python -m pytest tests/ -v --cov=backend --cov-report=term-missing

lint: ## Run linter
	ruff check backend/ frontend/ tests/
	ruff format --check backend/ frontend/ tests/

format: ## Format code
	ruff format backend/ frontend/ tests/

run: ## Run dashboard
	streamlit run frontend/dashboard.py

clean: ## Clean cache and temp files
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	rm -rf .pytest_cache .ruff_cache

docker-build: ## Build Docker image
	docker-compose build

docker-up: ## Start services
	docker-compose up -d

docker-down: ## Stop services
	docker-compose down

check: lint test ## Run lint + test
