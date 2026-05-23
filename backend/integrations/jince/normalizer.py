"""Jince 数据格式转换 — 将 Jince 原始数据转为内部 Schema"""

from __future__ import annotations

from typing import Any

from backend.schemas.quant import (
    BacktestMetrics,
    BacktestResult,
    JinceStatus,
    RunRecord,
    RunStatus,
    StrategyInfo,
    StrategyParam,
    StrategyStatus,
)


def normalize_status(raw: dict[str, Any]) -> JinceStatus:
    """转换 Jince 状态响应"""
    return JinceStatus(
        connected=True,
        version=raw.get("version"),
        strategy_count=raw.get("strategy_count", 0),
        active_runs=raw.get("active_runs", 0),
    )


def normalize_strategy(raw: dict[str, Any]) -> StrategyInfo:
    """转换策略数据"""
    params = []
    for p in raw.get("params", []):
        params.append(
            StrategyParam(
                name=p.get("name", ""),
                type=p.get("type", "float"),
                default=p.get("default"),
                min=p.get("min"),
                max=p.get("max"),
                description=p.get("description", ""),
            )
        )
    return StrategyInfo(
        id=raw.get("id", ""),
        name=raw.get("name", ""),
        description=raw.get("description", ""),
        status=StrategyStatus(raw.get("status", "active")),
        params=params,
        version=raw.get("version", "1.0"),
    )


def normalize_backtest_result(raw: dict[str, Any]) -> BacktestResult:
    """转换回测结果"""
    metrics = None
    if raw.get("metrics"):
        m = raw["metrics"]
        metrics = BacktestMetrics(
            total_return=m.get("total_return", 0.0),
            annual_return=m.get("annual_return", 0.0),
            sharpe_ratio=m.get("sharpe_ratio", 0.0),
            max_drawdown=m.get("max_drawdown", 0.0),
            win_rate=m.get("win_rate", 0.0),
            trade_count=m.get("trade_count", 0),
            profit_factor=m.get("profit_factor", 0.0),
            volatility=m.get("volatility", 0.0),
        )
    return BacktestResult(
        run_id=raw.get("run_id", ""),
        strategy_id=raw.get("strategy_id", ""),
        symbol=raw.get("symbol", ""),
        status=RunStatus(raw.get("status", "pending")),
        metrics=metrics,
        equity_curve=raw.get("equity_curve", []),
        trades=raw.get("trades", []),
        error=raw.get("error"),
        started_at=raw.get("started_at"),
        finished_at=raw.get("finished_at"),
    )


def normalize_run_record(raw: dict[str, Any]) -> RunRecord:
    """转换运行记录"""
    return RunRecord(
        run_id=raw.get("run_id", ""),
        strategy_id=raw.get("strategy_id", ""),
        symbol=raw.get("symbol", ""),
        mode=raw.get("mode", "backtest"),
        status=RunStatus(raw.get("status", "pending")),
        total_return=raw.get("total_return"),
        started_at=raw.get("started_at"),
        finished_at=raw.get("finished_at"),
    )
