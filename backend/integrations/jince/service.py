"""Jince 业务逻辑封装 — 对外提供高层 API"""

from __future__ import annotations

from typing import Any, Optional

from backend.schemas.quant import (
    BacktestResult,
    JinceStatus,
    RunRecord,
    StrategyInfo,
)

from .client import JinceClient
from .errors import JinceConnectionError
from .normalizer import (
    normalize_backtest_result,
    normalize_run_record,
    normalize_status,
    normalize_strategy,
)


class JinceService:
    """Jince 服务层 — 封装客户端调用 + 降级处理"""

    def __init__(self, client: Optional[JinceClient] = None):
        self.client = client or JinceClient()

    async def close(self):
        await self.client.close()

    async def get_status(self) -> JinceStatus:
        """获取服务状态，连接失败时返回 disconnected 状态"""
        try:
            raw = await self.client.get_status()
            return normalize_status(raw)
        except JinceConnectionError:
            return JinceStatus(connected=False, error="外部回测服务未运行")
        except Exception as e:
            return JinceStatus(connected=False, error=str(e))

    async def list_strategies(self) -> list[StrategyInfo]:
        """获取策略列表"""
        raw_list = await self.client.list_strategies()
        return [normalize_strategy(s) for s in raw_list]

    async def reload_strategies(self) -> dict[str, Any]:
        """重载策略"""
        return await self.client.reload_strategies()

    async def run_backtest(
        self,
        strategy_id: str,
        symbol: str,
        start_date: str,
        end_date: str,
        initial_capital: float = 1000000.0,
        params: Optional[dict[str, Any]] = None,
    ) -> BacktestResult:
        """发起回测"""
        raw = await self.client.run_backtest(
            strategy_id=strategy_id,
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            initial_capital=initial_capital,
            params=params,
        )
        return normalize_backtest_result(raw)

    async def start_live(
        self,
        strategy_id: str,
        symbol: str,
        params: Optional[dict[str, Any]] = None,
        capital: float = 1000000.0,
    ) -> dict[str, Any]:
        """启动实盘"""
        return await self.client.start_live(
            strategy_id=strategy_id,
            symbol=symbol,
            params=params,
            capital=capital,
        )

    async def stop_live(self, run_id: str) -> dict[str, Any]:
        """停止实盘"""
        return await self.client.stop_live(run_id)

    async def list_runs(self) -> list[RunRecord]:
        """获取运行记录"""
        raw_list = await self.client.list_runs()
        return [normalize_run_record(r) for r in raw_list]

    async def get_run(self, run_id: str) -> BacktestResult:
        """获取运行详情"""
        raw = await self.client.get_run(run_id)
        return normalize_backtest_result(raw)
