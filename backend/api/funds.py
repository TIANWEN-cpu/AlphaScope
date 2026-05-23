"""基金 API 端点 — 搜索、净值、指标、定投、组合管理"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.funds.dca import DCASimulator
from backend.funds.metrics import calc_fund_metrics
from backend.funds.portfolio import PortfolioManager
from backend.funds.providers import get_provider
from backend.schemas.api import ApiResponse
from backend.schemas.funds import DCAFrequency

router = APIRouter(tags=["funds"])

# 组合管理器（可被覆盖）
_portfolio_mgr: Optional[PortfolioManager] = None


def _get_portfolio_mgr() -> PortfolioManager:
    global _portfolio_mgr
    if _portfolio_mgr is None:
        try:
            from backend.storage.db import Database

            _portfolio_mgr = PortfolioManager(db=Database())
        except Exception:
            _portfolio_mgr = PortfolioManager(db=None)
    return _portfolio_mgr


def set_portfolio_mgr(mgr: PortfolioManager):
    global _portfolio_mgr
    _portfolio_mgr = mgr


# ============================================================
# 请求模型
# ============================================================


class DCASimulateBody(BaseModel):
    """定投模拟请求"""

    fund_code: str = Field(description="基金代码")
    amount: float = Field(description="每期金额")
    frequency: str = Field(
        default="monthly", description="频率: weekly/biweekly/monthly/quarterly"
    )
    start_date: str = Field(description="开始日期 YYYY-MM-DD")
    end_date: str = Field(description="结束日期 YYYY-MM-DD")


class PortfolioCreateBody(BaseModel):
    """创建组合请求"""

    name: str = Field(description="组合名称")
    description: str = Field(default="", description="组合描述")
    holdings: list[dict[str, Any]] = Field(default_factory=list, description="持仓")


class PortfolioUpdateBody(BaseModel):
    """更新组合请求"""

    name: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    holdings: Optional[list[dict[str, Any]]] = Field(default=None)


# ============================================================
# 基金搜索与信息
# ============================================================


@router.get("/api/funds/search")
async def search_funds(keyword: str = ""):
    """搜索基金"""
    if not keyword.strip():
        return ApiResponse(success=True, data={"funds": [], "total": 0})
    provider = get_provider()
    try:
        funds = await provider.search(keyword)
        return ApiResponse(success=True, data={"funds": funds, "total": len(funds)})
    except Exception as e:
        return ApiResponse(
            success=False,
            error=str(e),
            error_code="FUND_SEARCH_ERROR",
            data={"funds": [], "total": 0},
        )


@router.get("/api/funds/{code}")
async def get_fund_info(code: str):
    """获取基金信息"""
    provider = get_provider()
    try:
        info = await provider.get_info(code)
        if not info:
            return ApiResponse(
                success=False,
                error=f"基金 {code} 不存在",
                error_code="FUND_NOT_FOUND",
            )
        return ApiResponse(success=True, data=info)
    except Exception as e:
        return ApiResponse(success=False, error=str(e))


@router.get("/api/funds/{code}/nav")
async def get_fund_nav(
    code: str,
    start_date: str = "",
    end_date: str = "",
):
    """获取基金历史净值"""
    provider = get_provider()
    try:
        records = await provider.get_nav_history(code, start_date, end_date)
        return ApiResponse(
            success=True,
            data={
                "code": code,
                "navs": records,
                "total": len(records),
            },
        )
    except Exception as e:
        return ApiResponse(
            success=False,
            error=str(e),
            data={"code": code, "navs": [], "total": 0},
        )


@router.get("/api/funds/{code}/metrics")
async def get_fund_metrics(code: str):
    """获取基金指标"""
    provider = get_provider()
    try:
        records = await provider.get_nav_history(code)
        if not records:
            return ApiResponse(
                success=False,
                error="无净值数据",
                error_code="FUND_NO_DATA",
            )
        navs = [r["nav"] for r in records]
        metrics = calc_fund_metrics(navs)
        metrics["code"] = code
        return ApiResponse(success=True, data=metrics)
    except Exception as e:
        return ApiResponse(success=False, error=str(e))


# ============================================================
# 定投模拟
# ============================================================


@router.post("/api/fund-dca/simulate")
async def simulate_dca(body: DCASimulateBody):
    """定投模拟"""
    provider = get_provider()
    try:
        records = await provider.get_nav_history(
            body.fund_code, body.start_date, body.end_date
        )
        if not records:
            return ApiResponse(
                success=False,
                error="无净值数据，无法模拟",
                error_code="FUND_NO_DATA",
            )

        freq_map = {
            "weekly": DCAFrequency.WEEKLY,
            "biweekly": DCAFrequency.BIWEEKLY,
            "monthly": DCAFrequency.MONTHLY,
            "quarterly": DCAFrequency.QUARTERLY,
        }
        frequency = freq_map.get(body.frequency, DCAFrequency.MONTHLY)

        simulator = DCASimulator()
        result = simulator.simulate(
            nav_records=records,
            amount=body.amount,
            frequency=frequency,
            start_date=body.start_date,
            end_date=body.end_date,
        )
        result.fund_code = body.fund_code
        return ApiResponse(success=True, data=result.model_dump())
    except Exception as e:
        return ApiResponse(success=False, error=str(e))


# ============================================================
# 组合管理
# ============================================================


@router.get("/api/fund-portfolio")
async def list_portfolios():
    """列出所有组合"""
    mgr = _get_portfolio_mgr()
    portfolios = mgr.list_all()
    return ApiResponse(
        success=True,
        data={"portfolios": portfolios, "total": len(portfolios)},
    )


@router.post("/api/fund-portfolio")
async def create_portfolio(body: PortfolioCreateBody):
    """创建组合"""
    mgr = _get_portfolio_mgr()
    portfolio = mgr.create(
        name=body.name,
        description=body.description,
        holdings=body.holdings,
    )
    return ApiResponse(success=True, data=portfolio)


@router.get("/api/fund-portfolio/{portfolio_id}")
async def get_portfolio(portfolio_id: str):
    """获取组合详情"""
    mgr = _get_portfolio_mgr()
    portfolio = mgr.get(portfolio_id)
    if not portfolio:
        return ApiResponse(
            success=False,
            error="组合不存在",
            error_code="PORTFOLIO_NOT_FOUND",
        )
    return ApiResponse(success=True, data=portfolio)


@router.put("/api/fund-portfolio/{portfolio_id}")
async def update_portfolio(portfolio_id: str, body: PortfolioUpdateBody):
    """更新组合"""
    mgr = _get_portfolio_mgr()
    portfolio = mgr.update(
        portfolio_id=portfolio_id,
        name=body.name,
        description=body.description,
        holdings=body.holdings,
    )
    if not portfolio:
        return ApiResponse(
            success=False,
            error="组合不存在",
            error_code="PORTFOLIO_NOT_FOUND",
        )
    return ApiResponse(success=True, data=portfolio)


@router.delete("/api/fund-portfolio/{portfolio_id}")
async def delete_portfolio(portfolio_id: str):
    """删除组合"""
    mgr = _get_portfolio_mgr()
    ok = mgr.delete(portfolio_id)
    if not ok:
        return ApiResponse(
            success=False,
            error="组合不存在",
            error_code="PORTFOLIO_NOT_FOUND",
        )
    return ApiResponse(success=True, data={"deleted": True})
