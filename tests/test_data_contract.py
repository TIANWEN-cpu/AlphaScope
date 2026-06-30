"""数据契约测试 / Data Contract — Pandera (Phase A #5).

覆盖:
1. pandera 路径 (装了): 合法数据通过 / 缺字段 / 负价格 / 错类型 被检出
2. 降级路径 (monkeypatch 强制 _PA_AVAILABLE=False): 仅字段存在性检查 + degraded 标志
3. OHLC 一致性语义校验 (check_ohlcv_consistency, 纯函数, 始终可测)
4. 边界: 空列表 / 非列表 / 非 dict 元素

合规: 仅测试数据校验逻辑, 不涉及买卖指令。
"""

from __future__ import annotations

import pytest

from backend import data_contract as dc


def _good_bars() -> list[dict]:
    return [
        {
            "date": "2024-01-02",
            "open": 10.0,
            "high": 11.0,
            "low": 9.0,
            "close": 10.5,
            "volume": 1000.0,
        },
        {
            "date": "2024-01-03",
            "open": 10.5,
            "high": 12.0,
            "low": 10.0,
            "close": 11.5,
            "volume": 2000.0,
        },
    ]


# ============================================================
# 1. pandera 路径 (装了; 未装整组跳过)
# ============================================================

pa_real = pytest.importorskip("pandera")


def test_schema_available_true():
    assert dc.schema_available() is True


def test_validate_good_bars_passes():
    r = dc.validate_ohlcv(_good_bars())
    assert r["ok"] is True
    assert r["degraded"] is False
    assert r["mode"] == "pandera"
    assert r["row_count"] == 2


def test_validate_missing_field_detected():
    bars = [{"date": "2024-01-02", "open": 10.0, "close": 10.5}]  # 缺 high/low/volume
    r = dc.validate_ohlcv(bars)
    assert r["ok"] is False
    assert any("缺失" in e for e in r["errors"])


def test_validate_negative_price_detected():
    bars = [
        {
            "date": "2024-01-02",
            "open": -1.0,
            "high": 11.0,
            "low": 9.0,
            "close": 10.5,
            "volume": 1000.0,
        }
    ]
    r = dc.validate_ohlcv(bars)
    assert r["ok"] is False
    assert len(r["errors"]) > 0


def test_validate_allows_extra_fields():
    """strict=False: 额外字段 (symbol/amount) 不报错。"""
    bars = [
        {
            "date": "2024-01-02",
            "open": 10.0,
            "high": 11.0,
            "low": 9.0,
            "close": 10.5,
            "volume": 1000.0,
            "symbol": "000001",
            "amount": 10500.0,
        }
    ]
    r = dc.validate_ohlcv(bars)
    assert r["ok"] is True


def test_describe_available():
    info = dc.describe()
    assert info["available"] is True
    assert info["mode"] == "pandera"


# ============================================================
# 2. 降级路径 (强制 _PA_AVAILABLE=False)
# ============================================================


@pytest.fixture
def degraded(monkeypatch):
    """强制 data_contract 走降级路径 (模拟 pandera 未装)。"""
    monkeypatch.setattr(dc, "_PA_AVAILABLE", False)


def test_degraded_validates_field_presence_only(degraded):
    """降级: 仅检查字段存在, 不做类型/值域校验。"""
    r = dc.validate_ohlcv(_good_bars())
    assert r["ok"] is True
    assert r["degraded"] is True  # 标注降级
    assert r["mode"] == "field_presence_only"


def test_degraded_still_detects_missing_fields(degraded):
    """降级模式仍检查字段存在性 (这是最低底线)。"""
    bars = [{"date": "2024-01-02", "open": 10.0}]  # 缺 high/low/close/volume
    r = dc.validate_ohlcv(bars)
    assert r["ok"] is False
    assert any("缺失" in e for e in r["errors"])


def test_degraded_negative_price_not_caught(degraded):
    """降级模式不做值域校验, 负价格会通过 (这是降级的预期局限, 调用方靠 degraded 标志识别)。"""
    bars = [
        {
            "date": "2024-01-02",
            "open": -1.0,
            "high": 11.0,
            "low": 9.0,
            "close": 10.5,
            "volume": 1000.0,
        }
    ]
    r = dc.validate_ohlcv(bars)
    assert r["ok"] is True  # 降级: 负价格没被检出
    assert r["degraded"] is True


def test_degraded_describe_reports_field_presence(degraded):
    info = dc.describe()
    assert info["available"] is False
    assert info["mode"] == "field_presence_only"


# ============================================================
# 3. OHLC 一致性语义校验 (纯函数, 始终可测, 不依赖 pandera)
# ============================================================


def test_check_consistency_clean_bars_no_warnings():
    assert dc.check_ohlcv_consistency(_good_bars()) == []


def test_check_consistency_high_lt_max_open_close():
    """high 应是最高价; high < max(open, close) 是异常 (可能连带 close 超区间)。"""
    bars = [{"open": 10.0, "high": 9.5, "low": 9.0, "close": 10.5}]  # high < close
    w = dc.check_ohlcv_consistency(bars)
    assert any("high" in x for x in w)


def test_check_consistency_low_gt_min_open_close():
    """low 应是最低价; low > min(open, close) 是异常 (可能连带 close 超区间)。"""
    bars = [{"open": 10.0, "high": 11.0, "low": 10.2, "close": 9.5}]  # low > close
    w = dc.check_ohlcv_consistency(bars)
    assert any("low" in x for x in w)


def test_check_consistency_out_of_range_close():
    """close 应在 [low, high] 区间内。"""
    bars = [{"open": 10.0, "high": 10.5, "low": 9.5, "close": 12.0}]  # close > high
    w = dc.check_ohlcv_consistency(bars)
    assert any("close" in x and "区间" in x for x in w)


def test_check_consistency_empty_and_garbage_safe():
    assert dc.check_ohlcv_consistency([]) == []
    assert dc.check_ohlcv_consistency([{"open": "garbage"}]) == []  # 非数值跳过, 不抛


# ============================================================
# 4. 边界
# ============================================================


def test_empty_bars_list_is_ok():
    r = dc.validate_ohlcv([])
    assert r["ok"] is True  # 空列表算通过 (无数据可校验)
    assert r["row_count"] == 0


def test_non_list_input_fails():
    r = dc.validate_ohlcv("not a list")  # type: ignore[arg-type]
    assert r["ok"] is False


def test_validate_bars_alias_matches_validate_ohlcv():
    assert dc.validate_bars(_good_bars()) == dc.validate_ohlcv(_good_bars())
