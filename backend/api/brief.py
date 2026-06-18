"""自选晨报 API — 为一组标的聚合最新价 + 涨跌幅 + 近期新闻(本地库,快)。

供前端"自选晨报"面板。自选列表由前端 localStorage 维护,这里只按传入的
symbols 聚合本地已有数据。纯新增,不改动既有功能。
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Query

from backend.schemas.api import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/brief", tags=["brief"])


def _latest_bar(bars: list[dict]) -> dict | None:
    if not bars:
        return None
    return sorted(bars, key=lambda b: str(b.get("date", "")))[-1]


@router.get("")
def morning_brief(symbols: str = Query(default="", description="逗号分隔的标的代码")):
    """为自选标的聚合简报:最新收盘价、涨跌幅、近期新闻标题(均取本地已缓存数据)。"""
    from backend.news_store import list_news
    from backend.price_store import get_prices

    syms = [s.strip() for s in symbols.split(",") if s.strip()][:30]
    items = []
    for sym in syms:
        close = change_pct = date = None
        try:
            bar = _latest_bar(get_prices(sym, limit=5) or [])
            if bar:
                close = bar.get("close")
                change_pct = bar.get("change_pct")
                date = bar.get("date")
        except Exception as exc:  # 单只失败不影响其余(本地数据缺失常见)
            logger.debug("[brief] %s 行情缺失: %s", sym, exc)

        news = []
        try:
            for n in list_news(symbol=sym, limit=3) or []:
                news.append(
                    {
                        "title": n.get("title", ""),
                        "published_at": n.get("published_at", ""),
                        "url": n.get("url", ""),
                    }
                )
        except Exception as exc:
            logger.debug("[brief] %s 新闻缺失: %s", sym, exc)

        items.append(
            {
                "symbol": sym,
                "close": close,
                "change_pct": change_pct,
                "date": date,
                "news": news,
                "news_count": len(news),
            }
        )

    return ApiResponse(success=True, data={"items": items, "count": len(items)})
