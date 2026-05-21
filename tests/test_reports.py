"""Tests for Report Center API — 报告中心端点"""

from __future__ import annotations

from unittest.mock import patch

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from httpx import ASGITransport, AsyncClient

from backend.api.main import app

MOCK_REPORTS = [
    {
        "timestamp": "20260521-103000",
        "date": "2026-05-21",
        "type": "agent",
        "stock_name": "贵州茅台",
        "symbol": "600519",
        "decision": "买入",
        "avg_confidence": 75.0,
        "path": "archive/600519/20260521-103000-贵州茅台.md",
    },
    {
        "timestamp": "20260520-140000",
        "date": "2026-05-20",
        "type": "agent",
        "stock_name": "宁德时代",
        "symbol": "300750",
        "decision": "持有",
        "avg_confidence": 60.0,
        "path": "archive/300750/20260520-140000-宁德时代.md",
    },
]

MOCK_STATS = {
    "total": 42,
    "buy_count": 15,
    "sell_count": 8,
    "hold_count": 19,
    "distinct_stocks": 12,
    "latest_timestamp": "20260521-103000",
}

MOCK_COMBO_STATS = [
    {
        "combo_signature": "claude+gpt+deepseek",
        "count": 20,
        "buy": 8,
        "sell": 4,
        "hold": 8,
        "avg_confidence": 72.5,
    },
]


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.anyio
async def test_list_reports_empty(client):
    """空存档返回空列表"""
    with patch("backend.archive.list_reports", return_value=[]):
        resp = await client.get("/api/archive")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["reports"] == []
    assert data["data"]["total"] == 0


@pytest.mark.anyio
async def test_list_reports_with_data(client):
    """有数据时返回报告列表"""
    with patch("backend.archive.list_reports", return_value=MOCK_REPORTS):
        resp = await client.get("/api/archive")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["data"]["reports"]) == 2
    assert data["data"]["reports"][0]["symbol"] == "600519"


@pytest.mark.anyio
async def test_list_reports_with_filters(client):
    """带筛选参数调用"""
    with patch("backend.archive.list_reports", return_value=[MOCK_REPORTS[0]]) as mock:
        resp = await client.get("/api/archive?stock=茅台&decision=买&limit=10")
    assert resp.status_code == 200
    mock.assert_called_once_with(
        stock_filter="茅台",
        decision_filter="买",
        date_from=None,
        date_to=None,
        type_filter=None,
        limit=10,
    )


@pytest.mark.anyio
async def test_get_stats(client):
    """统计端点返回正确格式"""
    with patch("backend.archive.get_stats", return_value=MOCK_STATS):
        resp = await client.get("/api/archive/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["total"] == 42
    assert data["data"]["buy_count"] == 15


@pytest.mark.anyio
async def test_get_combo_stats(client):
    """组合统计返回正确格式"""
    with patch("backend.archive.get_combo_stats", return_value=MOCK_COMBO_STATS):
        resp = await client.get("/api/archive/combo-stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["data"]["combos"]) == 1
    assert data["data"]["combos"][0]["combo_signature"] == "claude+gpt+deepseek"


@pytest.mark.anyio
async def test_load_report(client):
    """读取报告内容"""
    with patch("backend.archive.load_report", return_value="# 测试报告\n\n买入"):
        resp = await client.get("/api/archive/archive/600519/test.md")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "测试报告" in data["data"]["content"]


@pytest.mark.anyio
async def test_load_report_not_found(client):
    """不存在的报告返回 404"""
    with patch("backend.archive.load_report", return_value="⚠️ 报告文件不存在"):
        resp = await client.get("/api/archive/archive/nonexistent.md")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_delete_report(client):
    """删除报告"""
    with patch("backend.archive.delete_report", return_value=True):
        resp = await client.delete("/api/archive/archive/600519/test.md")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["deleted"] == "archive/600519/test.md"


@pytest.mark.anyio
async def test_delete_report_not_found(client):
    """删除不存在的报告返回失败"""
    with patch("backend.archive.delete_report", return_value=False):
        resp = await client.delete("/api/archive/archive/nonexistent.md")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert "不存在" in data["error"]
