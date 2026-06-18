"""F · 杀猪盘检测路由测试(monkeypatch 扫描函数)。"""

from __future__ import annotations

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi.testclient import TestClient

from backend.api.main import app
import backend.dragon_tiger.trap_signals as ts

client = TestClient(app)


def test_trap_route(monkeypatch):
    monkeypatch.setattr(
        ts,
        "scan_trap_signals",
        lambda name, **k: {
            "trap_level": "🟢 安全",
            "trap_score": 9,
            "signals_hit": "0/8",
            "signals_hit_count": 0,
            "recommendation": "数据正常",
        },
    )
    resp = client.get("/api/dragon-tiger/600519/trap?name=贵州茅台")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["trap_score"] == 9
    assert data["signals_hit_count"] == 0


def test_trap_route_handles_failure(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("search down")

    monkeypatch.setattr(ts, "scan_trap_signals", boom)
    resp = client.get("/api/dragon-tiger/600519/trap")
    assert resp.status_code == 200
    assert resp.json()["success"] is False
