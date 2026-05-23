"""Performance metrics calculator - pure functions, no external dependencies."""

from __future__ import annotations

import math
from typing import Any


def calc_returns(equity_curve: list[float]) -> list[float]:
    """Calculate period-over-period returns from equity curve."""
    if len(equity_curve) < 2:
        return []
    return [
        (equity_curve[i] - equity_curve[i - 1]) / equity_curve[i - 1]
        for i in range(1, len(equity_curve))
    ]


def calc_sharpe(
    returns: list[float], risk_free_rate: float = 0.03, periods_per_year: int = 252
) -> float:
    """Annualized Sharpe ratio."""
    if not returns:
        return 0.0
    mean_ret = sum(returns) / len(returns)
    if len(returns) < 2:
        return 0.0
    variance = sum((r - mean_ret) ** 2 for r in returns) / (len(returns) - 1)
    std_ret = math.sqrt(variance) if variance > 0 else 0.0
    if std_ret == 0:
        return 0.0
    daily_rf = risk_free_rate / periods_per_year
    return (mean_ret - daily_rf) / std_ret * math.sqrt(periods_per_year)


def calc_max_drawdown(equity_curve: list[float]) -> float:
    """Maximum drawdown as a negative fraction (e.g., -0.12 = -12%)."""
    if len(equity_curve) < 2:
        return 0.0
    peak = equity_curve[0]
    max_dd = 0.0
    for val in equity_curve:
        if val > peak:
            peak = val
        dd = (val - peak) / peak if peak > 0 else 0.0
        if dd < max_dd:
            max_dd = dd
    return max_dd


def calc_annualized_return(total_return: float, days: int) -> float:
    """Annualized return from total return and holding days."""
    if days <= 0:
        return 0.0
    return (1 + total_return) ** (365.0 / days) - 1


def calc_win_rate(trades: list[dict[str, Any]]) -> float:
    """Win rate: fraction of profitable trades."""
    if not trades:
        return 0.0
    wins = sum(1 for t in trades if t.get("pnl", 0) > 0)
    return wins / len(trades)


def calc_profit_factor(trades: list[dict[str, Any]]) -> float:
    """Profit factor: gross profit / gross loss."""
    gross_profit = sum(t["pnl"] for t in trades if t.get("pnl", 0) > 0)
    gross_loss = abs(sum(t["pnl"] for t in trades if t.get("pnl", 0) < 0))
    if gross_loss == 0:
        return float("inf") if gross_profit > 0 else 0.0
    return gross_profit / gross_loss


def calc_total_return(initial_capital: float, final_equity: float) -> float:
    """Total return as a fraction."""
    if initial_capital <= 0:
        return 0.0
    return (final_equity - initial_capital) / initial_capital


def calc_sortino(
    returns: list[float], risk_free_rate: float = 0.03, periods_per_year: int = 252
) -> float:
    """Sortino ratio: like Sharpe but only penalizes downside volatility."""
    if not returns or len(returns) < 2:
        return 0.0
    mean_ret = sum(returns) / len(returns)
    daily_rf = risk_free_rate / periods_per_year
    downside = [min(0, r - daily_rf) ** 2 for r in returns]
    downside_dev = math.sqrt(sum(downside) / len(downside)) if downside else 0.0
    if downside_dev == 0:
        return 0.0
    return (mean_ret - daily_rf) / downside_dev * math.sqrt(periods_per_year)


def calc_calmar(total_return: float, max_drawdown: float, days: int) -> float:
    """Calmar ratio: annualized return / max drawdown."""
    if max_drawdown == 0 or days <= 0:
        return 0.0
    ann_ret = calc_annualized_return(total_return, days)
    return ann_ret / abs(max_drawdown)


def build_performance_summary(
    equity_curve: list[float],
    trades: list[dict[str, Any]],
    initial_capital: float,
    days: int,
) -> dict[str, Any]:
    """Build a complete performance summary from equity curve and trades."""
    returns = calc_returns(equity_curve)
    final_equity = equity_curve[-1] if equity_curve else initial_capital
    total_ret = calc_total_return(initial_capital, final_equity)
    max_dd = calc_max_drawdown(equity_curve)

    return {
        "total_return": round(total_ret * 100, 2),
        "annualized_return": round(calc_annualized_return(total_ret, days) * 100, 2),
        "max_drawdown": round(max_dd * 100, 2),
        "sharpe_ratio": round(calc_sharpe(returns), 2),
        "sortino_ratio": round(calc_sortino(returns), 2),
        "calmar_ratio": round(calc_calmar(total_ret, max_dd, days), 2),
        "win_rate": round(calc_win_rate(trades) * 100, 2),
        "profit_factor": round(calc_profit_factor(trades), 2),
        "total_trades": len(trades),
        "initial_capital": initial_capital,
        "final_equity": round(final_equity, 2),
        "trading_days": days,
    }
