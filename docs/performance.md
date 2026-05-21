# 性能优化

v0.69 新增功能。缓存、重试、并发控制。

## 模块

### TTLCache — 内存缓存

```python
from backend.cache import TTLCache, get_cached

# 全局缓存
cache = TTLCache(max_size=1000)
cache.set("key", value, ttl_seconds=300)
val = cache.get("key")

# 便捷函数（缓存未命中时调用 factory）
data = get_cached("news:600519", lambda: fetch_news("600519"), ttl_seconds=180)
```

特性：
- 线程安全
- 自动过期淘汰
- LRU 风格超限淘汰
- 命中率统计

### retry_with_backoff — 重试装饰器

```python
from backend.retry import retry_with_backoff

@retry_with_backoff(max_retries=3, base_delay=1.0, max_delay=30.0)
def call_api():
    ...
```

特性：
- 指数退避 + 随机抖动
- 可指定重试的异常类型
- 重试回调

### ConcurrencyLimiter — 并发限制

```python
from backend.concurrency import ConcurrencyLimiter, get_llm_limiter

limiter = get_llm_limiter()  # 默认最大 10 并发
with limiter.acquire(timeout=60):
    call_llm(...)
```

特性：
- 全局信号量
- 超时抛 TimeoutError
- 活跃数/拒绝数统计

## 全局实例

| 实例 | 最大并发 | 用途 |
|------|---------|------|
| `get_llm_limiter()` | 10 | LLM API 调用 |
| `get_data_limiter()` | 20 | 数据获取 |
| `get_cache()` | 2000 项 | 通用缓存 |
