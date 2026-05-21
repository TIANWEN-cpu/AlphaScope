"""行情数据 API — K 线查询、最新价格、Provider 拉取"""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.api import ApiResponse

router = APIRouter(prefix="/api/prices", tags=["prices"])


# ============== Endpoints ==============


@router.get("/normalize/{symbol}")
async def normalize_symbol(symbol: str):
    """查看股票代码标准化结果"""
    from backend.price_store import get_market, normalize_symbol as _norm

    normalized = _norm(symbol)
    market = get_market(symbol)
    return ApiResponse(
        success=True,
        data={"original": symbol, "normalized": normalized, "market": market},
    )


@router.get("/{symbol}/latest")
async def get_latest_price(symbol: str):
    """获取最新价格"""
    from backend.price_store import get_latest_price as _latest

    bar = _latest(symbol)
    if not bar:
        return ApiResponse(success=False, error="无价格数据")
    return ApiResponse(success=True, data=bar)


@router.get("/{symbol}")
async def get_prices(
    symbol: str,
    frequency: str = "1d",
    start: str | None = None,
    end: str | None = None,
    limit: int = 250,
):
    """查询 K 线数据"""
    from backend.price_store import get_prices as _get

    bars = _get(
        symbol=symbol,
        frequency=frequency,
        start_date=start,
        end_date=end,
        limit=limit,
    )
    return ApiResponse(
        success=True,
        data={"symbol": symbol, "bars": bars, "total": len(bars)},
    )


@router.post("/{symbol}/fetch")
async def fetch_prices(symbol: str, days: int = 30):
    """从 Provider 拉取并存储 K 线数据"""
    from backend.price_store import normalize_symbol as _norm, save_price_bars

    sym = _norm(symbol)
    if not sym:
        return ApiResponse(success=False, error="无效的股票代码")

    try:
        from backend.providers.registry import get_registry

        registry = get_registry()
        bars = registry.get(data_type="prices", query=sym, market="CN", limit=days)
        if not bars:
            return ApiResponse(success=False, error="未从 Provider 获取到数据")

        # 标准化并保存
        count = save_price_bars(bars)
        return ApiResponse(
            success=True,
            data={"symbol": sym, "fetched": count},
            message=f"成功获取 {count} 条 K 线数据",
        )
    except Exception as e:
        return ApiResponse(success=False, error=f"获取数据失败: {e}")
