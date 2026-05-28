"""Quantitative backtesting engine module.

Local-first architecture:
- engine.py: Core backtesting engine
- strategies.py: Strategy definitions and registry
- risk_controller.py: Risk control checks before execution
- portfolio.py: Portfolio tracking
- metrics.py: Performance metrics calculator
"""

from .engine import BacktestEngine
from .metrics import calc_max_drawdown, calc_sharpe, calc_win_rate
from .portfolio import Portfolio
from .risk_controller import RiskController
from .strategies import (
    BaseStrategy,
    MACDMomentumStrategy,
    MAStrategy,
    RSIStrategy,
    StrategyRegistry,
)

__all__ = [
    "BacktestEngine",
    "BaseStrategy",
    "MACDMomentumStrategy",
    "MAStrategy",
    "RSIStrategy",
    "StrategyRegistry",
    "RiskController",
    "Portfolio",
    "calc_sharpe",
    "calc_max_drawdown",
    "calc_win_rate",
]
