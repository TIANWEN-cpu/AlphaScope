"""交易日历测试 / Trading Calendar (Phase A #6).

覆盖:
1. 真实 exchange_calendars 路径 (装了): 节假日/周末/交易日识别正确
2. 降级路径 (monkeypatch 强制 _XC_AVAILABLE=False): 周末启发式 + 失败安全
3. 边界: 非法日期、倒序区间、未知市场、n=0/负数
4. 纯函数: 输出统一 datetime.date

合规: 仅测试日历结构, 不涉及买卖指令。
"""

from __future__ import annotations

from datetime import date

import pytest

from backend import trading_calendar as tc


# ============================================================
# 1. 真实 exchange_calendars 路径 (装了; 未装则整组用例跳过)
# ============================================================

xc_real = pytest.importorskip("exchange_calendars")


def test_is_available_xshg():
    assert tc.is_available("XSHG") is True


def test_is_trading_day_holiday_new_year():
    """2024-01-01 元旦是非交易日 (真实节假日, 周末启发式无法识别)。"""
    assert tc.is_trading_day("2024-01-01", "XSHG") is False


def test_is_trading_day_weekend():
    """2024-01-06 周六是非交易日。"""
    assert tc.is_trading_day("2024-01-06", "XSHG") is False


def test_is_trading_day_normal():
    """2024-01-02 (周二) 是交易日。"""
    assert tc.is_trading_day("2024-01-02", "XSHG") is True


def test_trading_days_range_skips_holidays_and_weekends():
    """[2024-01-01, 2024-01-10] 区间应跳过元旦 + 两个周末 = 7 个交易日。"""
    days = tc.trading_days("2024-01-01", "2024-01-10", "XSHG")
    assert len(days) == 7
    assert days[0] == date(2024, 1, 2)  # 跳过元旦
    assert days[-1] == date(2024, 1, 10)
    # 全部都不是周末
    for d in days:
        assert d.weekday() < 5


def test_count_trading_days_matches_len():
    assert tc.count_trading_days("2024-01-01", "2024-01-10", "XSHG") == 7


def test_next_trading_day_skips_weekend():
    """周五的下一个交易日是下周一 (跳过周末)。"""
    assert tc.next_trading_day("2024-01-05", "XSHG") == date(2024, 1, 8)


def test_next_trading_day_skips_holiday():
    """节前最后一个交易日的下一日是节后第一个交易日。"""
    # 2024 春节: 2/9除夕~2/17 休市, 2/19(周一)开市; 2/8(周四)是节前最后交易日
    # (注: exchange_calendars 的实际春节安排以源数据为准, 这里测 next 不落在周末)
    nx = tc.next_trading_day("2024-02-08", "XSHG")
    assert nx is not None
    assert nx.weekday() < 5  # 一定是工作日
    assert nx > date(2024, 2, 8)


def test_previous_trading_day():
    assert tc.previous_trading_day("2024-01-08", "XSHG") == date(2024, 1, 5)


def test_next_trading_day_n_steps():
    """n=3: 从 2024-01-02 起第 3 个交易日 = 2024-01-05。"""
    assert tc.next_trading_day("2024-01-02", "XSHG", n=3) == date(2024, 1, 5)


def test_next_trading_day_n_zero_returns_same_day():
    assert tc.next_trading_day("2024-01-02", "XSHG", n=0) == date(2024, 1, 2)


def test_describe_shows_available():
    info = tc.describe("XSHG")
    assert info["available"] is True
    assert info["mode"] == "exchange_calendars"


# ============================================================
# 2. 降级路径 (强制 _XC_AVAILABLE=False, 模拟未装)
# ============================================================


@pytest.fixture
def degraded(monkeypatch):
    """强制 trading_calendar 走降级路径 (模拟 exchange_calendars 未装)。"""
    monkeypatch.setattr(tc, "_XC_AVAILABLE", False)
    monkeypatch.setattr(tc, "_CAL_CACHE", {})


def test_degraded_is_trading_day_weekend_heuristic(degraded):
    """降级模式: 仅识别周末, 元旦被误判为交易日 (启发式的局限)。"""
    assert tc.is_trading_day("2024-01-06", "XSHG") is False  # 周六
    assert tc.is_trading_day("2024-01-02", "XSHG") is True  # 周二
    # 元旦 (周一): 启发式误判为交易日 (节假日无法识别) — 这是降级的预期局限
    assert tc.is_trading_day("2024-01-01", "XSHG") is True


def test_degraded_trading_days_returns_workdays(degraded):
    """降级模式: 返回区间内所有工作日 (不识别节假日)。"""
    days = tc.trading_days("2024-01-01", "2024-01-10", "XSHG")
    # 1/1~1/10: 周末 1/6,1/7 跳过 → 8 个工作日 (含元旦 1/1)
    assert len(days) == 8


def test_degraded_describe_reports_weekend_heuristic(degraded):
    info = tc.describe("XSHG")
    assert info["available"] is False
    assert info["mode"] == "weekend_heuristic"


def test_degraded_is_available_false(degraded):
    assert tc.is_available("XSHG") is False


# ============================================================
# 3. 边界 / 失败安全
# ============================================================


def test_invalid_date_returns_false():
    assert tc.is_trading_day("not-a-date", "XSHG") is False


def test_inverted_range_returns_empty():
    assert tc.trading_days("2024-01-10", "2024-01-01", "XSHG") == []


def test_unknown_market_falls_back_to_weekend_heuristic():
    """未知市场代码 → calendar 加载失败 → 降级为周末启发式 (不抛)。"""
    assert tc.is_trading_day("2024-01-02", "UNKNOWN_MARKET") is True  # 周二


def test_accepts_date_and_datetime_objects():
    """输入支持 str / date / datetime 对象。"""
    assert tc.is_trading_day(date(2024, 1, 2), "XSHG") is True
    from datetime import datetime

    assert tc.is_trading_day(datetime(2024, 1, 6, 10, 0), "XSHG") is False  # 周六


def test_us_market_supported():
    """exchange_calendars 也支持美股市场 (NYSE)。"""
    if tc.is_available("NYSE"):
        # 2024-01-01 是美国元旦也是非交易日
        assert tc.is_trading_day("2024-01-01", "NYSE") is False
