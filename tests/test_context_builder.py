"""Context builder regression tests."""

from __future__ import annotations

from backend.runtime.context_builder import build_market_brief


def test_market_brief_handles_minimal_stock_data():
    brief = build_market_brief({"symbol": "600519", "name": "贵州茅台"})

    assert "贵州茅台" in brief
    assert "600519" in brief
    assert "暂无可用价格数据" in brief


def test_market_brief_accepts_change_pct_alias():
    brief = build_market_brief(
        {
            "symbol": "600519",
            "name": "贵州茅台",
            "close": 100.0,
            "change_pct": 1.2,
            "volume": 10000,
            "amount": 2.5,
        }
    )

    assert "¥100.00" in brief
    assert "+1.20%" in brief
    assert "2.5 亿元" in brief
