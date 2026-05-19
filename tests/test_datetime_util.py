"""Tests for datetime normalization utility"""

from datetime import datetime, timezone, timedelta

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.utils.datetime_util import (
    parse_dt,
    normalize_dt_str,
    to_utc,
    format_display,
)

_CST = timezone(timedelta(hours=8))


class TestParseDt:
    def test_standard_format(self):
        dt = parse_dt("2026-05-19 10:30:00")
        assert dt is not None
        assert dt.year == 2026
        assert dt.month == 5
        assert dt.hour == 10
        assert dt.minute == 30
        assert dt.tzinfo is not None

    def test_no_seconds(self):
        dt = parse_dt("2026-05-19 10:30")
        assert dt is not None
        assert dt.hour == 10

    def test_slash_format(self):
        dt = parse_dt("2026/05/19 10:30:00")
        assert dt is not None
        assert dt.year == 2026

    def test_compact_format(self):
        dt = parse_dt("20260519103000")
        assert dt is not None
        assert dt.year == 2026

    def test_date_only(self):
        dt = parse_dt("2026-05-19")
        assert dt is not None
        assert dt.year == 2026
        assert dt.hour == 0

    def test_none_input(self):
        assert parse_dt(None) is None

    def test_empty_string(self):
        assert parse_dt("") is None

    def test_invalid_string(self):
        assert parse_dt("not a date") is None

    def test_datetime_passthrough_naive(self):
        naive = datetime(2026, 5, 19, 10, 30)
        dt = parse_dt(naive)
        assert dt.tzinfo is not None
        assert dt.hour == 10

    def test_datetime_passthrough_aware(self):
        aware = datetime(2026, 5, 19, 10, 30, tzinfo=timezone.utc)
        dt = parse_dt(aware)
        assert dt.tzinfo == timezone.utc

    def test_iso_format_with_t(self):
        dt = parse_dt("2026-05-19T10:30:00")
        assert dt is not None
        assert dt.hour == 10

    def test_iso_format_with_offset(self):
        dt = parse_dt("2026-05-19T10:30:00+08:00")
        assert dt is not None
        assert dt.hour == 10

    def test_strip_cst(self):
        dt = parse_dt("2026-05-19 10:30:00 CST")
        assert dt is not None
        assert dt.hour == 10


class TestNormalizeDtStr:
    def test_standard(self):
        s = normalize_dt_str("2026-05-19 10:30:00")
        assert "2026-05-19" in s
        assert "+08:00" in s

    def test_empty(self):
        assert normalize_dt_str("") == ""
        assert normalize_dt_str(None) == ""

    def test_invalid(self):
        assert normalize_dt_str("not a date") == ""


class TestToUtc:
    def test_conversion(self):
        dt = to_utc("2026-05-19 10:30:00")
        assert dt is not None
        assert dt.tzinfo == timezone.utc
        # CST 10:30 = UTC 02:30
        assert dt.hour == 2

    def test_none(self):
        assert to_utc(None) is None


class TestFormatDisplay:
    def test_default_format(self):
        s = format_display("2026-05-19 10:30:00")
        assert s == "2026-05-19 10:30"

    def test_custom_format(self):
        s = format_display("2026-05-19 10:30:00", fmt="%m/%d %H:%M")
        assert s == "05/19 10:30"

    def test_empty(self):
        assert format_display(None) == ""
        assert format_display("") == ""
