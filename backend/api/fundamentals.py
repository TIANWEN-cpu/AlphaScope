"""基本面分析 API — 估值/盈利质量/现金流/行业对比/股东结构"""

from __future__ import annotations

from fastapi import APIRouter

from backend.provider_timeout import call_with_timeout
from backend.schemas.api import ApiResponse

router = APIRouter(prefix="/api/fundamentals", tags=["fundamentals"])

FUNDAMENTALS_TIMEOUT_SECONDS = 10.0


def _empty_fundamentals(symbol: str, source_status: str, error: str = "") -> dict:
    return {
        "symbol": symbol,
        "stock_name": "",
        "industry": "",
        "financial_periods": [],
        "valuation": {},
        "earnings_quality": {},
        "cashflow": {},
        "balance_sheet": {},
        "fundamental_score": {},
        "peers": [],
        "degraded": True,
        "source_status": source_status,
        "error": error,
    }


def _run_fundamentals(fn, *, name: str):
    return call_with_timeout(
        fn,
        FUNDAMENTALS_TIMEOUT_SECONDS,
        name=f"fundamentals-{name}",
    )


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

    try:
        data = _run_fundamentals(lambda: load_fundamentals(symbol), name="summary")
    except TimeoutError as exc:
        return ApiResponse(
            success=True,
            data=_empty_fundamentals(symbol, "timeout", str(exc)),
            error="基本面数据源响应超时，已降级为空数据",
            error_code="FUNDAMENTALS_DEGRADED",
        )
    except Exception as exc:
        return ApiResponse(
            success=True,
            data=_empty_fundamentals(symbol, "unavailable", str(exc)),
            error="基本面数据源暂不可用，已降级为空数据",
            error_code="FUNDAMENTALS_DEGRADED",
        )
    if data.has_error:
        return ApiResponse(
            success=True,
            data=_empty_fundamentals(symbol, "empty", data.error_msg),
            error=data.error_msg,
            error_code="FUNDAMENTALS_DEGRADED",
        )

    # 从财务摘要取最新一期数据
    latest = data.financials[0] if data.financials else None
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
            "stock_name": data.stock_name,
            "industry": data.industry_name,
            "financial_periods": [
                {
                    "period": p.period,
                    "revenue_yi": p.revenue_yi,
                    "net_profit_yi": p.net_profit_yi,
                    "gross_margin_pct": p.gross_margin_pct,
                    "roe_pct": p.roe_pct,
                    "debt_ratio_pct": p.debt_ratio_pct,
                    "yoy_revenue_pct": p.yoy_revenue,
                    "yoy_net_profit_pct": p.yoy_net_profit,
                }
                for p in data.financials
            ],
            "valuation": valuation,
            "earnings_quality": earnings,
            "cashflow": cashflow,
            "balance_sheet": balance,
            "fundamental_score": score,
            "peers": [
                {
                    "symbol": p.symbol,
                    "name": p.name,
                    "pe": p.pe,
                    "pb": p.pb,
                    "total_mcap_yi": p.total_mcap_yi,
                    "is_self": p.is_self,
                }
                for p in data.peers
            ],
            "degraded": False,
            "source_status": "ok",
        },
    )


@router.get("/{symbol}/valuation")
async def get_valuation(symbol: str):
    """估值指标"""
    from backend.fundamentals import (
        calc_valuation_metrics,
        load_fundamentals,
    )

    try:
        data = _run_fundamentals(lambda: load_fundamentals(symbol), name="valuation")
    except TimeoutError as exc:
        return ApiResponse(
            success=True,
            data={"symbol": symbol, "degraded": True, "source_status": "timeout"},
            error=str(exc),
            error_code="FUNDAMENTALS_DEGRADED",
        )
    except Exception as exc:
        return ApiResponse(
            success=True,
            data={"symbol": symbol, "degraded": True, "source_status": "unavailable"},
            error=str(exc),
            error_code="FUNDAMENTALS_DEGRADED",
        )
    if data.has_error:
        return ApiResponse(
            success=True,
            data={"symbol": symbol, "degraded": True, "source_status": "empty"},
            error=data.error_msg,
            error_code="FUNDAMENTALS_DEGRADED",
        )

    latest = data.financials[0] if data.financials else None
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

    try:
        industry, peers = _run_fundamentals(
            lambda: fetch_industry_peers(symbol),
            name="peers",
        )
        degraded = False
        source_status = "ok"
        error = None
        error_code = None
    except TimeoutError as exc:
        industry, peers = "", []
        degraded = True
        source_status = "timeout"
        error = str(exc)
        error_code = "FUNDAMENTALS_DEGRADED"
    except Exception as exc:
        industry, peers = "", []
        degraded = True
        source_status = "unavailable"
        error = str(exc)
        error_code = "FUNDAMENTALS_DEGRADED"
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
            "degraded": degraded,
            "source_status": source_status,
        },
        error=error,
        error_code=error_code,
    )


@router.get("/{symbol}/shareholders")
async def get_shareholders(symbol: str):
    """股东结构"""
    from backend.fundamentals import (
        fetch_circulate_holders,
        fetch_inst_changes,
        fetch_top_holders,
    )

    try:
        top, circ, inst = _run_fundamentals(
            lambda: (
                fetch_top_holders(symbol),
                fetch_circulate_holders(symbol),
                fetch_inst_changes(symbol),
            ),
            name="shareholders",
        )
        degraded = False
        source_status = "ok"
        error = None
        error_code = None
    except TimeoutError as exc:
        top, circ, inst = [], [], []
        degraded = True
        source_status = "timeout"
        error = str(exc)
        error_code = "FUNDAMENTALS_DEGRADED"
    except Exception as exc:
        top, circ, inst = [], [], []
        degraded = True
        source_status = "unavailable"
        error = str(exc)
        error_code = "FUNDAMENTALS_DEGRADED"

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
            "degraded": degraded,
            "source_status": source_status,
        },
        error=error,
        error_code=error_code,
    )
