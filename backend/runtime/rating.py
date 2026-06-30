"""确定性评级层 / Rating — 从多 Agent 投票 × 置信度算出 0-100 评分与五档评级。

动机
----
项目已有 [[runtime.orchestrator]] 的 `summary["final"]`（买入/卖出/观望 三档多数表决），
但缺一个**结构化、连续、可审计**的评级：每个结论的评分是怎么来的应能逐步复算。
本模块补齐三件事(对标卖方研报评级口径, 但保持本项目「确定性·失败安全·可溯源」基线):

1. **五档映射**: `score_to_rating(score)` 把 0-100 分映射到
   强烈推荐/推荐/中性/谨慎/回避。这是全项目唯一的权威实现(原 `report_templates`
   的 `_score_to_rating` 已改为 import 复用)。
2. **确定性打分**: `compute_rating(agent_results, risk_vetoed)` 纯函数，
   从每个 Agent 的 signal(买入/卖出/观望) × confidence(0-100) 算出加权净方向，
   再用平均置信度向中性收缩, 输出 score + rating + breakdown(可审计明细)。
3. **失败安全**: 无 Agent / 全零置信度 → score=50(中性); 风控否决 → score≤15(回避)。

合规: 评级是对**多 Agent 投票结构**的确定性度量, 仅为研究辅助,
**不据此给买卖指令、不预测、不构成投资建议**; breakdown 全程留痕以支撑「可溯源」。
"""

from __future__ import annotations

from typing import Any

# 投票方向权重: 买入 +1 / 观望 0 / 卖出 -1
_VOTE_WEIGHT: dict[str, float] = {"买入": 1.0, "观望": 0.0, "卖出": -1.0}

# 五档阈值(>=): 与原 report_templates._score_to_rating 完全一致, 此处为唯一权威。
_TIER_THRESHOLDS: tuple[tuple[float, str], ...] = (
    (80.0, "强烈推荐"),
    (60.0, "推荐"),
    (40.0, "中性"),
    (20.0, "谨慎"),
)
_FALLBACK_TIER = "回避"
_VETO_SCORE_CAP = 15.0  # 风控否决时强制落到回避档(<20)


def score_to_rating(score: float) -> str:
    """0-100 评分 → 五档评级字符串。

    强烈推荐 ≥80 / 推荐 ≥60 / 中性 ≥40 / 谨慎 ≥20 / 回避 <20。
    """
    for threshold, label in _TIER_THRESHOLDS:
        if score >= threshold:
            return label
    return _FALLBACK_TIER


def compute_rating(
    agent_results: list[dict[str, Any]],
    risk_vetoed: bool = False,
) -> dict[str, Any]:
    """从多 Agent 结果确定性计算评级。

    参数
    ----
    agent_results: 每个 dict 至少含 ``signal``(买入/卖出/观望) 与 ``confidence``(0-100);
                   字段缺失或无法解析时按「观望/0」处理(失败安全)。
    risk_vetoed:   风控一票否决标志; True 时 score 被压到 ≤15(回避档)。

    返回
    ----
    {"score": float, "rating": str,
     "breakdown": {"n_agents", "W", "D", "raw", "avg_conf", "conf_factor", "risk_vetoed"}}

    公式
    ----
    W  = Σ confidence_i
    D  = (Σ confidence_i × vote_weight_i) / W        ∈ [-1, +1] 加权净方向
    raw = 50 + 50 × D                                ∈ [0, 100],  50 = 中性
    conf_factor = clamp(avg_conf / 100, 0, 1)
    score = 50 + (raw - 50) × conf_factor            # 低置信度向中性收缩
    if risk_vetoed: score = min(score, 15)
    """
    n = len(agent_results)
    if n == 0:
        return _neutral(risk_vetoed, n=0)

    w_sum = 0.0
    weighted = 0.0
    conf_sum = 0.0
    for r in agent_results:
        conf = _to_float(r.get("confidence"), default=0.0)
        signal = str(r.get("signal", "观望"))
        weight = _VOTE_WEIGHT.get(signal, 0.0)
        w_sum += conf
        weighted += conf * weight
        conf_sum += conf

    if w_sum <= 0:
        # 全部置信度为 0 → 无法加权, 回落中性
        return _neutral(risk_vetoed, n=n)

    d = weighted / w_sum  # [-1, +1]
    raw = 50.0 + 50.0 * d
    avg_conf = conf_sum / n
    conf_factor = max(0.0, min(1.0, avg_conf / 100.0))
    score = 50.0 + (raw - 50.0) * conf_factor
    if risk_vetoed:
        score = min(score, _VETO_SCORE_CAP)

    score = max(0.0, min(100.0, score))
    return {
        "score": round(score, 2),
        "rating": score_to_rating(score),
        "breakdown": {
            "n_agents": n,
            "W": round(w_sum, 2),
            "D": round(d, 4),
            "raw": round(raw, 2),
            "avg_conf": round(avg_conf, 2),
            "conf_factor": round(conf_factor, 4),
            "risk_vetoed": bool(risk_vetoed),
        },
    }


def _neutral(risk_vetoed: bool, n: int) -> dict[str, Any]:
    """无可用输入时的中性兜底。risk_vetoed 仍压低分到回避档。"""
    score = min(50.0, _VETO_SCORE_CAP) if risk_vetoed else 50.0
    return {
        "score": round(score, 2),
        "rating": score_to_rating(score),
        "breakdown": {
            "n_agents": n,
            "W": 0.0,
            "D": 0.0,
            "raw": 50.0,
            "avg_conf": 0.0,
            "conf_factor": 0.0,
            "risk_vetoed": bool(risk_vetoed),
        },
    }


def _to_float(value: Any, default: float = 0.0) -> float:
    """容错把任意值转 float; 失败返回 default。"""
    try:
        if value is None:
            return default
        f = float(value)
        if f != f or f in (float("inf"), float("-inf")):  # NaN / inf
            return default
        return f
    except (TypeError, ValueError):
        return default
