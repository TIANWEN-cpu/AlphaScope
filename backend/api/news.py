"""新闻/公告/事件 API"""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.schemas.api import ApiResponse
from backend.utils.datetime_util import normalize_dt_str

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
    if not items:
        await _fetch_and_store_news(symbol=symbol, limit=limit)
        items = _list(symbol=symbol, event_type=event_type, limit=limit)
    return ApiResponse(success=True, data={"news": items, "total": len(items)})


@router.get("/announcements")
async def list_announcements(
    symbol: str | None = None, category: str | None = None, limit: int = 50
):
    """公告列表"""
    from backend.news_store import list_announcements as _list

    items = _list(symbol=symbol, category=category, limit=limit)
    if not items and symbol:
        await _fetch_and_store_announcements(symbol=symbol, limit=limit)
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
    if not items:
        await _fetch_and_store_news(symbol=req.query, limit=req.limit)
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


async def _fetch_and_store_news(symbol: str | None = None, limit: int = 50) -> None:
    try:
        from backend.news_data import (
            fetch_telegraph_cls,
            fetch_telegraph_em,
            fetch_telegraph_sina,
            fetch_stock_news_em,
            get_stock_related_news,
            merge_news_items,
        )
        from backend.storage.db import Database

        raw_items: list[dict[str, Any]] = []
        if symbol:
            raw_items.extend(fetch_stock_news_em(symbol, limit=limit))
        if not raw_items:
            market_items = merge_news_items(
                fetch_telegraph_cls(limit=min(limit, 30)),
                fetch_telegraph_em(limit=min(limit, 50)),
                fetch_telegraph_sina(limit=min(limit, 20)),
                limit=limit,
            )
            raw_items = (
                get_stock_related_news(
                    "", market_items, limit=limit, symbol=symbol or ""
                )
                if symbol
                else market_items
            )

        db = Database()
        now = datetime.now().isoformat()
        for item in raw_items[:limit]:
            row = _to_news_row(item, symbol=symbol or "", fetched_at=now)
            if row["title"]:
                db.insert_news(row)
    except Exception:
        return


async def _fetch_and_store_announcements(symbol: str, limit: int = 50) -> None:
    try:
        from backend.providers.registry import get_registry
        from backend.storage.db import Database

        raw_items = get_registry().get(
            data_type="announcements", market="CN", symbol=symbol, limit=limit
        )
        db = Database()
        now = datetime.now().isoformat()
        for item in raw_items[:limit]:
            row = _to_announcement_row(item, symbol=symbol, fetched_at=now)
            if row["title"]:
                db.insert_announcement(row)
    except Exception:
        return


def _stable_id(prefix: str, *parts: object) -> str:
    raw = "|".join(str(part or "") for part in parts)
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}_{digest}"


def _to_news_row(
    item: dict[str, Any],
    symbol: str = "",
    fetched_at: str = "",
) -> dict[str, Any]:
    title = str(item.get("title", "")).strip()
    published_at = normalize_dt_str(item.get("datetime", item.get("published_at", "")))
    source_url = str(item.get("source_url", item.get("url", ""))).strip()
    symbols = item.get("symbols")
    if not symbols and symbol and symbol.isdigit():
        symbols = [symbol]
    return {
        "id": item.get("id")
        or _stable_id("news", title, published_at, source_url, symbol),
        "title": title,
        "summary": str(item.get("summary", "")).strip(),
        "content": str(item.get("content", item.get("summary", ""))).strip(),
        "source": str(item.get("source", "unknown")).strip() or "unknown",
        "upstream": str(item.get("upstream", item.get("source", ""))).strip(),
        "source_url": source_url,
        "published_at": published_at,
        "fetched_at": fetched_at or datetime.now().isoformat(),
        "symbols": symbols or [],
        "industries": item.get("industries", []),
        "event_type": item.get("event_type", "news"),
        "sentiment": item.get("sentiment", 0),
        "importance": item.get("importance", 0.5),
        "confidence": item.get("confidence", 0.6),
        "license_level": item.get("license_level", "research_only"),
    }


def _to_announcement_row(
    item: dict[str, Any],
    symbol: str,
    fetched_at: str = "",
) -> dict[str, Any]:
    title = str(item.get("title", "")).strip()
    published_at = normalize_dt_str(item.get("datetime", item.get("published_at", "")))
    source_url = str(item.get("source_url", item.get("url", ""))).strip()
    return {
        "id": item.get("id")
        or _stable_id("ann", title, published_at, source_url, symbol),
        "symbol": item.get("symbol", symbol),
        "company_name": item.get("company_name", ""),
        "title": title,
        "category": item.get("category", "other"),
        "published_at": published_at,
        "fetched_at": fetched_at or datetime.now().isoformat(),
        "source": item.get("source", "unknown"),
        "source_url": source_url,
        "pdf_url": item.get("pdf_url", source_url),
        "pdf_hash": item.get("pdf_hash", ""),
        "parsed_text_path": item.get("parsed_text_path", ""),
        "importance": item.get("importance", 0.5),
        "confidence": item.get("confidence", 0.9),
    }
