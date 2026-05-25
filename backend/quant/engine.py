"""Core backtesting engine - runs strategies against historical price data."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .metrics import build_performance_summary
from .portfolio import Portfolio, Trade
from .risk_controller import RiskConfig, RiskController
from .strategies import BaseStrategy, Signal, StrategyRegistry


@dataclass
class BacktestResult:
    """Result of a backtest run."""

    strategy_name: str
    symbol: str
    params: dict[str, Any]
    equity_curve: list[float]
    dates: list[str]
    trades: list[dict[str, Any]]
    performance: dict[str, Any]
    risk_violations: list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return {
            "strategy_name": self.strategy_name,
            "symbol": self.symbol,
            "params": self.params,
            "equity_curve": self.equity_curve,
            "dates": self.dates,
            "trades": self.trades,
            "performance": self.performance,
            "risk_violations": self.risk_violations,
        }


class BacktestEngine:
    """Core backtesting engine.

    Runs a strategy against historical price bars with portfolio simulation
    and risk control.
    """

    def __init__(
        self,
        initial_capital: float = 100000.0,
        commission_rate: float = 0.001,
        risk_config: RiskConfig | None = None,
    ):
        self.initial_capital = initial_capital
        self.commission_rate = commission_rate
        self.risk_config = risk_config or RiskConfig()

    def run(
        self,
        strategy: BaseStrategy,
        bars: list[dict[str, Any]],
        symbol: str = "",
    ) -> BacktestResult:
        """Run a backtest.

        Args:
            strategy: Strategy instance to generate signals
            bars: Historical OHLCV bars (must have 'date', 'open', 'high', 'low', 'close')
            symbol: Stock symbol for labeling

        Returns:
            BacktestResult with equity curve, trades, and performance metrics
        """
        if not bars:
            return BacktestResult(
                strategy_name=strategy.name,
                symbol=symbol,
                params=strategy.params,
                equity_curve=[self.initial_capital],
                dates=[],
                trades=[],
                performance={},
                risk_violations=[],
            )

        # Add symbol to bars for signal generation
        for bar in bars:
            bar.setdefault("symbol", symbol)

        portfolio = Portfolio(
            initial_capital=self.initial_capital,
            commission_rate=self.commission_rate,
        )
        risk_controller = RiskController(self.risk_config)

        # Generate all signals
        signals = strategy.generate_signals(bars, {"equity": portfolio.get_equity()})

        # Execute signals bar by bar
        for i, bar in enumerate(bars):
            date = bar.get("date", f"day_{i}")
            price = bar["close"]

            # Update position prices
            portfolio.update_prices({symbol: price})

            # Check risk limits before processing signal
            dd_check = risk_controller.check_drawdown(portfolio.equity_history)
            if not dd_check.allowed:
                risk_controller.record_violation(dd_check.rule, dd_check.reason, date)
                portfolio.record_equity(date)
                continue

            if i < len(signals):
                signal = signals[i]
                self._execute_signal(signal, portfolio, risk_controller, price, date)

            portfolio.record_equity(date)

        # Build performance summary
        days = len(bars)
        performance = build_performance_summary(
            equity_curve=portfolio.equity_history,
            trades=[self._trade_to_dict(t) for t in portfolio.trades],
            initial_capital=self.initial_capital,
            days=days,
        )

        return BacktestResult(
            strategy_name=strategy.name,
            symbol=symbol,
            params=strategy.params,
            equity_curve=portfolio.equity_history,
            dates=[bar.get("date", "") for bar in bars],
            trades=[self._trade_to_dict(t) for t in portfolio.trades],
            performance=performance,
            risk_violations=risk_controller.violations,
        )

    def _execute_signal(
        self,
        signal: Signal,
        portfolio: Portfolio,
        risk_controller: RiskController,
        price: float,
        date: str,
    ) -> None:
        """Execute a trading signal with risk checks."""
        if signal.action == "buy" and signal.shares > 0:
            check = risk_controller.validate_buy(
                symbol=signal.symbol,
                shares=signal.shares,
                price=price,
                equity=portfolio.get_equity(),
                current_positions=portfolio.positions,
            )
            if check.allowed:
                portfolio.execute_buy(signal.symbol, signal.shares, price, date)
            else:
                risk_controller.record_violation(check.rule, check.reason, date)

        elif signal.action == "sell" and signal.symbol in portfolio.positions:
            check = risk_controller.validate_sell(
                symbol=signal.symbol,
                shares=portfolio.positions[signal.symbol].shares,
                current_positions=portfolio.positions,
            )
            if check.allowed:
                shares = portfolio.positions[signal.symbol].shares
                portfolio.execute_sell(signal.symbol, shares, price, date)
            else:
                risk_controller.record_violation(check.rule, check.reason, date)

    @staticmethod
    def _trade_to_dict(trade: Trade) -> dict[str, Any]:
        return {
            "symbol": trade.symbol,
            "side": trade.side,
            "shares": trade.shares,
            "price": trade.price,
            "commission": round(trade.commission, 2),
            "pnl": round(trade.pnl, 2),
            "timestamp": trade.timestamp,
        }


def run_quick_backtest(
    strategy_name: str,
    bars: list[dict[str, Any]],
    symbol: str = "",
    initial_capital: float = 100000.0,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Convenience function to run a quick backtest.

    Returns the result as a dict for direct API response.
    """
    strategy = StrategyRegistry.create(strategy_name, params)
    if not strategy:
        return {"error": f"Unknown strategy: {strategy_name}"}

    engine = BacktestEngine(initial_capital=initial_capital)
    result = engine.run(strategy, bars, symbol)
    return result.to_dict()
