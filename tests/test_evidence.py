"""数据源与证据链测试"""

from __future__ import annotations


def test_data_source_result_schema():
    """DataSourceResult 可正常实例化"""
    from backend.schemas.data_source import DataSourceResult

    r = DataSourceResult(
        title="测试新闻",
        source="akshare",
        source_name="AkShare",
        source_url="https://example.com/news/1",
        data_type="news",
        symbols=["600519"],
    )
    assert r.source == "akshare"
    assert r.source_url == "https://example.com/news/1"
    assert r.confidence == 0.7  # 默认值
    assert "600519" in r.symbols


def test_provider_health_status_schema():
    """ProviderHealthStatus 可正常实例化"""
    from backend.schemas.data_source import ProviderHealthStatus

    h = ProviderHealthStatus(
        name="akshare",
        status="healthy",
        consecutive_failures=0,
        data_types=["news", "prices"],
        markets=["CN"],
    )
    assert h.name == "akshare"
    assert h.status == "healthy"
    assert h.avg_latency_ms == 0.0


def test_data_source_status_schema():
    """DataSourceStatus 可正常实例化"""
    from backend.schemas.data_source import DataSourceStatus, ProviderHealthStatus

    s = DataSourceStatus(
        total_providers=5,
        healthy=4,
        degraded=1,
        unhealthy=0,
        providers=[
            ProviderHealthStatus(name="akshare", status="healthy"),
            ProviderHealthStatus(name="cls", status="degraded"),
        ],
    )
    assert s.total_providers == 5
    assert s.healthy == 4
    assert len(s.providers) == 2


def test_base_provider_health_tracking():
    """BaseProvider 健康追踪机制正常工作"""
    from backend.providers.base import BaseProvider, ProviderStatus

    class DummyProvider(BaseProvider):
        name = "dummy"
        markets = ["CN"]
        data_types = ["news"]

    p = DummyProvider()
    assert p.health.status == ProviderStatus.HEALTHY
    assert p.health.consecutive_failures == 0

    # Record success
    p._record_success(100.0)
    assert p.health.status == ProviderStatus.HEALTHY
    assert p.health.consecutive_failures == 0
    assert p.health.avg_latency_ms > 0

    # Record failures
    p._record_failure("error 1")
    assert p.health.status == ProviderStatus.DEGRADED
    assert p.health.consecutive_failures == 1

    p._record_failure("error 2")
    assert p.health.status == ProviderStatus.DEGRADED
    assert p.health.consecutive_failures == 2

    p._record_failure("error 3")
    assert p.health.status == ProviderStatus.UNHEALTHY
    assert p.health.consecutive_failures == 3

    # Recovery
    p._record_success(50.0)
    assert p.health.status == ProviderStatus.HEALTHY
    assert p.health.consecutive_failures == 0


def test_timed_call_success():
    """_timed_call 成功时记录成功"""
    import time

    from backend.providers.base import BaseProvider, ProviderStatus

    class DummyProvider(BaseProvider):
        name = "dummy"
        markets = ["CN"]
        data_types = ["news"]

    p = DummyProvider()
    result = p._timed_call(lambda: time.sleep(0.01) or "ok")
    assert result == "ok"
    assert p.health.status == ProviderStatus.HEALTHY
    assert p.health.avg_latency_ms >= 0


def test_timed_call_failure():
    """_timed_call 失败时记录失败并抛出异常"""
    from backend.providers.base import BaseProvider, ProviderStatus

    class DummyProvider(BaseProvider):
        name = "dummy"
        markets = ["CN"]
        data_types = ["news"]

    p = DummyProvider()
    try:
        p._timed_call(lambda: (_ for _ in ()).throw(ValueError("test error")))
    except ValueError:
        pass
    assert p.health.status == ProviderStatus.DEGRADED
    assert p.health.consecutive_failures == 1
    assert "test error" in p.health.error_message


def test_evidence_aggregator_fix():
    """EvidenceAggregator.collect_and_validate 不再调用不存在的 fetch()"""
    from backend.quality.evidence_aggregator import EvidenceAggregator

    # 空 registry 应返回空结果（不崩溃）
    agg = EvidenceAggregator(registry=None)
    result = agg.collect_and_validate("600519", "news", max_sources=3)
    assert result.data_type == "news"
    assert result.items == []
    assert result.sources == []


def test_provider_registry_has_providers():
    """Provider Registry 能发现 providers"""
    from backend.providers.registry import get_registry

    registry = get_registry()
    # 应至少发现几个 providers
    assert hasattr(registry, "_providers")
    assert len(registry._providers) >= 1
