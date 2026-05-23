"""基金指标计算测试"""

from __future__ import annotations

from backend.funds.metrics import (
    calc_annualized_return,
    calc_calmar_ratio,
    calc_fund_metrics,
    calc_max_drawdown,
    calc_nav_returns,
    calc_sharpe_ratio,
    calc_total_return,
    calc_volatility,
    calc_win_rate,
)


class TestNavReturns:
    """净值收益率计算"""

    def test_basic(self):
        navs = [1.0, 1.1, 1.21]
        returns = calc_nav_returns(navs)
        assert len(returns) == 2
        assert abs(returns[0] - 0.1) < 1e-10
        assert abs(returns[1] - 0.1) < 1e-10

    def test_empty(self):
        assert calc_nav_returns([]) == []
        assert calc_nav_returns([1.0]) == []

    def test_with_zero(self):
        navs = [1.0, 0.0, 1.0]
        returns = calc_nav_returns(navs)
        assert returns[0] == -1.0
        assert returns[1] == 0.0  # 除以 0 保护


class TestTotalReturn:
    """总收益率"""

    def test_positive(self):
        assert abs(calc_total_return([1.0, 1.5]) - 0.5) < 1e-10

    def test_negative(self):
        assert abs(calc_total_return([1.0, 0.8]) - (-0.2)) < 1e-10

    def test_empty(self):
        assert calc_total_return([]) == 0.0
        assert calc_total_return([1.0]) == 0.0


class TestAnnualizedReturn:
    """年化收益率"""

    def test_one_year(self):
        assert abs(calc_annualized_return(0.1, 365) - 0.1) < 1e-6

    def test_two_years(self):
        # (1+0.21)^(365/730) - 1 ≈ 0.1
        result = calc_annualized_return(0.21, 730)
        assert abs(result - 0.1) < 0.01

    def test_zero_days(self):
        assert calc_annualized_return(0.1, 0) == 0.0


class TestVolatility:
    """波动率"""

    def test_constant(self):
        returns = [0.01] * 10
        assert abs(calc_volatility(returns)) < 1e-10

    def test_varying(self):
        returns = [0.01, -0.02, 0.03, -0.01, 0.02]
        vol = calc_volatility(returns)
        assert vol > 0

    def test_insufficient_data(self):
        assert calc_volatility([]) == 0.0
        assert calc_volatility([0.01]) == 0.0


class TestMaxDrawdown:
    """最大回撤"""

    def test_no_drawdown(self):
        navs = [1.0, 1.1, 1.2, 1.3]
        assert calc_max_drawdown(navs) == 0.0

    def test_simple_drawdown(self):
        navs = [1.0, 1.5, 1.0]
        dd = calc_max_drawdown(navs)
        assert abs(dd - 1 / 3) < 0.01

    def test_empty(self):
        assert calc_max_drawdown([]) == 0.0
        assert calc_max_drawdown([1.0]) == 0.0


class TestSharpeRatio:
    """夏普比率"""

    def test_positive_returns(self):
        returns = [0.001] * 252
        sharpe = calc_sharpe_ratio(returns)
        assert sharpe > 0

    def test_negative_returns(self):
        returns = [-0.001] * 252
        sharpe = calc_sharpe_ratio(returns)
        assert sharpe < 0

    def test_insufficient_data(self):
        assert calc_sharpe_ratio([]) == 0.0


class TestCalmarRatio:
    """卡玛比率"""

    def test_basic(self):
        assert abs(calc_calmar_ratio(0.3, 0.1) - 3.0) < 1e-10

    def test_zero_drawdown(self):
        assert calc_calmar_ratio(0.3, 0.0) == 0.0


class TestWinRate:
    """胜率"""

    def test_all_positive(self):
        assert calc_win_rate([0.01, 0.02, 0.03]) == 1.0

    def test_all_negative(self):
        assert calc_win_rate([-0.01, -0.02]) == 0.0

    def test_mixed(self):
        assert calc_win_rate([0.01, -0.01, 0.01]) == 2 / 3

    def test_empty(self):
        assert calc_win_rate([]) == 0.0


class TestFundMetrics:
    """综合指标"""

    def test_full_calculation(self):
        navs = [1.0, 1.05, 1.02, 1.08, 1.15, 1.10, 1.20]
        metrics = calc_fund_metrics(navs)
        assert "total_return" in metrics
        assert "sharpe_ratio" in metrics
        assert "max_drawdown" in metrics
        assert "volatility" in metrics
        assert "win_rate" in metrics
        assert metrics["data_points"] == 7
        assert metrics["total_return"] > 0

    def test_insufficient_data(self):
        metrics = calc_fund_metrics([1.0])
        assert metrics["data_points"] == 1
        assert metrics["total_return"] == 0.0
