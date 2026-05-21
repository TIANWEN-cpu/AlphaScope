"""重试装饰器 — 指数退避 + 抖动"""

from __future__ import annotations

import logging
import random
import time
from functools import wraps
from typing import Any, Callable, Type

logger = logging.getLogger(__name__)


def retry_with_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    exceptions: tuple[Type[Exception], ...] = (Exception,),
    on_retry: Callable[[Exception, int], None] | None = None,
) -> Callable:
    """重试装饰器，指数退避 + 随机抖动。

    用法：
        @retry_with_backoff(max_retries=3, base_delay=1.0)
        def call_api():
            ...

        @retry_with_backoff(exceptions=(ConnectionError, TimeoutError))
        def fetch_data():
            ...
    """

    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    return fn(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt == max_retries:
                        logger.error(
                            "%s 在 %d 次重试后仍然失败: %s",
                            fn.__name__,
                            max_retries,
                            e,
                        )
                        raise

                    delay = min(base_delay * (2**attempt), max_delay)
                    jitter = random.uniform(0, delay * 0.3)
                    total_delay = delay + jitter

                    if on_retry:
                        on_retry(e, attempt + 1)

                    logger.warning(
                        "%s 第 %d 次重试，等待 %.1fs: %s",
                        fn.__name__,
                        attempt + 1,
                        total_delay,
                        e,
                    )
                    time.sleep(total_delay)

            raise last_exception  # type: ignore[misc]

        return wrapper

    return decorator
