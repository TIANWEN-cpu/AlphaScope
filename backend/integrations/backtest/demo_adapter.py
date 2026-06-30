"""Demo Backtest Adapter — 用归一化结构回放一个静态结果, 证明 Integration Registry 走通。

它不依赖任何外部库, 不做真实回测, 仅用于:
- 让 /api/integrations 在 Phase 1 就有非空内容可展示
- 作为 BacktestEngineAdapter 的参考实现模板
- 让 tests/integrations 能验证健康检查 + 边界断言 + 归一化输出

Phase 2 起会被 vectorbt_adapter / backtrader_adapter 等真实 adapter 取代/补充。
"""

from __future__ import annotations

from typing import Any

from backend.integrations.base import BacktestEngineAdapter
from backend.integrations.schemas import (
    BacktestAssumptions,
    BacktestMetrics,
    HealthStatus,
    IntegrationHealth,
    IntegrationMetadata,
    IntegrationMode,
    LicenseSafety,
    NormalizedBacktestResult,
)
from backend.integrations.registry import register


@register
class DemoBacktestAdapter(BacktestEngineAdapter):
    """零依赖演示回测引擎, 返回静态归一化结果。"""

    NAME = "demo"
    # CATEGORY 继承自 BacktestEngineAdapter.BACKTEST, 无需重设

    def _metadata(self) -> IntegrationMetadata:
        return IntegrationMetadata(
            name=self.NAME,
            category=self.CATEGORY,
            mode=IntegrationMode.NATIVE,
            version="0.1.0",
            display_name="Demo 回测引擎",
            description="零依赖演示引擎: 回放静态归一化结果, 证明 Integration Registry 走通。",
            capabilities=[
                {"name": "run_backtest", "description": "返回一个静态归一化回测结果"},
            ],
            license_name="MIT",
            license_safety=LicenseSafety.SAFE,
            code_copy_allowed=True,
            allow_live_order=False,
        )

    def healthcheck(self) -> IntegrationHealth:
        return IntegrationHealth(
            name=self.NAME,
            status=HealthStatus.HEALTHY,
            message="演示引擎始终可用 (无外部依赖)。",
        )

    def run_backtest(
        self,
        strategy_id: str,
        symbols: list[str],
        start: str,
        end: str,
        assumptions: BacktestAssumptions | None = None,
        **kw: Any,
    ) -> NormalizedBacktestResult:
        assumptions = assumptions or BacktestAssumptions(
            engine_name=self.NAME,
            execution_price="T+1 开盘价 (演示)",
            settlement_rule="T+1 (演示)",
            future_function_check=True,
            note="Demo 引擎静态假设, 仅供 Registry 验证, 非真实回测。",
        )
        return NormalizedBacktestResult(
            engine_name=self.NAME,
            strategy_id=strategy_id,
            universe=list(symbols),
            start_date=start,
            end_date=end,
            initial_cash=1_000_000.0,
            benchmark="沪深300",
            assumptions=assumptions,
            metrics=BacktestMetrics(
                annual_return=0.0,
                sharpe=0.0,
                max_drawdown=0.0,
                total_return=0.0,
                win_rate=0.0,
            ),
            equity_curve=[],
            trades=[],
            risk_events=[],
            evidence_links=[],
            reproducibility_hash="demo:00000000",
            research_only=True,
        )
