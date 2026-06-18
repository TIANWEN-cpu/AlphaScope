"""#3 投资人库 API 测试(读真实 experts.yaml)。"""

from __future__ import annotations

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi.testclient import TestClient

from backend.api.main import app

client = TestClient(app)


def test_list_experts():
    resp = client.get("/api/experts")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] >= 59
    ids = {e["id"] for e in data["experts"]}
    assert {"buffett", "duan", "dalio", "fengliu"}.issubset(ids)


def test_expert_fields_present():
    resp = client.get("/api/experts")
    one = next(e for e in resp.json()["data"]["experts"] if e["id"] == "buffett")
    assert one["name"]
    assert one["preview"]
    assert isinstance(one["focus_dims"], list)
