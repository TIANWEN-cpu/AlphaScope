"""量化因子 API — 因子报告、批量分析"""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.api import ApiResponse

router = APIRouter(prefix="/api/factors", tags=["factors"])


@router.get("/{symbol}")
def get_factors(symbol: str, stock_name: str = "", days: int = 30):
    """获取单只股票的量化因子报告"""
    from backend.factors.generator import generate_factor_report

    report = generate_factor_report(symbol, stock_name=stock_name, days=days)
    return ApiResponse(success=True, data=report.to_dict())


@router.post("/batch")
def get_factors_batch(
    symbols: list[str],
    stock_names: dict[str, str] | None = None,
    days: int = 30,
):
    """批量获取量化因子报告"""
    from backend.factors.generator import generate_factor_batch

    reports = generate_factor_batch(symbols, stock_names=stock_names, days=days)
    return ApiResponse(
        success=True,
        data={"reports": [r.to_dict() for r in reports], "total": len(reports)},
    )
