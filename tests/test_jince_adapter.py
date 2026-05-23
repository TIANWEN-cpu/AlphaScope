"""Jince 适配层单元测试"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

pytest.importorskip("fastapi")

from backend.integrations.jince.client import JinceClient
from backend.integrations.jince.errors import (
    JinceConnectionError,
    JinceTimeoutError,
)
from backend.integrations.jince.health import check_jince_health
from backend.integrations.jince.normalizer import (
    normalize_backtest_result,
    normalize_run_record,
    normalize_status,
    normalize_strategy,
)
from backend.integrations.jince.service import JinceService
from backend.schemas.quant import RunStatus, StrategyStatus


# ============================================================
# normalizer 测试
# ============================================================


class TestNormalizer:
    """数据格式转换测试"""

    def test_normalize_status_connected(self):
        raw = {"version": "2.0", "strategy_count": 5, "active_runs": 2}
        status = normalize_status(raw)
        assert status.connected is True
        assert status.version == "2.0"
        assert status.strategy_count == 5
        assert status.active_runs == 2

    def test_normalize_strategy(self):
        raw = {
            "id": "macd_cross",
            "name": "MACD 金叉",
            "description": "MACD 金叉策略",
            "status": "active",
            "version": "1.0",
            "params": [
                {
                    "name": "fast_period",
                    "type": "int",
                    "default": 12,
                    "min": 5,
                    "max": 50,
                },
            ],
        }
        s = normalize_strategy(raw)
        assert s.id == "macd_cross"
        assert s.name == "MACD 金叉"
        assert s.status == StrategyStatus.ACTIVE
        assert len(s.params) == 1
        assert s.params[0].name == "fast_period"

    def test_normalize_backtest_result(self):
        raw = {
            "run_id": "r1",
            "strategy_id": "macd_cross",
            "symbol": "600519",
            "status": "completed",
            "metrics": {
                "total_return": 0.15,
                "sharpe_ratio": 1.2,
                "max_drawdown": -0.08,
            },
            "equity_curve": [{"date": "2025-01-01", "equity": 1000000}],
            "trades": [],
        }
        result = normalize_backtest_result(raw)
        assert result.run_id == "r1"
        assert result.status == RunStatus.COMPLETED
        assert result.metrics.total_return == 0.15
        assert result.metrics.sharpe_ratio == 1.2

    def test_normalize_run_record(self):
        raw = {
            "run_id": "r1",
            "strategy_id": "s1",
            "symbol": "600519",
            "mode": "backtest",
            "status": "completed",
            "total_return": 0.15,
        }
        rec = normalize_run_record(raw)
        assert rec.run_id == "r1"
        assert rec.total_return == 0.15


# ============================================================
# client 测试
# ============================================================


class TestJinceClient:
    """HTTP 客户端测试"""

    def test_init_default_url(self):
        client = JinceClient()
        assert client.base_url == "http://localhost:8888"

    def test_init_custom_url(self):
        client = JinceClient(base_url="http://jince:9999")
        assert client.base_url == "http://jince:9999"

    @pytest.mark.anyio
    async def test_connection_error(self):
        client = JinceClient(base_url="http://127.0.0.1:19999", timeout=0.5)
        with pytest.raises((JinceConnectionError, JinceTimeoutError)):
            await client.get_status()

    @pytest.mark.anyio
    async def test_close(self):
        client = JinceClient()
        await client.close()  # 无异常


# ============================================================
# service 测试
# ============================================================


class TestJinceService:
    """业务逻辑层测试"""

    @pytest.mark.anyio
    async def test_get_status_disconnected(self):
        client = JinceClient(base_url="http://127.0.0.1:19999", timeout=0.3)
        svc = JinceService(client=client)
        status = await svc.get_status()
        assert status.connected is False
        assert status.error is not None

    @pytest.mark.anyio
    async def test_get_status_connected(self):
        mock_client = AsyncMock(spec=JinceClient)
        mock_client.get_status.return_value = {
            "version": "2.0",
            "strategy_count": 3,
            "active_runs": 1,
        }
        svc = JinceService(client=mock_client)
        status = await svc.get_status()
        assert status.connected is True
        assert status.version == "2.0"

    @pytest.mark.anyio
    async def test_list_strategies(self):
        mock_client = AsyncMock(spec=JinceClient)
        mock_client.list_strategies.return_value = [
            {"id": "s1", "name": "策略1", "status": "active"},
            {"id": "s2", "name": "策略2", "status": "inactive"},
        ]
        svc = JinceService(client=mock_client)
        strategies = await svc.list_strategies()
        assert len(strategies) == 2
        assert strategies[0].id == "s1"

    @pytest.mark.anyio
    async def test_run_backtest(self):
        mock_client = AsyncMock(spec=JinceClient)
        mock_client.run_backtest.return_value = {
            "run_id": "r1",
            "strategy_id": "s1",
            "symbol": "600519",
            "status": "completed",
            "metrics": {"total_return": 0.1},
        }
        svc = JinceService(client=mock_client)
        result = await svc.run_backtest("s1", "600519", "2024-01-01", "2024-12-31")
        assert result.run_id == "r1"
        assert result.metrics.total_return == 0.1


# ============================================================
# health 测试
# ============================================================


class TestHealth:
    """健康检查测试"""

    @pytest.mark.anyio
    async def test_health_disconnected(self):
        client = JinceClient(base_url="http://127.0.0.1:19999", timeout=0.3)
        result = await check_jince_health(client)
        assert result["status"] == "disconnected"
        assert result["error"] is not None

    @pytest.mark.anyio
    async def test_health_ok(self):
        mock_client = AsyncMock(spec=JinceClient)
        mock_client.get_status.return_value = {"version": "2.0"}
        result = await check_jince_health(mock_client)
        assert result["status"] == "ok"
        assert result["version"] == "2.0"
