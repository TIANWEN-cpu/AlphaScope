"""量化实验室 API — 项目内置本地回测端点。

本模块默认不探测、不监听外部量化服务。参考外部量化项目的策略/回测/报告思路，
但运行链路固定使用当前项目内置策略、行情缓存、provider 取数和本地回测引擎。
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.provider_timeout import call_with_timeout
from backend.schemas.api import ApiResponse

router = APIRouter(prefix="/api/quant", tags=["quant"])

_local_runs: list[dict[str, Any]] = []
_local_run_details: dict[str, dict[str, Any]] = {}
QUANT_PROVIDER_TIMEOUT_SECONDS = 8.0


def _infer_param_type(value: Any) -> str:
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int) and not isinstance(value, bool):
        return "int"
    if isinstance(value, float):
        return "float"
    return "string"


def _builtin_strategy_data() -> list[dict[str, Any]]:
    from backend.quant.strategies import StrategyRegistry

    strategies: list[dict[str, Any]] = []
    for item in StrategyRegistry.list_strategies():
        defaults = item.get("default_params") or item.get("params") or {}
        strategy_id = str(item.get("id") or item.get("name") or "")
        strategies.append(
            {
                "id": strategy_id,
                "name": strategy_id,
                "description": item.get("description", ""),
                "status": "active",
                "version": "local",
                "source": "local",
                "params": [
                    {
                        "name": name,
                        "type": _infer_param_type(default),
                        "default": default,
                        "description": "",
                    }
                    for name, default in defaults.items()
                ],
            }
        )
    return strategies


def _local_status_payload() -> dict[str, Any]:
    builtin_count = len(_builtin_strategy_data())
    return {
        "connected": True,
        "external_connected": False,
        "can_run_backtest": True,
        "local_backtest_available": True,
        "execution_mode": "local",
        "version": "local",
        "strategy_count": builtin_count,
        "active_runs": 0,
        "run_count": len(_local_runs),
        "error": None,
        "external_error": None,
        "degraded": False,
        "source_status": "local",
        "data_sources": ["local_price_store", "provider", "local_preview"],
        "capabilities": {
            "strategy_params": True,
            "single_symbol_backtest": True,
            "run_history": True,
            "risk_audit": True,
            "live_trading": False,
            "tdx_compile": False,
            "stock_pool_parse": True,
        },
    }


def _parse_date(value: str, fallback: datetime) -> datetime:
    try:
        return datetime.fromisoformat(str(value)[:10])
    except Exception:
        return fallback


def _clean_bars(bars: list[dict[str, Any]], symbol: str) -> list[dict[str, Any]]:
    cleaned: list[dict[str, Any]] = []
    for bar in bars:
        close = float(bar.get("close") or 0)
        if close <= 0:
            continue
        open_price = float(bar.get("open") or close)
        high = float(bar.get("high") or max(open_price, close))
        low = float(bar.get("low") or min(open_price, close))
        cleaned.append(
            {
                "symbol": bar.get("symbol") or symbol,
                "date": str(bar.get("date") or ""),
                "open": open_price,
                "high": max(high, open_price, close),
                "low": min(low, open_price, close),
                "close": close,
                "volume": float(bar.get("volume") or 0),
            }
        )
    return sorted(cleaned, key=lambda item: item["date"])


def _generate_preview_bars(
    symbol: str,
    start_date: str,
    end_date: str,
    initial_capital: float,
) -> list[dict[str, Any]]:
    end_dt = _parse_date(end_date, datetime.now())
    start_dt = _parse_date(start_date, end_dt - timedelta(days=365))
    if start_dt >= end_dt:
        start_dt = end_dt - timedelta(days=365)

    total_days = max((end_dt - start_dt).days, 90)
    target_points = max(90, min(520, int(total_days * 5 / 7)))
    step = max(1, total_days // target_points)
    seed = sum(ord(ch) for ch in symbol)
    price = max(8.0, min(initial_capital / 1000, 80.0 + (seed % 1200) / 10))
    bars: list[dict[str, Any]] = []

    current_date = start_dt
    index = 0
    while current_date <= end_dt and len(bars) < target_points:
        if current_date.weekday() < 5:
            drift = 0.00035 + ((seed % 17) - 8) * 0.00001
            wave = math.sin((index + seed % 29) / 9) * 0.012
            pulse = math.cos((index + seed % 13) / 5) * 0.006
            open_price = price
            close = max(1.0, open_price * (1 + drift + wave + pulse))
            high = max(open_price, close) * (1.006 + abs(wave) * 0.2)
            low = min(open_price, close) * (0.994 - abs(pulse) * 0.15)
            bars.append(
                {
                    "symbol": symbol,
                    "date": current_date.date().isoformat(),
                    "open": round(open_price, 2),
                    "high": round(high, 2),
                    "low": round(low, 2),
                    "close": round(close, 2),
                    "volume": 200000 + (seed % 1000) * 100 + index * 37,
                }
            )
            price = close
            index += 1
        current_date += timedelta(days=step)

    return bars


def _load_local_bars(
    symbol: str,
    start_date: str,
    end_date: str,
    initial_capital: float,
) -> tuple[list[dict[str, Any]], str]:
    from backend.price_store import (
        get_market,
        get_prices,
        normalize_symbol,
        save_price_bars,
    )

    normalized_symbol = normalize_symbol(symbol) or symbol
    start_dt = _parse_date(start_date, datetime.now() - timedelta(days=365))
    end_dt = _parse_date(end_date, datetime.now())
    limit = max(120, min(1000, (end_dt - start_dt).days + 30))

    bars = _clean_bars(
        get_prices(
            normalized_symbol,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            include_incompatible=True,
        ),
        normalized_symbol,
    )
    if len(bars) >= 30:
        return bars, "local_price_store"

    try:
        from backend.providers.registry import get_registry

        provider_bars = call_with_timeout(
            lambda: get_registry().get(
                data_type="prices",
                market=get_market(normalized_symbol),
                symbol=normalized_symbol,
                limit=limit,
                start_date=start_date.replace("-", ""),
                end_date=end_date.replace("-", ""),
                period="daily",
                frequency="1d",
                adjust="",
            ),
            QUANT_PROVIDER_TIMEOUT_SECONDS,
            name="quant-price-provider",
        )
        if provider_bars:
            save_price_bars(provider_bars)
            bars = _clean_bars(provider_bars, normalized_symbol)
            if len(bars) >= 30:
                return bars, "provider"
    except Exception:
        pass

    return (
        _generate_preview_bars(
            normalized_symbol,
            start_date=start_date,
            end_date=end_date,
            initial_capital=initial_capital,
        ),
        "local_preview",
    )


def _run_local_backtest(body: BacktestRequestBody) -> dict[str, Any]:
    from backend.quant.engine import BacktestEngine
    from backend.quant.strategies import StrategyRegistry

    strategy_id = body.strategy_id
    if StrategyRegistry.get(strategy_id) is None:
        raise ValueError(f"策略不存在: {body.strategy_id}")
    strategy = StrategyRegistry.create(strategy_id, body.params)
    if strategy is None:
        raise ValueError(f"策略不存在: {body.strategy_id}")

    bars, data_source = _load_local_bars(
        body.symbol,
        start_date=body.start_date,
        end_date=body.end_date,
        initial_capital=body.initial_capital,
    )
    engine = BacktestEngine(initial_capital=body.initial_capital, commission_rate=0.001)
    result = engine.run(strategy, bars, body.symbol)
    performance = result.performance or {}
    now = datetime.now()
    run_id = f"local-{now.strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:6]}"
    final_equity = float(
        performance.get("final_equity")
        or (result.equity_curve[-1] if result.equity_curve else body.initial_capital)
    )
    equity_curve = [
        {"date": date, "equity": equity, "value": equity}
        for date, equity in zip(result.dates, result.equity_curve)
    ]
    payload = {
        "run_id": run_id,
        "strategy_id": strategy.name,
        "symbol": body.symbol,
        "status": "completed",
        "metrics": {
            "total_return": performance.get("total_return", 0.0),
            "annual_return": performance.get("annualized_return", 0.0),
            "sharpe_ratio": performance.get("sharpe_ratio", 0.0),
            "max_drawdown": performance.get("max_drawdown", 0.0),
            "win_rate": performance.get("win_rate", 0.0),
            "trade_count": performance.get("total_trades", len(result.trades)),
            "profit_factor": performance.get("profit_factor", 0.0),
            "sortino_ratio": performance.get("sortino_ratio", 0.0),
            "calmar_ratio": performance.get("calmar_ratio", 0.0),
            "volatility": performance.get("volatility", 0.0),
            "initial_capital": body.initial_capital,
            "final_equity": final_equity,
            "trading_days": performance.get("trading_days", len(bars)),
        },
        "equity_curve": equity_curve,
        "trades": result.trades,
        "risk_violations": result.risk_violations,
        "summary": {
            "bar_count": len(bars),
            "trade_count": performance.get("total_trades", len(result.trades)),
            "risk_violation_count": len(result.risk_violations),
            "start_date": bars[0]["date"] if bars else body.start_date,
            "end_date": bars[-1]["date"] if bars else body.end_date,
            "data_source": data_source,
            "data_source_label": (
                "本地样例行情"
                if data_source == "local_preview"
                else "实时数据源"
                if data_source == "provider"
                else "本地行情库"
            ),
        },
        "started_at": now.isoformat(),
        "finished_at": now.isoformat(),
        "source_status": "local",
        "data_source": data_source,
        "degraded": data_source == "local_preview",
        "engine": "local",
        "params": strategy.params,
        "message": (
            "已使用本地样例行情完成回测，仅用于功能预览。"
            if data_source == "local_preview"
            else "已使用本地回测引擎完成回测。"
        ),
    }
    _local_runs.insert(
        0,
        {
            "run_id": run_id,
            "strategy_id": strategy.name,
            "symbol": body.symbol,
            "mode": "backtest",
            "status": "completed",
            "total_return": payload["metrics"]["total_return"],
            "started_at": now.isoformat(),
            "finished_at": now.isoformat(),
            "source_status": payload["source_status"],
            "data_source": data_source,
        },
    )
    del _local_runs[20:]
    _local_run_details[run_id] = payload
    for stale_run_id in list(_local_run_details.keys())[50:]:
        _local_run_details.pop(stale_run_id, None)
    return payload


# ============================================================
# 请求模型
# ============================================================


class BacktestRequestBody(BaseModel):
    """回测请求体"""

    strategy_id: str = Field(description="策略ID")
    symbol: str = Field(description="标的代码")
    start_date: str = Field(description="开始日期 YYYY-MM-DD")
    end_date: str = Field(description="结束日期 YYYY-MM-DD")
    initial_capital: float = Field(default=1000000.0, description="初始资金")
    params: dict[str, Any] = Field(default_factory=dict, description="策略参数覆盖")


class LiveStartBody(BaseModel):
    """实盘启动请求体"""

    strategy_id: str = Field(description="策略ID")
    symbol: str = Field(description="标的代码")
    params: dict[str, Any] = Field(default_factory=dict, description="策略参数覆盖")
    capital: float = Field(default=1000000.0, description="投入资金")


class LiveStopBody(BaseModel):
    """实盘停止请求体"""

    run_id: str = Field(description="运行ID")


def run_local_backtest_payload(
    strategy_id: str,
    symbol: str,
    start_date: str,
    end_date: str,
    initial_capital: float = 1000000.0,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Run the built-in local backtest engine and return the API payload."""
    return _run_local_backtest(
        BacktestRequestBody(
            strategy_id=strategy_id,
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            initial_capital=initial_capital,
            params=params or {},
        )
    )


