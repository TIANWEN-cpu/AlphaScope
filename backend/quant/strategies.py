"""Strategy definitions and registry for the backtesting engine."""

from __future__ import annotations

import math
from abc import ABC, abstractmethod
from typing import Any


class Signal:
    """A trading signal."""

    def __init__(self, action: str, symbol: str, shares: int = 0, reason: str = ""):
        self.action = action  # "buy", "sell", "hold"
        self.symbol = symbol
        self.shares = shares
        self.reason = reason

    def __repr__(self) -> str:
        return f"Signal({self.action}, {self.symbol}, shares={self.shares})"


class BaseStrategy(ABC):
    """Abstract base class for strategies."""

    name: str = "base"
    description: str = ""
    default_params: dict[str, Any] = {}

    def __init__(self, params: dict[str, Any] | None = None):
        self.params = {**self.default_params, **(params or {})}

    @abstractmethod
    def generate_signals(
        self, bars: list[dict], portfolio_state: dict[str, Any] | None = None
    ) -> list[Signal]:
        """Generate trading signals from price bars.

        Args:
            bars: List of OHLCV dicts with keys: date, open, high, low, close, volume
            portfolio_state: Optional current portfolio state for context

        Returns:
            List of Signal objects
        """
        ...

    def _closes(self, bars: list[dict]) -> list[float]:
        return [b["close"] for b in bars]

    def _volumes(self, bars: list[dict]) -> list[float]:
        return [float(b.get("volume", 0)) for b in bars]

    @staticmethod
    def _sma(values: list[float], period: int) -> list[float]:
        result = []
        for i in range(len(values)):
            if i < period - 1:
                result.append(float("nan"))
            else:
                result.append(sum(values[i - period + 1 : i + 1]) / period)
        return result

    @staticmethod
    def _ema(values: list[float], period: int) -> list[float]:
        if not values:
            return []
        result = [values[0]]
        multiplier = 2.0 / (period + 1)
        for i in range(1, len(values)):
            result.append(values[i] * multiplier + result[-1] * (1 - multiplier))
        return result


class MACDMomentumStrategy(BaseStrategy):
    """MACD momentum strategy - buy on golden cross, sell on death cross."""

    name = "macd_momentum"
    description = "MACD 动量策略: 金叉买入，死叉卖出"
    default_params = {
        "fast_period": 12,
        "slow_period": 26,
        "signal_period": 9,
        "position_size_pct": 20,
    }

    def generate_signals(
        self, bars: list[dict], portfolio_state: dict[str, Any] | None = None
    ) -> list[Signal]:
        if len(bars) < self.params["slow_period"] + self.params["signal_period"]:
            return []

        closes = self._closes(bars)
        fast_ema = self._ema(closes, self.params["fast_period"])
        slow_ema = self._ema(closes, self.params["slow_period"])

        macd_line = [fast_ema[i] - slow_ema[i] for i in range(len(closes))]
        signal_line = self._ema(macd_line, self.params["signal_period"])

        signals = []
        for i in range(1, len(bars)):
            if i < self.params["slow_period"] + self.params["signal_period"]:
                signals.append(
                    Signal("hold", bars[i].get("symbol", ""), reason="数据不足")
                )
                continue

            prev_macd = macd_line[i - 1]
            curr_macd = macd_line[i]
            prev_signal = signal_line[i - 1]
            curr_signal = signal_line[i]

            # Golden cross: MACD crosses above signal line
            if prev_macd <= prev_signal and curr_macd > curr_signal:
                shares = self._calc_shares(bars[i]["close"], portfolio_state)
                signals.append(
                    Signal(
                        "buy",
                        bars[i].get("symbol", ""),
                        shares=shares,
                        reason="MACD 金叉",
                    )
                )
            # Death cross: MACD crosses below signal line
            elif prev_macd >= prev_signal and curr_macd < curr_signal:
                signals.append(
                    Signal("sell", bars[i].get("symbol", ""), reason="MACD 死叉")
                )
            else:
                signals.append(
                    Signal("hold", bars[i].get("symbol", ""), reason="无信号")
                )

        return signals

    def _calc_shares(self, price: float, state: dict[str, Any] | None) -> int:
        if not state or price <= 0:
            return 0
        equity = state.get("equity", 100000)
        budget = equity * self.params["position_size_pct"] / 100
        return max(0, int(budget / price / 100) * 100)  # Round to lots of 100


