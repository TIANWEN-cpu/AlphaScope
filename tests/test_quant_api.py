"""量化 API 端点测试"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from httpx import ASGITransport, AsyncClient

from backend.api.main import app
from backend.integrations.jince.errors import JinceConnectionError, JinceError
from backend.integrations.jince.service import JinceService
from backend.schemas.quant import (
    BacktestMetrics,
    BacktestResult,
    JinceStatus,
    RunRecord,
    RunStatus,
    StrategyInfo,
)


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


def _mock_status_connected():
    return JinceStatus(connected=True, version="2.0", strategy_count=3, active_runs=1)


def _mock_status_disconnected():
    return JinceStatus(connected=False, error="Jince 服务未启动")


def _mock_strategies():
    return [
        StrategyInfo(id="s1", name="MACD金叉", description="MACD策略"),
        StrategyInfo(id="s2", name="RSI反转", description="RSI策略"),
    ]


def _mock_backtest():
    return BacktestResult(
        run_id="r1",
        strategy_id="s1",
        symbol="600519",
        status=RunStatus.COMPLETED,
        metrics=BacktestMetrics(total_return=0.15, sharpe_ratio=1.2),
    )


# ========== GET /api/quant/status ==========


class TestQuantStatus:
    """Jince 服务状态端点"""

    @pytest.mark.anyio
    async def test_status_connected(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.get_status.return_value = _mock_status_connected()
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.get("/api/quant/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["connected"] is True
        assert data["data"]["version"] == "2.0"

    @pytest.mark.anyio
    async def test_status_disconnected(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.get_status.return_value = _mock_status_disconnected()
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.get("/api/quant/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["data"]["connected"] is False


# ========== GET /api/quant/strategies ==========


class TestQuantStrategies:
    """策略列表端点"""

    @pytest.mark.anyio
    async def test_strategies_list(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.list_strategies.return_value = _mock_strategies()
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.get("/api/quant/strategies")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert len(data["data"]["strategies"]) == 2

    @pytest.mark.anyio
    async def test_strategies_disconnected(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.list_strategies.side_effect = JinceConnectionError()
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.get("/api/quant/strategies")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error_code"] == "JINCE_DISCONNECTED"

    @pytest.mark.anyio
    async def test_strategies_http_error_returns_structured_failure(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.list_strategies.side_effect = JinceError(
            "Jince HTTP 503: ", code="JINCE_HTTP_ERROR"
        )
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.get("/api/quant/strategies")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error_code"] == "JINCE_HTTP_ERROR"
        assert data["data"]["strategies"] == []


# ========== POST /api/quant/strategies/reload ==========


class TestQuantReload:
    """策略重载端点"""

    @pytest.mark.anyio
    async def test_reload_ok(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.reload_strategies.return_value = {"reloaded": 3}
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.post("/api/quant/strategies/reload")
        assert resp.json()["success"] is True

    @pytest.mark.anyio
    async def test_reload_disconnected(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.reload_strategies.side_effect = JinceConnectionError()
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.post("/api/quant/strategies/reload")
        assert resp.json()["success"] is False
        assert resp.json()["error_code"] == "JINCE_DISCONNECTED"


# ========== POST /api/quant/backtest ==========


class TestQuantBacktest:
    """回测端点"""

    @pytest.mark.anyio
    async def test_backtest_ok(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.run_backtest.return_value = _mock_backtest()
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.post(
                "/api/quant/backtest",
                json={
                    "strategy_id": "s1",
                    "symbol": "600519",
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31",
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["run_id"] == "r1"
        assert data["data"]["metrics"]["total_return"] == 0.15

    @pytest.mark.anyio
    async def test_backtest_disconnected(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.run_backtest.side_effect = JinceConnectionError()
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.post(
                "/api/quant/backtest",
                json={
                    "strategy_id": "s1",
                    "symbol": "600519",
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31",
                },
            )
        assert resp.json()["success"] is False
        assert resp.json()["error_code"] == "JINCE_DISCONNECTED"


# ========== POST /api/quant/live/start ==========


class TestQuantLiveStart:
    """启动实盘端点"""

    @pytest.mark.anyio
    async def test_live_start_disconnected(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.start_live.side_effect = JinceConnectionError()
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.post(
                "/api/quant/live/start",
                json={"strategy_id": "s1", "symbol": "600519"},
            )
        assert resp.json()["success"] is False


# ========== POST /api/quant/live/stop ==========


class TestQuantLiveStop:
    """停止实盘端点"""

    @pytest.mark.anyio
    async def test_live_stop_disconnected(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.stop_live.side_effect = JinceConnectionError()
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.post("/api/quant/live/stop", json={"run_id": "r1"})
        assert resp.json()["success"] is False


# ========== GET /api/quant/runs ==========


class TestQuantRuns:
    """运行记录端点"""

    @pytest.mark.anyio
    async def test_runs_list(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.list_runs.return_value = [
            RunRecord(
                run_id="r1",
                strategy_id="s1",
                symbol="600519",
                status=RunStatus.COMPLETED,
                total_return=0.15,
            ),
        ]
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.get("/api/quant/runs")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert len(data["data"]["runs"]) == 1

    @pytest.mark.anyio
    async def test_runs_disconnected(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.list_runs.side_effect = JinceConnectionError()
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.get("/api/quant/runs")
        assert resp.json()["success"] is False
        assert resp.json()["error_code"] == "JINCE_DISCONNECTED"

    @pytest.mark.anyio
    async def test_runs_http_error_returns_structured_failure(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.list_runs.side_effect = JinceError(
            "Jince HTTP 503: ", code="JINCE_HTTP_ERROR"
        )
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.get("/api/quant/runs")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error_code"] == "JINCE_HTTP_ERROR"
        assert data["data"]["runs"] == []


# ========== GET /api/quant/runs/{run_id} ==========


class TestQuantRunDetail:
    """运行详情端点"""

    @pytest.mark.anyio
    async def test_run_detail(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.get_run.return_value = _mock_backtest()
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.get("/api/quant/runs/r1")
        assert resp.status_code == 200
        assert resp.json()["data"]["run_id"] == "r1"

    @pytest.mark.anyio
    async def test_run_detail_disconnected(self, client):
        mock_svc = AsyncMock(spec=JinceService)
        mock_svc.get_run.side_effect = JinceConnectionError()
        with patch("backend.api.quant._get_service", return_value=mock_svc):
            resp = await client.get("/api/quant/runs/r1")
        assert resp.json()["success"] is False
