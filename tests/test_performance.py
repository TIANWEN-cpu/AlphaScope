"""Tests for Performance — TTLCache + 重试 + 并发限制"""

from __future__ import annotations

import time

import pytest


# ============== TTLCache 测试 ==============


class TestTTLCache:
    """测试 TTLCache"""

    def test_basic_set_get(self):
        from backend.cache import TTLCache

        cache = TTLCache()
        cache.set("key1", "value1", ttl_seconds=10)
        assert cache.get("key1") == "value1"

    def test_expired(self):
        from backend.cache import TTLCache

        cache = TTLCache()
        cache.set("key1", "value1", ttl_seconds=0)
        time.sleep(0.01)
        assert cache.get("key1") is None

    def test_miss(self):
        from backend.cache import TTLCache

        cache = TTLCache()
        assert cache.get("nonexistent") is None

    def test_delete(self):
        from backend.cache import TTLCache

        cache = TTLCache()
        cache.set("key1", "value1", ttl_seconds=10)
        cache.delete("key1")
        assert cache.get("key1") is None

    def test_clear(self):
        from backend.cache import TTLCache

        cache = TTLCache()
        cache.set("key1", "value1", ttl_seconds=10)
        cache.set("key2", "value2", ttl_seconds=10)
        cache.clear()
        assert cache.get("key1") is None
        assert cache.get("key2") is None

    def test_max_size_eviction(self):
        from backend.cache import TTLCache

        cache = TTLCache(max_size=3)
        cache.set("a", 1, ttl_seconds=10)
        cache.set("b", 2, ttl_seconds=10)
        cache.set("c", 3, ttl_seconds=10)
        cache.set("d", 4, ttl_seconds=10)  # 应触发淘汰
        assert cache.stats()["size"] <= 3

    def test_stats(self):
        from backend.cache import TTLCache

        cache = TTLCache()
        cache.set("key1", "value1", ttl_seconds=10)
        cache.get("key1")  # hit
        cache.get("missing")  # miss
        stats = cache.stats()
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["size"] == 1

    def test_get_cached(self):
        from backend.cache import get_cached

        # 清除全局缓存避免干扰
        from backend.cache import get_cache

        get_cache().clear()

        call_count = 0

        def factory():
            nonlocal call_count
            call_count += 1
            return "computed"

        result1 = get_cached("test_key", factory, ttl_seconds=10)
        result2 = get_cached("test_key", factory, ttl_seconds=10)
        assert result1 == "computed"
        assert result2 == "computed"
        assert call_count == 1  # factory 只调用一次

    def test_get_cached_none_not_cached(self):
        from backend.cache import get_cached, get_cache

        get_cache().clear()
        call_count = 0

        def factory():
            nonlocal call_count
            call_count += 1
            return None

        get_cached("none_key", factory, ttl_seconds=10)
        get_cached("none_key", factory, ttl_seconds=10)
        assert call_count == 2  # None 不缓存


# ============== 重试测试 ==============


class TestRetry:
    """测试 retry_with_backoff"""

    def test_success_first_try(self):
        from backend.retry import retry_with_backoff

        call_count = 0

        @retry_with_backoff(max_retries=3, base_delay=0.01)
        def succeed():
            nonlocal call_count
            call_count += 1
            return "ok"

        assert succeed() == "ok"
        assert call_count == 1

    def test_success_after_retries(self):
        from backend.retry import retry_with_backoff

        call_count = 0

        @retry_with_backoff(max_retries=3, base_delay=0.01)
        def fail_twice():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ValueError("not yet")
            return "ok"

        assert fail_twice() == "ok"
        assert call_count == 3

    def test_all_retries_exhausted(self):
        from backend.retry import retry_with_backoff

        @retry_with_backoff(max_retries=2, base_delay=0.01)
        def always_fail():
            raise RuntimeError("boom")

        with pytest.raises(RuntimeError, match="boom"):
            always_fail()

    def test_specific_exceptions(self):
        from backend.retry import retry_with_backoff

        call_count = 0

        @retry_with_backoff(max_retries=3, base_delay=0.01, exceptions=(ValueError,))
        def type_error():
            nonlocal call_count
            call_count += 1
            raise TypeError("wrong type")

        with pytest.raises(TypeError):
            type_error()
        assert call_count == 1  # 不重试 TypeError

    def test_on_retry_callback(self):
        from backend.retry import retry_with_backoff

        retries = []

        def on_retry(exc, attempt):
            retries.append(attempt)

        @retry_with_backoff(max_retries=2, base_delay=0.01, on_retry=on_retry)
        def fail_once():
            if not retries:
                raise ValueError("fail")
            return "ok"

        fail_once()
        assert retries == [1]


# ============== 并发限制测试 ==============


class TestConcurrencyLimiter:
    """测试 ConcurrencyLimiter"""

    def test_basic_acquire(self):
        from backend.concurrency import ConcurrencyLimiter

        limiter = ConcurrencyLimiter(max_concurrent=2)
        with limiter.acquire():
            assert limiter.stats()["active"] == 1
        assert limiter.stats()["active"] == 0

    def test_concurrent_limit(self):
        import threading
        from backend.concurrency import ConcurrencyLimiter

        limiter = ConcurrencyLimiter(max_concurrent=2)
        results = []

        def worker(i):
            try:
                with limiter.acquire(timeout=0.05):
                    time.sleep(0.2)  # 持有槽位足够久
                    results.append(f"ok-{i}")
            except TimeoutError:
                results.append(f"rejected-{i}")

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        ok_count = sum(1 for r in results if r.startswith("ok"))
        assert ok_count <= 2  # 最多 2 个成功

    def test_timeout(self):
        import threading
        from backend.concurrency import ConcurrencyLimiter

        limiter = ConcurrencyLimiter(max_concurrent=1)

        def hold():
            with limiter.acquire(timeout=5):
                time.sleep(0.2)

        holder = threading.Thread(target=hold)
        holder.start()
        time.sleep(0.01)

        with pytest.raises(TimeoutError):
            with limiter.acquire(timeout=0.01):
                pass

        holder.join()

    def test_stats(self):
        from backend.concurrency import ConcurrencyLimiter

        limiter = ConcurrencyLimiter(max_concurrent=5)
        stats = limiter.stats()
        assert stats["max_concurrent"] == 5
        assert stats["active"] == 0
        assert stats["total_acquired"] == 0

    def test_global_limiters(self):
        from backend.concurrency import get_data_limiter, get_llm_limiter

        llm = get_llm_limiter()
        data = get_data_limiter()
        assert llm.stats()["max_concurrent"] == 10
        assert data.stats()["max_concurrent"] == 20