class MAStrategy(BaseStrategy):
    """Moving average crossover strategy."""

    name = "ma_crossover"
    description = "均线交叉策略: 短期均线上穿长期均线买入，下穿卖出"
    default_params = {
        "short_period": 5,
        "long_period": 20,
        "position_size_pct": 20,
    }

    def generate_signals(
        self, bars: list[dict], portfolio_state: dict[str, Any] | None = None
    ) -> list[Signal]:
        if len(bars) < self.params["long_period"]:
            return []

        closes = self._closes(bars)
        short_ma = self._sma(closes, self.params["short_period"])
        long_ma = self._sma(closes, self.params["long_period"])

        signals = []
        for i in range(1, len(bars)):
            if i < self.params["long_period"]:
                signals.append(
                    Signal("hold", bars[i].get("symbol", ""), reason="数据不足")
                )
                continue

            prev_short = short_ma[i - 1]
            curr_short = short_ma[i]
            prev_long = long_ma[i - 1]
            curr_long = long_ma[i]

            if prev_short <= prev_long and curr_short > curr_long:
                shares = self._calc_shares(bars[i]["close"], portfolio_state)
                signals.append(
                    Signal(
                        "buy",
                        bars[i].get("symbol", ""),
                        shares=shares,
                        reason=f"MA{self.params['short_period']} 上穿 MA{self.params['long_period']}",
                    )
                )
            elif prev_short >= prev_long and curr_short < curr_long:
                signals.append(
                    Signal(
                        "sell",
                        bars[i].get("symbol", ""),
                        reason=f"MA{self.params['short_period']} 下穿 MA{self.params['long_period']}",
                    )
                )
            else:
                signals.append(
                    Signal("hold", bars[i].get("symbol", ""), reason="无信号")
                )

        return signals

    def _calc_shares(self, price: float, state: dict[str, Any] | None) -> int:
        if not state or price <= 0:
            return 0
        equity = state.get("equity", 100000)
        budget = equity * self.params["position_size_pct"] / 100
        return max(0, int(budget / price / 100) * 100)


class RSIStrategy(BaseStrategy):
    """RSI overbought/oversold strategy."""

    name = "rsi_reversal"
    description = "RSI 超买超卖策略: RSI<30 买入，RSI>70 卖出"
    default_params = {
        "period": 14,
        "oversold": 30,
        "overbought": 70,
        "position_size_pct": 20,
    }

    def generate_signals(
        self, bars: list[dict], portfolio_state: dict[str, Any] | None = None
    ) -> list[Signal]:
        if len(bars) < self.params["period"] + 1:
            return []

        closes = self._closes(bars)
        rsi_values = self._calc_rsi(closes, self.params["period"])

        signals = []
        for i in range(len(rsi_values)):
            rsi = rsi_values[i]
            if math.isnan(rsi):
                signals.append(
                    Signal("hold", bars[i + 1].get("symbol", ""), reason="数据不足")
                )
                continue

            if rsi < self.params["oversold"]:
                shares = self._calc_shares(bars[i + 1]["close"], portfolio_state)
                signals.append(
                    Signal(
                        "buy",
                        bars[i + 1].get("symbol", ""),
                        shares=shares,
                        reason=f"RSI={rsi:.1f} 超卖",
                    )
                )
            elif rsi > self.params["overbought"]:
                signals.append(
                    Signal(
                        "sell",
                        bars[i + 1].get("symbol", ""),
                        reason=f"RSI={rsi:.1f} 超买",
                    )
                )
            else:
                signals.append(
                    Signal(
                        "hold",
                        bars[i + 1].get("symbol", ""),
                        reason=f"RSI={rsi:.1f} 中性",
                    )
                )

        return signals

    def _calc_rsi(self, closes: list[float], period: int) -> list[float]:
        if len(closes) < period + 1:
            return []
        deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
        gains = [max(0, d) for d in deltas]
        losses = [max(0, -d) for d in deltas]

        avg_gain = sum(gains[:period]) / period
        avg_loss = sum(losses[:period]) / period

        rsi = []
        for i in range(period, len(deltas)):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period
            if avg_loss == 0:
                rsi.append(100.0)
            else:
                rs = avg_gain / avg_loss
                rsi.append(100 - 100 / (1 + rs))

        return rsi

    def _calc_shares(self, price: float, state: dict[str, Any] | None) -> int:
        if not state or price <= 0:
            return 0
        equity = state.get("equity", 100000)
        budget = equity * self.params["position_size_pct"] / 100
        return max(0, int(budget / price / 100) * 100)


class StrategyRegistry:
    """Registry for built-in and custom strategies."""

    _strategies: dict[str, type[BaseStrategy]] = {
        "macd_momentum": MACDMomentumStrategy,
        "ma_crossover": MAStrategy,
        "rsi_reversal": RSIStrategy,
    }

    @classmethod
    def get(cls, name: str) -> type[BaseStrategy] | None:
        return cls._strategies.get(name)

    @classmethod
    def register(cls, name: str, strategy_class: type[BaseStrategy]) -> None:
        cls._strategies[name] = strategy_class

    @classmethod
    def list_strategies(cls) -> list[dict[str, Any]]:
        return [
            {
                "name": name,
                "description": s.description,
                "default_params": s.default_params,
            }
            for name, s in cls._strategies.items()
        ]

    @classmethod
    def create(
        cls, name: str, params: dict[str, Any] | None = None
    ) -> BaseStrategy | None:
        strategy_class = cls.get(name)
        if strategy_class:
            return strategy_class(params)
        return None
