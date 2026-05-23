"""基金与定投模块"""

from .dca import DCASimulator
from .metrics import calc_fund_metrics
from .portfolio import PortfolioManager

__all__ = [
    "DCASimulator",
    "calc_fund_metrics",
    "PortfolioManager",
]
