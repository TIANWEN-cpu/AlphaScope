"""量化实验室 API — Jince 适配层端点"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.integrations.jince.errors import JinceConnectionError, JinceError
from backend.integrations.jince.service import JinceService
from backend.schemas.api import ApiResponse

router = APIRouter(prefix="/api/quant", tags=["quant"])

# 默认服务实例（可被覆盖）
_service: Optional[JinceService] = None


def _jince_failure_response(
    error: JinceError,
    data: dict[str, Any] | None = None,
    *,
    degraded_success: bool = False,
):
    """Return a structured API response for unavailable Jince operations."""
    error_code = (
        "JINCE_DISCONNECTED"
        if isinstance(error, JinceConnectionError)
        else getattr(error, "code", "JINCE_ERROR")
    )
    payload = data or {}
    if degraded_success:
        payload["degraded"] = True
        payload["source_status"] = "unavailable"
    return ApiResponse(
        success=degraded_success,
        error=str(error),
        error_code=error_code,
        data=payload,
    )


def _get_service() -> JinceService:
    global _service
    if _service is None:
        _service = JinceService()
    return _service


def set_service(service: JinceService):
    """注入服务实例（测试用）"""
    global _service
    _service = service


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
    """获取 Jince 服务状态"""
    svc = _get_service()
    status = await svc.get_status()
    data = status.model_dump()
    data["degraded"] = not status.connected
    data["source_status"] = "ok" if status.connected else "unavailable"
    return ApiResponse(
        success=True,
        data=data,
        error=status.error if not status.connected else None,
        error_code="JINCE_DISCONNECTED" if not status.connected else None,
    )


def _builtin_strategy_data() -> list[dict[str, Any]]:
    from backend.quant.strategies import StrategyRegistry

    return StrategyRegistry.list_strategies()


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
        return _jince_failure_response(e, data={"strategies": []}, degraded_success=True)


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
        return _jince_failure_response(e)


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
        return _jince_failure_response(e)
    except Exception as e:
        return ApiResponse(
            success=False,
            error=str(e),
            error_code="JINCE_BACKTEST_ERROR",
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
        return _jince_failure_response(e, data={"runs": []}, degraded_success=True)


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    """获取运行详情"""
    svc = _get_service()
    try:
        result = await svc.get_run(run_id)
        return ApiResponse(success=True, data=result.model_dump())
    except JinceError as e:
        return _jince_failure_response(e)
