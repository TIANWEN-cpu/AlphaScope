"""龙虎榜/游资 API 路由测试(mock akshare,不联网)。"""

from __future__ import annotations

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi.testclient import TestClient

from backend.api.main import app
from backend.dragon_tiger import lhb as lhb_mod

client = TestClient(app)

_FAKE = [
    {
        "营业部名称": "国泰君安证券股份有限公司上海江苏路证券营业部",
        "买入金额": 1e8,
        "卖出金额": 2e7,
    },
    {"营业部名称": "机构专用", "买入金额": 3e7, "卖出金额": 5e7},
]


def test_dragon_tiger_route(monkeypatch):
    monkeypatch.setattr(lhb_mod, "fetch_lhb_recent", lambda code, days=30: _FAKE)
    monkeypatch.setattr(lhb_mod, "fetch_sector_lhb", lambda top=30: [])
    resp = client.get("/api/dragon-tiger/600519")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    data = body["data"]
    assert data["lhb_count_30d"] == 2
    assert "章盟主" in data["matched_youzi"]
    assert data["inst_vs_youzi"]["institutional_net"] == 3e7 - 5e7


def test_dragon_tiger_non_a_share_is_empty():
    resp = client.get("/api/dragon-tiger/AAPL")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"].get("lhb_count_30d", 0) == 0


def test_dragon_tiger_clamps_days():
    # days 超界应被 FastAPI 拒绝(422)
    resp = client.get("/api/dragon-tiger/600519?days=9999")
    assert resp.status_code == 422
