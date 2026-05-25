from __future__ import annotations

from backend.price_periods import aggregate_price_bars, normalize_frequency


def test_normalize_frequency_aliases():
    assert normalize_frequency("分时") == "intraday"
    assert normalize_frequency("1m") == "intraday"
    assert normalize_frequency("1w") == "1w"
    assert normalize_frequency("weekly") == "1w"
    assert normalize_frequency("1mo") == "1mo"
    assert normalize_frequency("1M") == "1mo"
    assert normalize_frequency("monthly") == "1mo"
    assert normalize_frequency("unknown") == "1d"


def test_aggregate_weekly_bars_uses_true_ohlc_and_sums_volume():
    bars = [
        {
            "symbol": "600519",
            "date": "2026-05-04",
            "open": 10,
            "high": 13,
            "low": 9,
            "close": 12,
            "volume": 100,
            "amount": 1000,
            "source": "test",
        },
        {
            "symbol": "600519",
            "date": "2026-05-05",
            "open": 12,
            "high": 15,
            "low": 11,
            "close": 14,
            "volume": 200,
            "amount": 2000,
            "source": "test",
        },
        {
            "symbol": "600519",
            "date": "2026-05-11",
            "open": 20,
            "high": 21,
            "low": 18,
            "close": 19,
            "volume": 300,
            "amount": 3000,
            "source": "test",
        },
    ]

    result = aggregate_price_bars(bars, "1w")

    assert len(result) == 2
    assert result[0]["period_start"] == "2026-05-04"
    assert result[0]["date"] == "2026-05-05"
    assert result[0]["open"] == 10
    assert result[0]["high"] == 15
    assert result[0]["low"] == 9
    assert result[0]["close"] == 14
    assert result[0]["volume"] == 300
    assert result[0]["amount"] == 3000
    assert result[0]["frequency"] == "1w"


def test_aggregate_monthly_bars_groups_by_calendar_month():
    bars = [
        {
            "symbol": "600519",
            "date": "2026-04-30",
            "open": 9,
            "high": 11,
            "low": 8,
            "close": 10,
            "volume": 50,
        },
        {
            "symbol": "600519",
            "date": "2026-05-04",
            "open": 10,
            "high": 13,
            "low": 9,
            "close": 12,
            "volume": 100,
        },
        {
            "symbol": "600519",
            "date": "2026-05-29",
            "open": 12,
            "high": 15,
            "low": 11,
            "close": 14,
            "volume": 200,
        },
    ]

    result = aggregate_price_bars(bars, "1mo")

    assert [item["period_start"] for item in result] == ["2026-04-30", "2026-05-04"]
    assert result[1]["date"] == "2026-05-29"
    assert result[1]["open"] == 10
    assert result[1]["high"] == 15
    assert result[1]["low"] == 9
    assert result[1]["close"] == 14
    assert result[1]["volume"] == 300
