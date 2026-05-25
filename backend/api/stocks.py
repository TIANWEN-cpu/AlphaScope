"""股票身份解析 API。"""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.api import ApiResponse
from backend.stock_resolver import resolve_stock

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


@router.get("/resolve")
def resolve_stock_query(q: str):
    """把用户输入解析为统一股票身份。"""
    result = resolve_stock(q)
    if not result.get("symbol"):
        return ApiResponse(success=False, data=result, error="未识别到有效股票代码")
    return ApiResponse(success=True, data=result)


@router.get("/{symbol}")
def get_stock_identity(symbol: str):
    """按代码获取股票身份。"""
    result = resolve_stock(symbol)
    if not result.get("symbol"):
        return ApiResponse(success=False, data=result, error="未识别到有效股票代码")
    return ApiResponse(success=True, data=result)
