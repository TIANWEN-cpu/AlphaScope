"""自选股 API — 自选晨报的后端持久化(GET/POST/DELETE)。纯新增。"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.schemas.api import ApiResponse

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class WatchAddRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    name: str = Field(default="", max_length=80)


@router.get("")
def get_watchlist():
    """列出自选股。"""
    from backend.watchlist_store import list_watchlist

    return ApiResponse(success=True, data={"items": list_watchlist()})


@router.post("")
def post_watchlist(req: WatchAddRequest):
    """加入一只自选股。"""
    from backend.watchlist_store import add_watchlist, list_watchlist

    add_watchlist(req.symbol, req.name)
    return ApiResponse(success=True, data={"items": list_watchlist()})


@router.delete("/{symbol}")
def delete_watchlist(symbol: str):
    """移出一只自选股。"""
    from backend.watchlist_store import list_watchlist, remove_watchlist

    remove_watchlist(symbol)
    return ApiResponse(success=True, data={"items": list_watchlist()})
