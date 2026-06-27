"""ProviderCapability 能力 schema 测试(v1.9.4, deep-research)。

验证 BaseProvider.capability() 返回统一 schema, 对标 tickflow tiers.yaml 能力驱动。
- schema 字段齐全(markets/data_types/freshness/latency_tier/cost_tier/rate_limit/trust_level/priority/requires_key/available/degradable)
- 不同 freshness → 不同 latency_tier
- registry.get_all_capabilities() 聚合
"""

from __future__ import annotations

from backend.providers.base import BaseProvider
from backend.providers.registry import ProviderRegistry


class _FakeRealtimeProvider(BaseProvider):
    name = "fake_realtime"
    markets = ["CN"]
    data_types = ["prices", "realtime"]
    data_class = "price"
    freshness = "realtime"
    cost_tier = "freemium"
    rate_limit = {"per_minute": 30, "per_day": 1000}
    priority = 90
    license_level = "research_only"
    requires_key = True

    @classmethod
    def is_available(cls) -> bool:  # 避免触发真实依赖检查
        return True


class _FakeDailyProvider(BaseProvider):
    name = "fake_daily"
    markets = ["CN", "HK"]
    data_types = ["news"]
    data_class = "sentiment"
    freshness = "daily"
    cost_tier = "free"
    rate_limit = {"per_minute": 60, "per_day": None}
    priority = 50
    requires_key = False


REQUIRED_FIELDS = {
    "name",
    "markets",
    "data_types",
    "data_class",
    "freshness",
    "latency_tier",
    "cost_tier",
    "rate_limit",
    "trust_level",
    "priority",
    "requires_key",
    "available",
    "degradable",
}


def test_capability_schema_complete():
    cap = _FakeRealtimeProvider().capability()
    assert REQUIRED_FIELDS.issubset(cap.keys())
    assert cap["name"] == "fake_realtime"
    assert cap["markets"] == ["CN"]
    assert cap["data_types"] == ["prices", "realtime"]
    assert cap["freshness"] == "realtime"
    assert cap["requires_key"] is True
    assert cap["available"] is True
    assert cap["rate_limit"] == {"per_minute": 30, "per_day": 1000}


def test_latency_tier_maps_from_freshness():
    assert _FakeRealtimeProvider().capability()["latency_tier"] == "realtime"
    assert _FakeDailyProvider().capability()["latency_tier"] == "medium"


def test_degradable_reflects_priority():
    # 高优先级(=100)源不可降级; 普通源可降级
    rt = _FakeRealtimeProvider().capability()
    daily = _FakeDailyProvider().capability()
    assert rt["degradable"] is True  # priority 90 < 100
    assert daily["degradable"] is True  # 普通源(priority 50)可降级

    # priority 100 的源不可降级
    class _Top(BaseProvider):
        name = "top"
        priority = 100

    assert _Top().capability()["degradable"] is False


def test_registry_aggregates_capabilities():
    reg = ProviderRegistry()
    reg._providers["fake_realtime"] = _FakeRealtimeProvider()
    reg._providers["fake_daily"] = _FakeDailyProvider()
    caps = reg.get_all_capabilities()
    assert len(caps) == 2
    names = {c["name"] for c in caps}
    assert names == {"fake_realtime", "fake_daily"}
    assert all(REQUIRED_FIELDS.issubset(c.keys()) for c in caps)
