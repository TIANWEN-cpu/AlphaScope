"""量化实验室 API — 外部服务适配与本地回测兜底端点"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.integrations.jince.errors import JinceConnectionError, JinceError
from backend.integrations.jince.service import JinceService
from backend.provider_timeout import call_with_timeout
from backend.schemas.api import ApiResponse

router = APIRouter(prefix="/api/quant", tags=["quant"])

# 默认服务实例（可被覆盖）
_service: Optional[JinceService] = None
_local_runs: list[dict[str, Any]] = []
QUANT_PROVIDER_TIMEOUT_SECONDS = 8.0


def _jince_failure_response(
    error: JinceError,
    data: dict[str, Any] | None = None,
    *,
    degraded_success: bool = False,
):
    """Return a structured API response for unavailable external backtest operations."""
    public_code = _public_quant_error_code(error)
    public_error = _public_quant_error_message(error, degraded_success=degraded_success)
    payload = data or {}
    if degraded_success:
        payload["degraded"] = True
        payload["source_status"] = "unavailable"
    payload.setdefault("external_error", public_error)
    return ApiResponse(
        success=degraded_success,
        error=public_error,
        error_code=public_code,
        data=payload,
    )


def _external_unavailable_text() -> str:
    return "外部服务未运行，已使用本地回测引擎。"


def _public_quant_error_code(error: JinceError) -> str:
    raw_code = str(getattr(error, "code", "") or "")
    if isinstance(error, JinceConnectionError) or raw_code == "JINCE_CONNECTION_ERROR":
        return "EXTERNAL_BACKTEST_DISCONNECTED"
    if "TIMEOUT" in raw_code:
        return "EXTERNAL_BACKTEST_TIMEOUT"
    if "HTTP" in raw_code:
        return "EXTERNAL_BACKTEST_HTTP_ERROR"
    if "STRATEGY" in raw_code:
        return "EXTERNAL_BACKTEST_STRATEGY_NOT_FOUND"
    return "EXTERNAL_BACKTEST_ERROR"


def _public_quant_error_message(error: JinceError, *, degraded_success: bool = False) -> str:
    code = _public_quant_error_code(error)
    suffix = "，已使用本地回测引擎。" if degraded_success else "。"
    if code == "EXTERNAL_BACKTEST_DISCONNECTED":
        return f"外部回测服务未运行{suffix}"
    if code == "EXTERNAL_BACKTEST_TIMEOUT":
        return f"外部回测服务响应超时{suffix}"
    if code == "EXTERNAL_BACKTEST_HTTP_ERROR":
        return f"外部回测服务请求失败{suffix}"
    if code == "EXTERNAL_BACKTEST_STRATEGY_NOT_FOUND":
        return "策略不存在，请选择可用策略后重试。"
    return f"外部回测服务暂不可用{suffix}"


def _get_service() -> JinceService:
    global _service
    if _service is None:
        _service = JinceService()
    return _service


def set_service(service: JinceService):
    """注入服务实例（测试用）"""
    global _service
    _service = service


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


def _local_status_payload(external_status: Any | None = None) -> dict[str, Any]:
    external_connected = bool(getattr(external_status, "connected", False))
    builtin_count = len(_builtin_strategy_data())
    return {
        "connected": external_connected,
        "external_connected": external_connected,
        "can_run_backtest": True,
        "local_backtest_available": True,
        "execution_mode": "external" if external_connected else "local",
        "version": getattr(external_status, "version", None) or "local",
        "strategy_count": (
            getattr(external_status, "strategy_count", 0)
            if external_connected and getattr(external_status, "strategy_count", 0)
            else builtin_count
        ),
        "active_runs": getattr(external_status, "active_runs", 0) or 0,
        "error": None,
        "external_error": None if external_connected else _external_unavailable_text(),
        "degraded": not external_connected,
        "source_status": "ok" if external_connected else "local_fallback",
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
    from backend.price_store import get_market, get_prices, normalize_symbol, save_price_bars

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
        strategy_id = "macd_momentum"
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
        },
        "equity_curve": equity_curve,
        "trades": result.trades,
        "started_at": now.isoformat(),
        "finished_at": now.isoformat(),
        "source_status": "local_fallback",
        "data_source": data_source,
        "degraded": data_source == "local_preview",
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
        },
    )
    del _local_runs[20:]
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


# ============================================================
# 端点
# ============================================================


@router.get("/status")
async def get_status():
    """获取回测能力状态"""
    svc = _get_service()
    try:
        status = await svc.get_status()
    except JinceError:
        status = None
    data = _local_status_payload(status)
    return ApiResponse(
        success=True,
        data=data,
        message=(
            "外部回测服务已连接。"
            if data["external_connected"]
            else "外部服务未运行，已启用本地回测引擎。"
        ),
    )


@router.get("/strategies")
async def list_strategies():
    """获取策略列表"""
    svc = _get_service()
    try:
        strategies = await svc.list_strategies()
        return ApiResponse(
            success=True,
            data={"strategies": [s.model_dump() for s in strategies]},
        )
    except JinceError as e:
        fallback_strategies = _builtin_strategy_data()
        return _jince_failure_response(
            e,
            data={
                "strategies": fallback_strategies,
                "can_run_backtest": True,
                "local_backtest_available": True,
                "execution_mode": "local",
            },
            degraded_success=True,
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
    svc = _get_service()
    try:
        result = await svc.reload_strategies()
        return ApiResponse(success=True, data=result)
    except JinceError as e:
        return _jince_failure_response(
            e,
            data={
                "reloaded": len(_builtin_strategy_data()),
                "strategies": _builtin_strategy_data(),
                "can_run_backtest": True,
                "local_backtest_available": True,
                "execution_mode": "local",
            },
            degraded_success=True,
        )


@router.post("/backtest")
async def run_backtest(body: BacktestRequestBody):
    """发起回测"""
    svc = _get_service()
    try:
        result = await svc.run_backtest(
            strategy_id=body.strategy_id,
            symbol=body.symbol,
            start_date=body.start_date,
            end_date=body.end_date,
            initial_capital=body.initial_capital,
            params=body.params,
        )
        return ApiResponse(success=True, data=result.model_dump())
    except JinceError as e:
        try:
            return ApiResponse(
                success=True,
                data=_run_local_backtest(body),
                message=_external_unavailable_text(),
            )
        except Exception as local_error:
            return _jince_failure_response(
                e,
                data={"local_error": str(local_error)},
            )
    except Exception as e:
        return ApiResponse(
            success=False,
            error=str(e),
            error_code="QUANT_BACKTEST_ERROR",
        )


@router.post("/live/start")
async def start_live(body: LiveStartBody):
    """启动实盘"""
    svc = _get_service()
    try:
        result = await svc.start_live(
            strategy_id=body.strategy_id,
            symbol=body.symbol,
            params=body.params,
            capital=body.capital,
        )
        return ApiResponse(success=True, data=result)
    except JinceError as e:
        return _jince_failure_response(e)


@router.post("/live/stop")
async def stop_live(body: LiveStopBody):
    """停止实盘"""
    svc = _get_service()
    try:
        result = await svc.stop_live(body.run_id)
        return ApiResponse(success=True, data=result)
    except JinceError as e:
        return _jince_failure_response(e)


@router.get("/runs")
async def list_runs():
    """获取运行记录"""
    svc = _get_service()
    try:
        runs = await svc.list_runs()
        return ApiResponse(
            success=True,
            data={"runs": [r.model_dump() for r in runs]},
        )
    except JinceError as e:
        return _jince_failure_response(
            e,
            data={
                "runs": _local_runs,
                "can_run_backtest": True,
                "local_backtest_available": True,
                "execution_mode": "local",
            },
            degraded_success=True,
        )


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    """获取运行详情"""
    svc = _get_service()
    try:
        result = await svc.get_run(run_id)
        return ApiResponse(success=True, data=result.model_dump())
    except JinceError as e:
        return _jince_failure_response(e)
