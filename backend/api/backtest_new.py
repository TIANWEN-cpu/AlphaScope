"""量化回测 API 路由 (v1.1.1)

不覆盖原有 /api/backtest/* 端点，使用新前缀 /api/quant/
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.schemas.api import (
    ApiResponse,
    BacktestRunRequest,
)

router = APIRouter(prefix="/api/quant", tags=["quant"])


def _get_strategies():
    from backend.quant.strategies import StrategyRegistry

    return StrategyRegistry


def _get_engine():
    from backend.quant.engine import BacktestEngine

    return BacktestEngine


def _get_price_store():
    from backend.storage.db import Database

    return Database()


# ----------------------------------------------------------------
# 策略 CRUD
# ----------------------------------------------------------------


@router.get("/strategies")
def list_strategies() -> ApiResponse:
    """列出所有可用策略"""
    registry = _get_strategies()
    strategies = registry.list_strategies()
    return ApiResponse(success=True, data=strategies)


@router.get("/strategies/{strategy_name}")
def get_strategy(strategy_name: str) -> ApiResponse:
    """获取策略详情"""
    registry = _get_strategies()
    strategy_class = registry.get(strategy_name)
    if not strategy_class:
        raise HTTPException(status_code=404, detail=f"策略不存在: {strategy_name}")

    return ApiResponse(
        success=True,
        data={
            "name": strategy_class.name,
            "description": strategy_class.description,
            "default_params": strategy_class.default_params,
        },
    )


# ----------------------------------------------------------------
# 回测运行
# ----------------------------------------------------------------


@router.post("/backtest")
def run_backtest(req: BacktestRunRequest) -> ApiResponse:
    """运行回测"""
    registry = _get_strategies()
    engine_cls = _get_engine()

    strategy = registry.create(req.strategy_name, req.params)
    if not strategy:
        raise HTTPException(status_code=400, detail=f"未知策略: {req.strategy_name}")

    # Get price bars from database
    try:
        db = _get_price_store()
        bars = db.get_price_bars(req.symbol, limit=req.days)
    except Exception:
        bars = []

    if not bars or len(bars) < 30:
        # Try to fetch from provider
        try:
            from backend.providers.registry import ProviderRegistry

            provider = ProviderRegistry.get_provider()
            if provider:
                raw_bars = provider.get_prices(req.symbol, days=req.days)
                if raw_bars:
                    bars = raw_bars
        except Exception:
            pass

    if not bars or len(bars) < 30:
        raise HTTPException(
            status_code=400,
            detail=f"数据不足: {req.symbol} 只有 {len(bars)} 条数据，至少需要 30 条",
        )

    engine = engine_cls(
        initial_capital=req.initial_capital,
        commission_rate=0.001,
    )

    # 可选基准(如沪深300): 取不到则优雅降级, 基准指标为 0, 不阻断回测。
    benchmark_bars = None
    bench_name = ""
    if req.benchmark_symbol:
        try:
            db = _get_price_store()
            benchmark_bars = db.get_price_bars(req.benchmark_symbol, limit=req.days)
        except Exception:
            benchmark_bars = None
        if not benchmark_bars or len(benchmark_bars) < 30:
            try:
                from backend.providers.registry import ProviderRegistry

                provider = ProviderRegistry.get_provider()
                if provider:
                    raw = provider.get_prices(req.benchmark_symbol, days=req.days)
                    if raw:
                        benchmark_bars = raw
            except Exception:
                benchmark_bars = None
        if benchmark_bars and len(benchmark_bars) >= 30:
            bench_name = req.benchmark_symbol
        else:
            benchmark_bars = None  # 数据不足 → 跳过基准指标

    result = engine.run(
        strategy,
        bars,
        req.symbol,
        benchmark_bars=benchmark_bars,
        benchmark_name=bench_name,
    )

    return ApiResponse(success=True, data=result.to_dict())


# ----------------------------------------------------------------
# 内置策略列表（快捷接口）
# ----------------------------------------------------------------


@router.get("/builtin-strategies")
def list_builtin_strategies() -> ApiResponse:
    """列出内置策略及其默认参数"""
    registry = _get_strategies()
    return ApiResponse(success=True, data=registry.list_strategies())
