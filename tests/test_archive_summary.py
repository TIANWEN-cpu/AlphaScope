"""Tests for backend.archive._summarize_critic — pure summarization helper."""

from archive import _safe_filename_part, _safe_symbol, _summarize_critic


def test_safe_archive_names_strip_path_separators():
    assert _safe_symbol("../600519") == "600519"
    assert _safe_filename_part("a/b:c*?") == "a_b_c"


def test_returns_none_when_critic_block_absent():
    assert _summarize_critic(None, {}) is None


def test_returns_error_dict_when_critic_failed():
    out = _summarize_critic({"ok": False, "error": "claude timeout"}, {})
    assert out == {"ok": False, "error": "claude timeout"}


def test_summarizes_quality_and_divergence():
    critic = {
        "ok": True,
        "vendor": "Claude",
        "model": "claude-opus-4-7",
        "fallback_used": False,
        "divergence": {
            "level": "中",
            "main_axis": "估值 vs 资金",
            "summary": "短期与长期",
        },
    }
    agent_models = {
        "fundamental": {"review": {"quality_score": 80, "overconfident": False}},
        "technical": {"review": {"quality_score": 60, "overconfident": True}},
        "risk": {"review": {"quality_score": 70, "overconfident": False}},
        "sentiment": {"review": None},  # 没被审到的不算入
    }
    out = _summarize_critic(critic, agent_models)
    assert out["ok"] is True
    assert out["avg_quality"] == 70.0
    assert out["reviewed_count"] == 3
    assert out["overconfident_count"] == 1
    assert out["divergence_level"] == "中"
    assert out["divergence_axis"] == "估值 vs 资金"
    assert out["vendor"] == "Claude"


def test_handles_empty_agents_block_gracefully():
    out = _summarize_critic(
        {"ok": True, "divergence": {"level": "无"}},
        {},
    )
    assert out is not None
    assert out["avg_quality"] is None
    assert out["reviewed_count"] == 0
    assert out["overconfident_count"] == 0
