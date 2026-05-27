from __future__ import annotations

from unittest.mock import patch

import pandas as pd
import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from httpx import ASGITransport, AsyncClient

from backend.api.main import app


@pytest.fixture(autouse=True)
def clear_resolver_cache(tmp_path, monkeypatch):
    from backend import stock_resolver
    from backend.stock_resolver import clear_stock_name_cache

    monkeypatch.setattr(
        stock_resolver,
        "STOCK_NAME_CACHE_FILE",
        tmp_path / "stock_names_a_share.json",
    )
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
            {"code": "301667", "name": "测试股份"},
            {"code": "600519", "name": "贵州茅台"},
        ]
    )

    with patch("backend.stock_resolver._fetch_a_share_code_name", return_value=df):
        result = resolve_stock("301667")

    assert result["symbol"] == "301667"
    assert result["name"] == "测试股份"
    assert result["exchange"] == "SZ"
    assert result["resolved"] is True
    assert result["source"] == "akshare_stock_info_a_code_name"


def test_resolve_stock_known_alias_does_not_wait_for_akshare_table():
    from backend.stock_resolver import resolve_stock

    with patch(
        "backend.stock_resolver._fetch_a_share_code_name",
        side_effect=TimeoutError("slow upstream"),
    ) as mock_fetch:
        result = resolve_stock("301666")

    assert result["symbol"] == "301666"
    assert result["name"] == "大普微-UW"
    assert result["resolved"] is True
    assert result["source"] == "fallback_alias"
    mock_fetch.assert_not_called()


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


def test_resolve_stock_retries_after_transient_name_table_failure():
    from backend.stock_resolver import resolve_stock

    df = pd.DataFrame([{"code": "688001", "name": "华兴源创"}])

    with patch(
        "backend.stock_resolver._fetch_a_share_code_name",
        side_effect=[RuntimeError("offline"), df],
    ) as mock_fetch:
        first = resolve_stock("688001")
        second = resolve_stock("688001")
        third = resolve_stock("688001")

    assert first["name"] == "股票代码 688001"
    assert first["resolved"] is False
    assert second["name"] == "华兴源创"
    assert second["resolved"] is True
    assert third["name"] == "华兴源创"
    assert mock_fetch.call_count == 2


def test_resolve_stock_uses_persisted_name_map_when_source_fails():
    from backend.stock_resolver import resolve_stock

    with (
        patch(
            "backend.stock_resolver._load_persisted_a_share_name_map",
            return_value={"688001": "华兴源创"},
        ),
        patch(
            "backend.stock_resolver._fetch_a_share_code_name",
            side_effect=RuntimeError("offline"),
        ) as mock_fetch,
    ):
        result = resolve_stock("688001")

    assert result["symbol"] == "688001"
    assert result["name"] == "华兴源创"
    assert result["resolved"] is True
    assert result["source"] == "local_stock_name_cache"
    mock_fetch.assert_not_called()


@pytest.mark.anyio
async def test_resolve_stock_endpoint(client):
    df = pd.DataFrame([{"code": "301667", "name": "测试股份"}])

    with patch("backend.stock_resolver._fetch_a_share_code_name", return_value=df):
        resp = await client.get("/api/stocks/resolve?q=301667")

    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["symbol"] == "301667"
    assert data["data"]["name"] == "测试股份"
