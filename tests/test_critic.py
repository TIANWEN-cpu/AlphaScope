"""Tests for backend.critic — pure-function critic helpers."""

import json


from critic import (
    build_critic_prompt,
    parse_critic_response,
    _serialize_evidence,
    VALID_DIVERGENCE_LEVELS,
)


# ---------------- _serialize_evidence ----------------


def test_serialize_evidence_dict_with_type_and_date():
    out = _serialize_evidence(
        [
            {
                "type": "fund_flow",
                "claim": "近5日主力净流入2.3亿",
                "data_date": "2026-05-16",
            },
            {"type": "other", "claim": "成交量放大"},  # other 不渲染 type 标
        ]
    )
    assert "[fund_flow]" in out[0]
    assert "(2026-05-16)" in out[0]
    assert "[other]" not in out[1]
    assert out[1] == "成交量放大"


def test_serialize_evidence_string_list_passes_through():
    out = _serialize_evidence(["MA20 上行", "  ", "成交量放大"])
    assert out == ["MA20 上行", "成交量放大"]


def test_serialize_evidence_empty_yields_empty_list():
    assert _serialize_evidence(None) == []
    assert _serialize_evidence([]) == []


# ---------------- build_critic_prompt ----------------


def test_prompt_includes_keys_signals_and_evidence():
    agents = {
        "fundamental": {
            "name": "🏛️ 基本面分析师",
            "signal": "买入",
            "confidence": 78,
            "reason": "高 ROE",
            "evidence": [{"type": "fundamental", "claim": "ROE 30%"}],
            "risks": ["白酒板块情绪偏弱"],
            "invalid_if": "跌破 MA20",
        },
        "technical": {
            "name": "📐 技术分析师",
            "signal": "卖出",
            "confidence": 60,
            "reason": "短期超买",
        },
    }
    prompt = build_critic_prompt("茅台", "MA20 上行,RSI 65", agents)
    # 各 agent 的 key 都必须出现,审稿人必须能看到 key 才能在响应中引用
    assert "key: fundamental" in prompt
    assert "key: technical" in prompt
    assert "ROE 30%" in prompt
    assert "白酒板块情绪偏弱" in prompt
    assert "invalid_if: 跌破 MA20" in prompt
    # 必须明确告诉模型 key 严格对应
    assert "严格对应上面给出的 key" in prompt


def test_prompt_handles_missing_optional_fields():
    agents = {"x": {"name": "X", "signal": "观望", "confidence": 50, "reason": "无"}}
    prompt = build_critic_prompt("Test", "(no data)", agents)
    assert "key: x" in prompt
    assert "evidence:" not in prompt  # 没传就不应该出现 evidence: 标签
    assert "risks:" not in prompt


# ---------------- parse_critic_response ----------------


def test_parse_filters_unknown_keys_and_clamps_score():
    raw = json.dumps(
        {
            "agents": [
                {
                    "key": "fundamental",
                    "quality_score": 999,
                    "supported": ["a"],
                    "contradictions": [],
                    "missing_evidence": [],
                    "overconfident": False,
                    "comment": "ok",
                },
                {"key": "ghost", "quality_score": 50, "comment": "应被过滤"},
                {"key": "technical", "quality_score": -10, "comment": "下界裁剪"},
            ],
            "divergence": {
                "level": "中",
                "main_axis": "估值 vs 技术",
                "summary": "短期与长期分歧",
            },
        },
        ensure_ascii=False,
    )
    out = parse_critic_response(raw, ["fundamental", "technical"])
    assert set(out["agents"].keys()) == {"fundamental", "technical"}
    assert out["agents"]["fundamental"]["quality_score"] == 100
    assert out["agents"]["technical"]["quality_score"] == 0
    assert out["divergence"]["level"] == "中"
    assert out["divergence"]["main_axis"] == "估值 vs 技术"


def test_parse_string_input_uses_json_extractor():
    # 模型可能返回带 markdown 代码块
    raw = (
        "```json\n"
        + json.dumps(
            {
                "agents": [{"key": "a", "quality_score": 80}],
                "divergence": {"level": "低", "main_axis": "", "summary": ""},
            }
        )
        + "\n```"
    )
    out = parse_critic_response(raw, ["a"])
    assert out["agents"]["a"]["quality_score"] == 80
    assert out["divergence"]["level"] == "低"


def test_parse_handles_garbage_input():
    # 完全不是 JSON
    out = parse_critic_response("nonsense", ["a", "b"])
    assert out["agents"] == {}
    # 多 agent 的默认 level 是 "中"(无法判断),单 agent 则是 "无"
    assert out["divergence"]["level"] == "中"

    out_single = parse_critic_response("nonsense", ["only"])
    assert out_single["divergence"]["level"] == "无"


def test_parse_invalid_level_falls_back_to_safe_default():
    raw = json.dumps(
        {
            "agents": [{"key": "a", "quality_score": 60}],
            "divergence": {"level": "EXTREMELY HIGH", "main_axis": "", "summary": ""},
        }
    )
    out = parse_critic_response(raw, ["a", "b"])
    assert out["divergence"]["level"] in VALID_DIVERGENCE_LEVELS


def test_parse_duplicate_keys_kept_only_once():
    raw = json.dumps(
        {
            "agents": [
                {"key": "x", "quality_score": 70, "comment": "first"},
                {"key": "x", "quality_score": 30, "comment": "second"},
            ],
            "divergence": {"level": "无"},
        }
    )
    out = parse_critic_response(raw, ["x"])
    assert len(out["agents"]) == 1
    assert out["agents"]["x"]["comment"] == "first"


def test_parse_supports_list_clamped_to_3():
    raw = json.dumps(
        {
            "agents": [
                {
                    "key": "x",
                    "quality_score": 80,
                    "supported": ["a", "b", "c", "d", "e"],
                    "missing_evidence": "1) line one\n2) line two",
                }
            ],
            "divergence": {"level": "无"},
        }
    )
    out = parse_critic_response(raw, ["x"])
    assert len(out["agents"]["x"]["supported"]) == 3
    # 多行字符串自动按行拆分
    assert len(out["agents"]["x"]["missing_evidence"]) >= 1
