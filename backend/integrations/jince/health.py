"""Jince 健康检查 — 供 /health 端点调用"""

from __future__ import annotations

from typing import Any

from .client import JinceClient
from .errors import JinceConnectionError, JinceTimeoutError


async def check_jince_health(
    client: JinceClient | None = None,
) -> dict[str, Any]:
    """检查 Jince 服务健康状态

    返回 dict:
        status: "ok" | "disconnected" | "error"
        version: str | None
        error: str | None
    """
    if client is None:
        client = JinceClient()
    try:
        data = await client.get_status()
        return {
            "status": "ok",
            "version": data.get("version"),
            "error": None,
        }
    except (JinceConnectionError, JinceTimeoutError):
        return {
            "status": "disconnected",
            "version": None,
            "error": "外部回测服务未运行",
        }
    except Exception as e:
        return {
            "status": "error",
            "version": None,
            "error": str(e),
        }
