from __future__ import annotations

from unittest.mock import patch

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from httpx import ASGITransport, AsyncClient

from backend.api.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.anyio
async def test_fund_flow_timeout_returns_degraded_success(client):
    with patch("backend.api.fund_flow._call_with_timeout", side_effect=TimeoutError("slow")):
        resp = await client.get("/api/fund-flow/600519?days=30")

    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["error_code"] == "FUND_FLOW_DEGRADED"
    assert data["data"]["symbol"] == "600519"
    assert data["data"]["records"] == []
    assert data["data"]["summary"]["main_total_yi"] == 0.0
    assert data["data"]["degraded"] is True
    assert data["data"]["source_status"] == "timeout"
