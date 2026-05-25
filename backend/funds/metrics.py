"""基金指标计算 — 纯函数，无外部依赖"""

from __future__ import annotations

import math
from typing import Any


def calc_nav_returns(navs: list[float]) -> list[float]:
    """计算净值序列的日收益率"""
    if len(navs) < 2:
        return []
    returns = []
    for i in range(1, len(navs)):
        if navs[i - 1] > 0:
            returns.append(navs[i] / navs[i - 1] - 1)
        else:
            returns.append(0.0)
    return returns


def calc_total_return(navs: list[float]) -> float:
    """计算总收益率"""
    if len(navs) < 2 or navs[0] <= 0:
        return 0.0
    return navs[-1] / navs[0] - 1


def calc_annualized_return(total_return: float, days: int) -> float:
    """计算年化收益率"""
    if days <= 0:
        return 0.0
    return (1 + total_return) ** (365.0 / days) - 1


def calc_volatility(returns: list[float], annualize: bool = True) -> float:
    """计算波动率"""
    if len(returns) < 2:
        return 0.0
    mean = sum(returns) / len(returns)
    variance = sum((r - mean) ** 2 for r in returns) / (len(returns) - 1)
    vol = math.sqrt(variance)
    if annualize:
        vol *= math.sqrt(252)
    return vol


def calc_max_drawdown(navs: list[float]) -> float:
    """计算最大回撤（返回正数表示回撤幅度）"""
    if len(navs) < 2:
        return 0.0
    peak = navs[0]
    max_dd = 0.0
    for nav in navs:
        if nav > peak:
            peak = nav
        if peak > 0:
            dd = (peak - nav) / peak
            if dd > max_dd:
                max_dd = dd
    return max_dd


def calc_sharpe_ratio(returns: list[float], risk_free_rate: float = 0.03) -> float:
    """计算夏普比率"""
    if len(returns) < 2:
        return 0.0
    vol = calc_volatility(returns, annualize=True)
    annual_return = sum(returns) / len(returns) * 252
    excess_return = annual_return - risk_free_rate
    if vol <= 0:
        return excess_return
    return excess_return / vol


def calc_calmar_ratio(total_return: float, max_drawdown: float) -> float:
    """计算卡玛比率"""
    if max_drawdown <= 0:
        return 0.0
    return total_return / max_drawdown


def calc_win_rate(returns: list[float]) -> float:
    """计算胜率（正收益天数占比）"""
    if not returns:
        return 0.0
    positive = sum(1 for r in returns if r > 0)
    return positive / len(returns)


def calc_fund_metrics(
    navs: list[float],
    risk_free_rate: float = 0.03,
) -> dict[str, Any]:
    """计算基金综合指标"""
    if len(navs) < 2:
        return {
            "total_return": 0.0,
            "annualized_return": 0.0,
            "volatility": 0.0,
            "max_drawdown": 0.0,
            "sharpe_ratio": 0.0,
            "calmar_ratio": 0.0,
            "win_rate": 0.0,
            "data_points": len(navs),
        }

    returns = calc_nav_returns(navs)
    total_return = calc_total_return(navs)
    days = len(navs)
    annualized_return = calc_annualized_return(total_return, days)
    volatility = calc_volatility(returns)
    max_drawdown = calc_max_drawdown(navs)
    sharpe = calc_sharpe_ratio(returns, risk_free_rate)
    calmar = calc_calmar_ratio(annualized_return, max_drawdown)
    win = calc_win_rate(returns)

    return {
        "total_return": round(total_return, 6),
        "annualized_return": round(annualized_return, 6),
        "volatility": round(volatility, 6),
        "max_drawdown": round(max_drawdown, 6),
        "sharpe_ratio": round(sharpe, 4),
        "calmar_ratio": round(calmar, 4),
        "win_rate": round(win, 4),
        "data_points": len(navs),
    }
