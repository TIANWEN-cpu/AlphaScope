"""数据源健康监控

汇总所有 Provider 的健康状态, 提供前端展示接口。
"""

from __future__ import annotations

import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)


class SourceHealthMonitor:
    """数据源健康监控器"""

    def __init__(self) -> None:
        self._check_interval = 300  # 5分钟检查一次
        self._last_check = 0.0

    def get_health_report(self) -> dict:
        """获取所有数据源的健康报告"""
        try:
            from backend.providers.registry import get_registry
            registry = get_registry()
            providers = registry.get_all_health()

            healthy = sum(1 for p in providers if p["status"] == "healthy")
            degraded = sum(1 for p in providers if p["status"] == "degraded")
            unhealthy = sum(1 for p in providers if p["status"] == "unhealthy")

            return {
                "timestamp": time.time(),
                "total": len(providers),
                "healthy": healthy,
                "degraded": degraded,
                "unhealthy": unhealthy,
                "providers": providers,
            }
        except Exception as e:
            logger.error("获取健康报告失败: %s", e)
            return {
                "timestamp": time.time(),
                "total": 0,
                "healthy": 0,
                "degraded": 0,
                "unhealthy": 0,
                "providers": [],
                "error": str(e),
            }

    def get_source_summary(self) -> str:
        """生成数据源状态摘要 (适合 LLM 上下文)"""
        report = self.get_health_report()
        lines = [f"数据源状态: {report['healthy']}/{report['total']} 正常"]
        for p in report.get("providers", []):
            status_icon = {"healthy": "✓", "degraded": "⚠", "unhealthy": "✗"}.get(
                p["status"], "?"
            )
            latency = f"{p['avg_latency_ms']:.0f}ms" if p["avg_latency_ms"] > 0 else "N/A"
            lines.append(f"  {status_icon} {p['name']}: {p['status']} ({latency})")
        return "\n".join(lines)