# ============================================================
# 端点
# ============================================================


@router.get("/status")
async def get_status():
    """获取回测能力状态"""
    data = _local_status_payload()
    return ApiResponse(
        success=True,
        data=data,
        message="本地回测引擎可用。",
    )


@router.get("/strategies")
async def list_strategies():
    """获取策略列表"""
    return ApiResponse(
        success=True,
        data={
            "strategies": _builtin_strategy_data(),
            "can_run_backtest": True,
            "local_backtest_available": True,
            "execution_mode": "local",
            "source_status": "local",
            "degraded": False,
        },
    )


@router.get("/strategies/{strategy_name}")
async def get_strategy(strategy_name: str):
    """获取本地内置策略详情"""
    for strategy in _builtin_strategy_data():
        if strategy.get("name") == strategy_name:
            return ApiResponse(success=True, data=strategy)
    from fastapi import HTTPException

    raise HTTPException(status_code=404, detail=f"策略不存在: {strategy_name}")


@router.get("/builtin-strategies")
async def list_builtin_strategies():
    """列出本地内置策略"""
    return ApiResponse(success=True, data=_builtin_strategy_data())


@router.post("/strategies/reload")
async def reload_strategies():
    """重载策略"""
    strategies = _builtin_strategy_data()
    return ApiResponse(
        success=True,
        data={
            "reloaded": len(strategies),
            "strategies": strategies,
            "can_run_backtest": True,
            "local_backtest_available": True,
            "execution_mode": "local",
            "source_status": "local",
            "degraded": False,
        },
        message=f"已加载 {len(strategies)} 个本地策略。",
    )


