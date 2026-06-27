"""② 成本/用量汇总 聚合测试(隔离 DB,不联网)。"""

from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path

import pytest

import backend.storage.db as db_mod


@pytest.fixture
def tmp_db(monkeypatch):
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    tmp = Path(path)
    monkeypatch.setattr(db_mod, "DB_PATH", tmp)
    db_mod.Database._instance = None
    yield tmp
    db_mod.Database._instance = None
    try:
        os.unlink(tmp)
    except OSError:
        pass


def _seed():
    from backend.diagnostics_store import save_cost_record

    save_cost_record(
        model="claude-sonnet-4-5",
        vendor="claude",
        input_tokens=1000,
        output_tokens=500,
        cost_usd=0.02,
    )
    save_cost_record(
        model="claude-sonnet-4-5",
        vendor="claude",
        input_tokens=2000,
        output_tokens=800,
        cost_usd=0.05,
    )
    save_cost_record(
        model="gpt-5.2",
        vendor="gpt",
        input_tokens=500,
        output_tokens=300,
        cost_usd=0.01,
    )


class TestCostSummary:
    def test_recent_records_in_all_windows(self, tmp_db):
        from backend.diagnostics_store import get_cost_summary

        _seed()
        w = get_cost_summary(now=time.time())["windows"]
        assert w["today"]["calls"] == 3
        assert w["total"]["calls"] == 3
        assert round(w["total"]["cost_usd"], 4) == 0.08
        assert w["total"]["input_tokens"] == 3500
        assert w["total"]["output_tokens"] == 1600

    def test_by_model_breakdown(self, tmp_db):
        from backend.diagnostics_store import get_cost_summary

        _seed()
        s = get_cost_summary(now=time.time())
        by = {m["model"]: m for m in s["by_model"]}
        assert by["claude-sonnet-4-5"]["calls"] == 2
        assert round(by["claude-sonnet-4-5"]["cost_usd"], 4) == 0.07
        assert by["gpt-5.2"]["calls"] == 1
        # 按成本降序
        assert s["by_model"][0]["model"] == "claude-sonnet-4-5"

    def test_windows_exclude_old_records(self, tmp_db):
        from backend.diagnostics_store import get_cost_summary

        _seed()
        # 把"现在"挪到 40 天后 → 记录落在所有滚动窗口外,但仍计入 total
        s = get_cost_summary(now=time.time() + 40 * 86400)
        assert s["windows"]["today"]["calls"] == 0
        assert s["windows"]["last_7d"]["calls"] == 0
        assert s["windows"]["last_30d"]["calls"] == 0
        assert s["windows"]["total"]["calls"] == 3

    def test_empty_db(self, tmp_db):
        from backend.diagnostics_store import get_cost_summary

        s = get_cost_summary(now=time.time())
        assert s["windows"]["total"]["calls"] == 0
        assert s["windows"]["total"]["cost_usd"] == 0
        assert s["by_model"] == []
