"""基准相关指标测试(v1.9.4): 超额收益/信息比率/alpha/beta。

验证 compass §7.4-2 统计指标标准化的新增能力:
- 纯函数口径正确(beta=1 当策略=基准; 超额=0 当两者重合)
- 无基准/数据不足时优雅降级返回 0, 不抛异常
- build_performance_summary 有基准带 excess/IR/alpha/beta, 无基准标记 has_benchmark=False
"""

from __future__ import annotations

from backend.quant import metrics as M


def test_beta_one_when_strategy_equals_benchmark():
    # 策略与基准每日收益完全相同 → beta ≈ 1
    rets = [0.01, -0.005, 0.02, 0.0, -0.01, 0.015]
    assert abs(M.calc_beta(rets, rets) - 1.0) < 1e-6


def test_beta_zero_when_benchmark_flat():
    # 基准无波动(方差0) → beta=0, 不报错
    assert M.calc_beta([0.01, 0.02, -0.01], [0.0, 0.0, 0.0]) == 0.0


def test_excess_return_zero_when_curves_identical():
    curve = [100.0, 101.0, 103.0, 102.0]
    assert M.calc_excess_return(curve, curve) == 0.0
    # 策略涨10%, 基准涨5% → 超额 0.05
    strat = [100.0, 110.0]
    bench = [100.0, 105.0]
    assert abs(M.calc_excess_return(strat, bench) - 0.05) < 1e-9


def test_excess_return_degrades_without_benchmark():
    assert M.calc_excess_return([100, 110], []) == 0.0
    assert M.calc_excess_return([100, 110], [0, 0]) == 0.0  # 基准首值非正


def test_information_ratio_positive_when_beating_benchmark():
    # 策略稳定跑赢基准 → IR > 0
    strat_ret = [0.002, 0.003, 0.002, 0.003, 0.002]
    bench_ret = [0.001, 0.001, 0.001, 0.001, 0.001]
    ir = M.calc_information_ratio(strat_ret, bench_ret)
    assert ir > 0


def test_information_ratio_degrades_without_benchmark():
    assert M.calc_information_ratio([0.01, 0.02], [0.01]) == 0.0  # 长度不足
    assert M.calc_information_ratio([], []) == 0.0


def test_alpha_zero_when_strategy_equals_benchmark():
    # 策略=基准 → alpha ≈ 0(扣除 beta 部分后无超额)
    rets = [0.01, -0.005, 0.02, 0.0, -0.01, 0.015, 0.008, -0.003]
    alpha = M.calc_alpha(rets, rets)
    assert abs(alpha) < 1e-9


def test_summary_without_benchmark_marks_has_benchmark_false():
    s = M.build_performance_summary(
        equity_curve=[100000, 105000, 102000, 108000],
        trades=[{"pnl": 5000}],
        initial_capital=100000,
        days=3,
    )
    assert s["has_benchmark"] is False
    assert s["excess_return"] == 0.0
    assert s["information_ratio"] == 0.0
    # 主指标仍正常
    assert "sharpe_ratio" in s and "sortino_ratio" in s


def test_summary_with_benchmark_includes_relative_metrics():
    # 策略净值跑赢基准
    strat = [100000, 105000, 110000, 115000]
    bench = [100000, 101000, 102000, 103000]
    s = M.build_performance_summary(
        equity_curve=strat,
        trades=[],
        initial_capital=100000,
        days=3,
        benchmark_curve=bench,
        benchmark_name="沪深300",
    )
    assert s["has_benchmark"] is True
    assert s["benchmark_name"] == "沪深300"
    # 超额收益为正(策略涨15%, 基准涨3%)
    assert s["excess_return"] > 10.0
    assert "beta" in s and "alpha" in s and "information_ratio" in s


def test_summary_with_short_benchmark_degrades():
    # 基准太短(<2) → 视为无基准
    s = M.build_performance_summary(
        equity_curve=[100000, 110000],
        trades=[],
        initial_capital=100000,
        days=1,
        benchmark_curve=[100000],
    )
    assert s["has_benchmark"] is False
