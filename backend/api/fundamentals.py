"""基本面分析 API — 估值/盈利质量/现金流/行业对比/股东结构"""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.api import ApiResponse

router = APIRouter(prefix="/api/fundamentals", tags=["fundamentals"])


@router.get("/{symbol}")
async def get_fundamentals(symbol: str):
    """综合基本面分析"""
    from backend.fundamentals import (
        analyze_balance_sheet,
        analyze_cash_flow,
        assess_earnings_quality,
        calc_valuation_metrics,
        compute_fundamental_score,
        load_fundamentals,
    )

    data = load_fundamentals(symbol)
    if data.has_error:
        return ApiResponse(success=False, error=data.error_msg)

    # 从财务摘要取最新一期数据
    latest = data.financial_periods[0] if data.financial_periods else None
    pe = data.peers[0].pe if data.peers else 0
    pb = data.peers[0].pb if data.peers else 0

    valuation = calc_valuation_metrics(
        pe=pe,
        pb=pb,
        revenue_yi=latest.revenue_yi if latest else 0,
        net_profit_yi=latest.net_profit_yi if latest else 0,
    )
    earnings = assess_earnings_quality(net_profit=latest.net_profit_yi if latest else 0)
    cashflow = analyze_cash_flow(net_profit=latest.net_profit_yi if latest else 0)
    balance = analyze_balance_sheet(debt_ratio=latest.debt_ratio_pct if latest else 0)
    score = compute_fundamental_score(valuation, earnings, cashflow, balance)

    return ApiResponse(
        success=True,
        data={
            "symbol": symbol,
            "financial_periods": [
                {
                    "period": p.period,
                    "revenue_yi": p.revenue_yi,
                    "net_profit_yi": p.net_profit_yi,
                    "gross_margin_pct": p.gross_margin_pct,
                    "roe_pct": p.roe_pct,
                    "debt_ratio_pct": p.debt_ratio_pct,
                    "yoy_revenue_pct": p.yoy_revenue_pct,
                    "yoy_net_profit_pct": p.yoy_net_profit_pct,
                }
                for p in data.financial_periods
            ],
            "valuation": valuation,
            "earnings_quality": earnings,
            "cashflow": cashflow,
            "balance_sheet": balance,
            "fundamental_score": score,
        },
    )


@router.get("/{symbol}/valuation")
async def get_valuation(symbol: str):
    """估值指标"""
    from backend.fundamentals import (
        calc_valuation_metrics,
        load_fundamentals,
    )

    data = load_fundamentals(symbol)
    if data.has_error:
        return ApiResponse(success=False, error=data.error_msg)

    latest = data.financial_periods[0] if data.financial_periods else None
    pe = data.peers[0].pe if data.peers else 0
    pb = data.peers[0].pb if data.peers else 0
    mcap = data.peers[0].total_mcap_yi if data.peers else 0

    valuation = calc_valuation_metrics(
        pe=pe,
        pb=pb,
        revenue_yi=latest.revenue_yi if latest else 0,
        net_profit_yi=latest.net_profit_yi if latest else 0,
        market_cap_yi=mcap,
    )
    return ApiResponse(success=True, data={"symbol": symbol, **valuation})


@router.get("/{symbol}/peers")
async def get_peers(symbol: str):
    """行业对比"""
    from backend.fundamentals import fetch_industry_peers

    industry, peers = fetch_industry_peers(symbol)
    return ApiResponse(
        success=True,
        data={
            "symbol": symbol,
            "industry": industry,
            "peers": [
                {
                    "symbol": p.symbol,
                    "name": p.name,
                    "total_mcap_yi": p.total_mcap_yi,
                    "pe": p.pe,
                    "pb": p.pb,
                    "is_self": p.is_self,
                }
                for p in peers
            ],
        },
    )


@router.get("/{symbol}/shareholders")
async def get_shareholders(symbol: str):
    """股东结构"""
    from backend.fundamentals import (
        fetch_circulate_holders,
        fetch_inst_changes,
        fetch_top_holders,
    )

    top = fetch_top_holders(symbol)
    circ = fetch_circulate_holders(symbol)
    inst = fetch_inst_changes(symbol)

    def _sh(h):
        return {
            "rank": h.rank,
            "name": h.name,
            "shares_yi": h.shares_yi,
            "ratio_pct": h.ratio_pct,
            "change_type": h.change_type,
        }

    return ApiResponse(
        success=True,
        data={
            "symbol": symbol,
            "top_holders": [_sh(h) for h in top],
            "circulate_holders": [_sh(h) for h in circ],
            "institutional_changes": [_sh(h) for h in inst],
        },
    )