@router.post("/backtest")
async def run_backtest(body: BacktestRequestBody):
    """发起回测"""
    try:
        result = _run_local_backtest(body)
        return ApiResponse(success=True, data=result, message=result.get("message"))
    except Exception as e:
        return ApiResponse(
            success=False,
            error=str(e),
            error_code="LOCAL_BACKTEST_ERROR",
        )


@router.post("/live/start")
async def start_live(body: LiveStartBody):
    """启动实盘"""
    return ApiResponse(
        success=False,
        error="本地量化实验室暂未接入实盘执行，只支持历史回测。",
        error_code="LOCAL_LIVE_NOT_IMPLEMENTED",
        data={"strategy_id": body.strategy_id, "symbol": body.symbol},
    )


@router.post("/live/stop")
async def stop_live(body: LiveStopBody):
    """停止实盘"""
    return ApiResponse(
        success=False,
        error="本地量化实验室暂未接入实盘执行，无需停止实盘任务。",
        error_code="LOCAL_LIVE_NOT_IMPLEMENTED",
        data={"run_id": body.run_id},
    )


@router.get("/runs")
async def list_runs():
    """获取运行记录"""
    return ApiResponse(
        success=True,
        data={
            "runs": _local_runs,
            "can_run_backtest": True,
            "local_backtest_available": True,
            "execution_mode": "local",
            "source_status": "local",
            "degraded": False,
        },
    )


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    """获取运行详情"""
    result = _local_run_details.get(run_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"运行记录不存在: {run_id}")
    return ApiResponse(success=True, data=result)
