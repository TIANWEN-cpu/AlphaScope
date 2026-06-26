"""数据源质量评分测试(v1.9.4, compass §7.2)。

验证 compute_quality_score: 成功率 × 新鲜度 × 完整度, 纯函数可单测。
- 健康+新鲜+低延迟 → 高分 good
- 不健康/陈旧/高延迟 → 低分 poor
- 从未调用(last_success=0) → 新鲜度 0
"""

from __future__ import annotations

from backend.observability.source_health import (
    QUALITY_GOOD,
    QUALITY_WARN,
    SourceHealthMonitor,
    _quality_grade,
    compute_quality_score,
)


def test_healthy_fresh_fast_scores_high():
    now = 1_000_000.0
    h = {
        "status": "healthy",
        "consecutive_failures": 0,
        "last_success": now - 60,  # 1分钟前, 新鲜
        "avg_latency_ms": 120,
    }
    q = compute_quality_score(h, now=now)
    assert q["quality_score"] >= QUALITY_GOOD
    assert q["grade"] == "good"
    assert q["freshness_score"] == 100.0
    assert q["completeness_score"] == 100.0


def test_unhealthy_and_stale_scores_low():
    now = 1_000_000.0
    h = {
        "status": "unhealthy",
        "consecutive_failures": 5,
        "last_success": now - 100 * 3600,  # 100小时前, 严重过期
        "avg_latency_ms": 5000,
    }
    q = compute_quality_score(h, now=now)
    assert q["quality_score"] < QUALITY_WARN
    assert q["grade"] == "poor"


def test_never_called_has_zero_freshness():
    h = {"status": "healthy", "consecutive_failures": 0, "last_success": 0, "avg_latency_ms": 0}
    q = compute_quality_score(h, now=1_000_000.0)
    assert q["freshness_score"] == 0.0
    # 新鲜度 0 → 质量分必然 0(乘积)
    assert q["quality_score"] == 0.0


def test_grade_thresholds():
    assert _quality_grade(90) == "good"
    assert _quality_grade(QUALITY_GOOD) == "good"
    assert _quality_grade(60) == "warn"
    assert _quality_grade(QUALITY_WARN) == "warn"
    assert _quality_grade(49.9) == "poor"
    assert _quality_grade(0) == "poor"


def test_failures_reduce_success_rate():
    base = {
        "status": "healthy",
        "consecutive_failures": 0,
        "last_success": 999999,
        "avg_latency_ms": 100,
    }
    q0 = compute_quality_score(base, now=1_000_000.0)
    q3 = compute_quality_score({**base, "consecutive_failures": 3}, now=1_000_000.0)
    assert q3["success_rate"] < q0["success_rate"]


def test_quality_report_aggregates_grades():
    # 用 monkeypatch 让 monitor 返回构造数据
    mon = SourceHealthMonitor()
    fake = {
        "total": 2,
        "healthy": 1,
        "degraded": 0,
        "unhealthy": 1,
        "providers": [
            {
                "name": "good-src",
                "status": "healthy",
                "consecutive_failures": 0,
                "last_success": 999940,
                "avg_latency_ms": 100,
            },
            {
                "name": "bad-src",
                "status": "unhealthy",
                "consecutive_failures": 6,
                "last_success": 0,
                "avg_latency_ms": 6000,
            },
        ],
    }
    import backend.observability.source_health as sh

    orig = mon.get_health_report
    mon.get_health_report = lambda: fake  # type: ignore[method-assign]
    try:
        rep = mon.get_quality_report(now=1_000_000.0)
    finally:
        mon.get_health_report = orig  # type: ignore[method-assign]
    assert rep["quality_good"] >= 1
    assert rep["quality_poor"] >= 1
    assert "avg_quality" in rep
    assert all("quality_score" in p and "grade" in p for p in rep["providers"])
    # 保留对 sh 模块的引用避免 lint
    assert sh is not None
