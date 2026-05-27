"""行情数据 API — K 线查询、最新价格、Provider 拉取"""

from __future__ import annotations

from datetime import datetime, timedelta

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
    from backend.price_quality import filter_incompatible_price_bars
    from backend.price_store import get_latest_price as _latest, get_prices as _get

    raw_daily_bars = _get(
        symbol=symbol, frequency="1d", limit=20, include_incompatible=True
    )
    daily_bars = filter_incompatible_price_bars(raw_daily_bars)
    if not daily_bars:
        await fetch_prices(symbol, days=120)
        raw_daily_bars = _get(
            symbol=symbol, frequency="1d", limit=20, include_incompatible=True
        )
        daily_bars = filter_incompatible_price_bars(raw_daily_bars)
    bar = daily_bars[0] if daily_bars else _latest(symbol)
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
    from backend.price_periods import (
        aggregate_price_bars,
        default_daily_window_days,
        fetch_intraday_prices,
        normalize_frequency,
    )
    from backend.price_quality import filter_incompatible_price_bars
    from backend.price_store import get_prices as _get

    normalized_frequency = normalize_frequency(frequency)
    if normalized_frequency == "intraday":
        bars = fetch_intraday_prices(symbol, limit=limit)
        return ApiResponse(
            success=True,
            data={
                "symbol": symbol,
                "frequency": normalized_frequency,
                "bars": bars,
                "total": len(bars),
            },
        )

    store_frequency = (
        "1d" if normalized_frequency in {"1w", "1mo"} else normalized_frequency
    )
    fetch_days = default_daily_window_days(
        max(1, min(limit, 500)), normalized_frequency
    )
    raw_bars = _get(
        symbol=symbol,
        frequency=store_frequency,
        start_date=start,
        end_date=end,
        limit=fetch_days if normalized_frequency in {"1w", "1mo"} else limit,
        include_incompatible=True,
    )
    bars = filter_incompatible_price_bars(raw_bars)
    if not bars and not start and not end:
        await fetch_prices(symbol, days=max(1, min(fetch_days, 365)))
        raw_bars = _get(
            symbol=symbol,
            frequency=store_frequency,
            start_date=start,
            end_date=end,
            limit=fetch_days if normalized_frequency in {"1w", "1mo"} else limit,
            include_incompatible=True,
        )
        bars = filter_incompatible_price_bars(raw_bars)
    if normalized_frequency in {"1w", "1mo"}:
        bars = aggregate_price_bars(bars, normalized_frequency)[-limit:]
    return ApiResponse(
        success=True,
        data={
            "symbol": symbol,
            "frequency": normalized_frequency,
            "bars": bars,
            "total": len(bars),
        },
    )


@router.post("/{symbol}/fetch")
async def fetch_prices(symbol: str, days: int = 30):
    """从 Provider 拉取并存储 K 线数据"""
    if days < 1 or days > 365:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="days 参数必须在 1-365 之间")
    from backend.price_store import (
        get_market,
        normalize_symbol as _norm,
        save_price_bars,
    )

    sym = _norm(symbol)
    if not sym:
        return ApiResponse(success=False, error="无效的股票代码")

    try:
        from backend.providers.registry import get_registry

        registry = get_registry()
        end_date = datetime.now().strftime("%Y%m%d")
        start_date = (datetime.now() - timedelta(days=max(days * 2, 30))).strftime(
            "%Y%m%d"
        )
        bars = registry.get(
            data_type="prices",
            market=get_market(sym),
            symbol=sym,
            limit=days,
            start_date=start_date,
            end_date=end_date,
            period="daily",
            frequency="1d",
            adjust="",
        )
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
