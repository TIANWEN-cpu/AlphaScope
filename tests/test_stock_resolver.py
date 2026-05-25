from __future__ import annotations

from unittest.mock import patch

import pandas as pd
import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from httpx import ASGITransport, AsyncClient

from backend.api.main import app


@pytest.fixture(autouse=True)
def clear_resolver_cache():
    from backend.stock_resolver import clear_stock_name_cache

    clear_stock_name_cache()
    yield
    clear_stock_name_cache()


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


def test_resolve_stock_uses_akshare_code_name_table():
    from backend.stock_resolver import resolve_stock

    df = pd.DataFrame(
        [
            {"code": "301666", "name": "大普微-UW"},
            {"code": "600519", "name": "贵州茅台"},
        ]
    )

    with patch("backend.stock_resolver._fetch_a_share_code_name", return_value=df):
        result = resolve_stock("301666")

    assert result["symbol"] == "301666"
    assert result["name"] == "大普微-UW"
    assert result["exchange"] == "SZ"
    assert result["resolved"] is True
    assert result["source"] == "akshare_stock_info_a_code_name"


def test_resolve_stock_falls_back_to_safe_display_name_when_source_fails():
    from backend.stock_resolver import resolve_stock

    with patch(
        "backend.stock_resolver._fetch_a_share_code_name",
        side_effect=RuntimeError("offline"),
    ):
        result = resolve_stock("688001")

    assert result["symbol"] == "688001"
    assert result["name"] == "股票代码 688001"
    assert result["exchange"] == "SH"
    assert result["resolved"] is False


@pytest.mark.anyio
async def test_resolve_stock_endpoint(client):
    df = pd.DataFrame([{"code": "301666", "name": "大普微-UW"}])

    with patch("backend.stock_resolver._fetch_a_share_code_name", return_value=df):
        resp = await client.get("/api/stocks/resolve?q=301666")

    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["symbol"] == "301666"
    assert data["data"]["name"] == "大普微-UW"
