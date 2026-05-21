"""新闻/公告/事件 API"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.schemas.api import ApiResponse

router = APIRouter(prefix="/api/news", tags=["news"])


class NewsSearchRequest(BaseModel):
    query: str = Field(description="搜索关键词")
    limit: int = Field(default=20, description="最大结果数")


@router.get("")
async def list_news(
    symbol: str | None = None, event_type: str | None = None, limit: int = 50
):
    """新闻列表"""
    from backend.news_store import list_news as _list

    items = _list(symbol=symbol, event_type=event_type, limit=limit)
    return ApiResponse(success=True, data={"news": items, "total": len(items)})


@router.get("/announcements")
async def list_announcements(
    symbol: str | None = None, category: str | None = None, limit: int = 50
):
    """公告列表"""
    from backend.news_store import list_announcements as _list

    items = _list(symbol=symbol, category=category, limit=limit)
    return ApiResponse(success=True, data={"announcements": items, "total": len(items)})


@router.get("/events/{symbol}")
async def get_event_summary(symbol: str, days: int = 30):
    """事件摘要（类型分布+情绪）"""
    from backend.news_store import get_event_summary as _summary

    result = _summary(symbol, days=days)
    return ApiResponse(success=True, data=result)


@router.get("/impact/{symbol}")
async def get_event_impact(symbol: str, days: int = 30, window: int = 5):
    """事件影响分析"""
    from backend.event_impact import analyze_event_impact, correlate_events_prices
    from backend.news_store import list_news
    from backend.price_store import get_prices

    events = list_news(symbol=symbol, limit=100)
    prices = get_prices(symbol, limit=250)

    if not events:
        return ApiResponse(success=False, error="无事件数据")
    if not prices:
        return ApiResponse(success=False, error="无价格数据")

    impacted = analyze_event_impact(events, prices, window_days=window)
    correlation = correlate_events_prices(events, prices)

    return ApiResponse(
        success=True,
        data={
            "symbol": symbol,
            "events": impacted[:20],  # 返回前 20 条
            "correlation": correlation,
        },
    )


@router.post("/search")
async def search_news(req: NewsSearchRequest):
    """搜索新闻"""
    from backend.news_store import search_news as _search

    items = _search(req.query, limit=req.limit)
    return ApiResponse(
        success=True,
        data={"query": req.query, "results": items, "total": len(items)},
    )


@router.get("/{news_id}")
async def get_news(news_id: str):
    """新闻详情"""
    from backend.news_store import get_news as _get

    item = _get(news_id)
    if not item:
        return ApiResponse(success=False, error="新闻不存在")
    return ApiResponse(success=True, data=item)
