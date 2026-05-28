"""Bounded execution helpers for blocking provider calls."""

from __future__ import annotations

import queue
import threading
from collections.abc import Callable
from typing import Any, TypeVar

_T = TypeVar("_T")


def call_with_timeout(
    fn: Callable[[], _T],
    timeout: float,
    *,
    name: str = "provider-call",
) -> _T:
    """Run a blocking provider call without letting a request hang indefinitely."""

    result_queue: queue.Queue[tuple[bool, Any]] = queue.Queue(maxsize=1)

    def worker() -> None:
        try:
            result_queue.put((True, fn()), block=False)
        except Exception as exc:
            try:
                result_queue.put((False, exc), block=False)
            except queue.Full:
                pass

    thread = threading.Thread(target=worker, name=name, daemon=True)
    thread.start()
    try:
        ok, payload = result_queue.get(timeout=timeout)
    except queue.Empty as exc:
        raise TimeoutError(f"{name} timed out") from exc
    if ok:
        return payload
    raise payload
