"""Regression tests for analysis guardrails."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from httpx import ASGITransport, AsyncClient

from backend.api.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.anyio
async def test_analysis_run_rejects_empty_market_data(client):
    with patch("backend.api.main.get_prices", return_value=[]):
        resp = await client.post(
            "/api/analysis/run",
            json={"stock_symbol": "600519.SH", "stock_name": "贵州茅台", "mode": "deep"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert "行情" in data["error"] or "数据不足" in data["error"]


@pytest.mark.anyio
async def test_analysis_run_rejects_zero_only_market_data(client):
    with patch(
        "backend.api.main.get_prices",
        return_value=[
            {"date": "2026-05-01", "open": 0, "close": 0, "high": 0, "low": 0, "volume": 0}
        ],
    ):
        resp = await client.post(
            "/api/analysis/run",
            json={"stock_symbol": "600519.SH", "stock_name": "贵州茅台", "mode": "deep"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert "行情" in data["error"] or "数据不足" in data["error"]
