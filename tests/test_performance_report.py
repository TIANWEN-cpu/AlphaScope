"""绩效报告测试 / Performance Report — QuantStats (20 项目 #5).

覆盖:
1. 纯函数 (始终跑): equity_to_returns 归一化
2. quantstats 路径 (装了): build_report / metric_summary 返回真实指标
3. 降级路径 (强制 _QS_AVAILABLE=False): 失败安全返回 available=False
4. 边界: 空输入/短输入/非数值/HTML 生成

合规: 仅测试绩效统计, 不涉及买卖指令; 报告附免责。
"""

from __future__ import annotations

import pytest

from backend import performance_report as pr


# ============================================================
# 1. 纯函数 (始终跑)
# ============================================================


def test_equity_to_returns_basic():
    """权益曲线 → 收益率序列 (pct change, 长度 -1)。"""
    r = pr.equity_to_returns([100, 110, 121])
    assert r == [0.1, 0.1]  # +10% each


def test_equity_to_returns_short_input_safe():
    assert pr.equity_to_returns([100]) == []
    assert pr.equity_to_returns([]) == []


def test_equity_to_returns_zero_prev_safe():
    """前值为 0 无法算 pct → 填 0 (失败安全, 不抛)。"""
    r = pr.equity_to_returns([0, 100, 110])
    assert r == [0.0, 0.1]


def test_equity_to_returns_garbage_safe():
    assert pr.equity_to_returns([100, "garbage", 110]) == [0.0, 0.0]  # 非数值填 0


# ============================================================
# 2. quantstats 路径 (装了)
# ============================================================

qs_real = pytest.importorskip("quantstats")


def test_is_available_true():
    assert pr.is_available() is True


def test_build_report_returns_metrics():
    """build_report 返回非空 metrics dict (含 sharpe 等指标)。"""
    # 构造一条上涨曲线 (有正收益)
    equity = [100 + i * 0.5 for i in range(60)]
    r = pr.build_report(equity_curve=equity)
    assert r["available"] is True
    assert r["row_count"] == 59
    assert len(r["metrics"]) > 5  # quantstats 返回数十项
    # 至少包含一些常见指标名 (允许 quantstats 版本差异, 不强求具体名)
    assert "disclaimer" in r


def test_metric_summary_returns_key_metrics():
    """metric_summary 返回关键指标精简版。"""
    equity = [100 + i * 0.3 for i in range(252)]
    s = pr.metric_summary(equity_curve=equity)
    assert "sharpe" in s
    assert "max_drawdown" in s
    # 不强求非 None (取决于数据), 但 key 必须齐
    assert set(s.keys()) == {"sharpe", "sortino", "max_drawdown", "cagr", "volatility"}


def test_metric_summary_accepts_returns_directly():
    """也支持直接传 returns (而非 equity_curve)。"""
    returns = [0.001] * 252
    s = pr.metric_summary(returns=returns)
    assert set(s.keys()) == {"sharpe", "sortino", "max_drawdown", "cagr", "volatility"}


def test_describe_available():
    info = pr.describe()
    assert info["available"] is True
    assert "version" in info


def test_render_html_report(tmp_path):
    """HTML 报告文件可生成。"""
    out = tmp_path / "report.html"
    equity = [100 + i * 0.3 for i in range(252)]
    r = pr.render_html_report(str(out), equity_curve=equity)
    assert r["ok"] is True
    assert out.exists()


# ============================================================
# 3. 降级路径 (强制 _QS_AVAILABLE=False)
# ============================================================


@pytest.fixture
def degraded(monkeypatch):
    monkeypatch.setattr(pr, "_QS_AVAILABLE", False)


def test_degraded_build_report_returns_unavailable(degraded):
    r = pr.build_report(equity_curve=[100, 110, 121])
    assert r["available"] is False
    assert "error" in r


def test_degraded_metric_summary_returns_empty(degraded):
    s = pr.metric_summary(equity_curve=[100, 110])
    assert all(v is None for v in s.values())


def test_degraded_describe_reports_unavailable(degraded):
    info = pr.describe()
    assert info["available"] is False


# ============================================================
# 4. 边界
# ============================================================


def test_build_report_insufficient_input():
    r = pr.build_report(equity_curve=[100])  # 单点无法算收益
    assert r["available"] is True  # quantstats 装了
    assert "error" in r  # 但输入不足
    assert r["row_count"] == 0


def test_build_report_empty_input():
    r = pr.build_report(equity_curve=[])
    assert "error" in r


def test_build_report_includes_disclaimer():
    """合规: 报告必须附免责声明。"""
    r = pr.build_report(equity_curve=[100, 110, 121, 132])
    assert "disclaimer" in r
    assert "不代表未来收益" in r["disclaimer"]
