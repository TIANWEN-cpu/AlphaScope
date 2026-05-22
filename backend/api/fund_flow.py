"""资金流向 API — 个股/大盘资金流向"""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.api import ApiResponse

router = APIRouter(prefix="/api/fund-flow", tags=["fund-flow"])


@router.get("/{symbol}")
def get_fund_flow(symbol: str, days: int = 30):
    """个股资金流向"""
    from backend.fund_flow import (
        fetch_individual_fund_flow,
        summarize_fund_flow,
    )

    df = fetch_individual_fund_flow(symbol, days=days)
    if df is None:
        return ApiResponse(success=False, error="无资金流向数据")

    summary = summarize_fund_flow(df, recent_days=5)

    # 构造每日明细
    records = []
    for _, row in df.iterrows():
        records.append(
            {
                "date": str(row["日期"].date())
                if hasattr(row["日期"], "date")
                else str(row["日期"]),
                "close": float(row.get("收盘价", 0)),
                "change_pct": float(row.get("涨跌幅", 0)),
                "main_net_yi": float(row.get("主力净流入-净额", 0)) / 1e8,
                "main_net_pct": float(row.get("主力净流入-净占比", 0)),
                "super_net_yi": float(row.get("超大单净流入-净额", 0)) / 1e8,
                "large_net_yi": float(row.get("大单净流入-净额", 0)) / 1e8,
                "medium_net_yi": float(row.get("中单净流入-净额", 0)) / 1e8,
                "small_net_yi": float(row.get("小单净流入-净额", 0)) / 1e8,
            }
        )

    return ApiResponse(
        success=True,
        data={"symbol": symbol, "summary": summary, "records": records},
    )


@router.get("/market/overview")
def get_market_fund_flow(days: int = 30):
    """大盘资金流向"""
    from backend.fund_flow import fetch_market_fund_flow, summarize_fund_flow

    df = fetch_market_fund_flow(days=days)
    if df is None:
        return ApiResponse(success=False, error="无大盘资金流向数据")

    summary = summarize_fund_flow(df, recent_days=5)

    records = []
    for _, row in df.iterrows():
        records.append(
            {
                "date": str(row["日期"].date())
                if hasattr(row["日期"], "date")
                else str(row["日期"]),
                "close": float(row.get("上证-收盘价", 0))
                if "上证-收盘价" in row
                else 0,
                "main_net_yi": float(row.get("主力净流入-净额", 0)) / 1e8
                if "主力净流入-净额" in row
                else 0,
            }
        )

    return ApiResponse(
        success=True,
        data={"summary": summary, "records": records},
    )
