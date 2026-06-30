"""确定性评级层测试 / Rating — 纯函数行为验证。

覆盖:
- score_to_rating 五档阈值边界
- compute_rating: 全买入/全卖出/分歧/低置信度/风控否决/空输入
- 失败安全: 字段缺失、置信度为 0、NaN/非法值
- 可审计: breakdown 含 W/D/raw/conf_factor/avg_conf/n_agents
- 合规红线: 评级仅为确定性度量, 测试不涉及任何买卖指令
"""

from __future__ import annotations

import math

import pytest

from backend.runtime.rating import compute_rating, score_to_rating


# ----------------------------- score_to_rating -----------------------------


@pytest.mark.parametrize(
    "score,expected",
    [
        (100, "强烈推荐"),
        (80, "强烈推荐"),
        (79.99, "推荐"),
        (60, "推荐"),
        (59.99, "中性"),
        (40, "中性"),
        (39.99, "谨慎"),
        (20, "谨慎"),
        (19.99, "回避"),
        (0, "回避"),
    ],
)
def test_score_to_rating_thresholds(score: float, expected: str) -> None:
    assert score_to_rating(score) == expected


# ----------------------------- compute_rating -----------------------------


def _agent(signal: str, confidence: float) -> dict:
    return {"signal": signal, "confidence": confidence}


def test_all_buy_high_confidence_is_strong_buy() -> None:
    r = compute_rating([_agent("买入", 90), _agent("买入", 85), _agent("买入", 95)])
    assert r["score"] >= 80
    assert r["rating"] == "强烈推荐"
    assert r["breakdown"]["D"] > 0.99  # 几乎全多头


def test_all_sell_high_confidence_is_avoid() -> None:
    r = compute_rating([_agent("卖出", 90), _agent("卖出", 85)])
    assert r["score"] < 20
    assert r["rating"] == "回避"
    assert r["breakdown"]["D"] < -0.99


def test_balanced_split_is_near_neutral() -> None:
    # 一买一卖同置信度 → D≈0 → raw=50; conf_factor>0 但 (raw-50)=0 → score=50
    r = compute_rating([_agent("买入", 80), _agent("卖出", 80)])
    assert r["score"] == pytest.approx(50.0, abs=0.01)
    assert r["rating"] == "中性"
    assert r["breakdown"]["D"] == pytest.approx(0.0, abs=1e-6)


def test_low_confidence_shrinks_toward_neutral() -> None:
    # 全买入但极低置信度: raw=100, conf_factor≈0.05 → score≈52.5 (向 50 收缩)
    r = compute_rating([_agent("买入", 5), _agent("买入", 6)])
    assert r["score"] < 60  # 远到不了「推荐」
    assert r["score"] > 50  # 仍略偏多
    assert r["rating"] in {"中性", "推荐"}


def test_confidence_weighting_breaks_tie() -> None:
    # 一买(高置信) vs 一卖(低置信): 加权后净方向偏多
    r = compute_rating([_agent("买入", 95), _agent("卖出", 20)])
    assert r["breakdown"]["D"] > 0
    assert r["score"] > 50


def test_risk_veto_caps_score_to_avoid_tier() -> None:
    # 即使全买入高置信, 风控否决也压到回避档
    r = compute_rating([_agent("买入", 95), _agent("买入", 95)], risk_vetoed=True)
    assert r["score"] <= 15
    assert r["rating"] == "回避"
    assert r["breakdown"]["risk_vetoed"] is True


def test_empty_agents_returns_neutral() -> None:
    r = compute_rating([])
    assert r["score"] == 50.0
    assert r["rating"] == "中性"
    assert r["breakdown"]["n_agents"] == 0


def test_all_zero_confidence_is_neutral_safe_fallback() -> None:
    # W==0 无法加权 → 中性兜底
    r = compute_rating([_agent("买入", 0), _agent("卖出", 0)])
    assert r["score"] == 50.0
    assert r["rating"] == "中性"


def test_missing_fields_are_safe() -> None:
    # 字段缺失按「观望/0」处理, 不抛异常
    r = compute_rating([{}, {"signal": "买入"}, {"confidence": 50}])
    assert 0 <= r["score"] <= 100
    assert "rating" in r


def test_garbage_confidence_does_not_crash() -> None:
    r = compute_rating(
        [
            {"signal": "买入", "confidence": "not-a-number"},
            {"signal": "买入", "confidence": None},
            {"signal": "买入", "confidence": float("nan")},
            {"signal": "买入", "confidence": float("inf")},
        ]
    )
    # 全部解析失败 → 置信度 0 → W==0 → 中性兜底
    assert r["score"] == 50.0
    assert math.isfinite(r["score"])


def test_hold_signals_are_zero_weight() -> None:
    # 全观望: vote_weight=0 → D=0 → 中性
    r = compute_rating([_agent("观望", 80), _agent("观望", 70)])
    assert r["breakdown"]["D"] == pytest.approx(0.0, abs=1e-6)
    assert r["score"] == pytest.approx(50.0, abs=0.01)


def test_breakdown_has_audit_fields() -> None:
    r = compute_rating([_agent("买入", 70), _agent("卖出", 40)])
    bd = r["breakdown"]
    for key in ("n_agents", "W", "D", "raw", "avg_conf", "conf_factor", "risk_vetoed"):
        assert key in bd, f"breakdown 缺字段: {key}"
    assert bd["n_agents"] == 2
    assert bd["risk_vetoed"] is False


def test_score_always_in_valid_range() -> None:
    # 极端加权也不会越界
    cases = [
        [_agent("买入", 100)] * 5,
        [_agent("卖出", 100)] * 5,
        [_agent("买入", 100), _agent("卖出", 1)],
    ]
    for agents in cases:
        r = compute_rating(agents)
        assert 0.0 <= r["score"] <= 100.0


def test_determinism_same_input_same_output() -> None:
    agents = [_agent("买入", 70), _agent("买入", 60), _agent("卖出", 80)]
    a = compute_rating(agents)
    b = compute_rating(agents)
    assert a == b
