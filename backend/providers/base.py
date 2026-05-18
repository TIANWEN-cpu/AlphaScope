"""Provider 基类 - 所有数据源插件必须继承此类"""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ProviderStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unknown"


@dataclass
class ProviderHealth:
    """数据源健康状态"""

    status: ProviderStatus = ProviderStatus.HEALTHY
    last_check: float = 0.0
    last_success: float = 0.0
    consecutive_failures: int = 0
    avg_latency_ms: float = 0.0
    error_message: str = ""


class BaseProvider(ABC):
    """数据源 Provider 基类

    所有数据源插件必须继承此类并实现所需方法。
    子类应设置以下类属性:
        name: str           - Provider 名称
        markets: list[str]  - 支持的市场 (CN/HK/US)
        data_types: list[str] - 支持的数据类型 (news/report/announcement/price/fundamental)
        priority: int       - 默认优先级 (0-100, 越高越优先)
        license_level: str  - 数据许可级别
    """

    name: str = "base"
    markets: list[str] = field(default_factory=list)
    data_types: list[str] = field(default_factory=list)
    priority: int = 50
    license_level: str = "research_only"

    def __init__(self) -> None:
        self._health = ProviderHealth()
        self._logger = logging.getLogger(f"provider.{self.name}")

    @property
    def health(self) -> ProviderHealth:
        return self._health

    def _record_success(self, latency_ms: float) -> None:
        """记录一次成功调用"""
        self._health.last_success = time.time()
        self._health.last_check = time.time()
        self._health.consecutive_failures = 0
        self._health.status = ProviderStatus.HEALTHY
        self._health.error_message = ""
        # 指数移动平均
        alpha = 0.3
        self._health.avg_latency_ms = (
            alpha * latency_ms + (1 - alpha) * self._health.avg_latency_ms
        )

    def _record_failure(self, error: str) -> None:
        """记录一次失败调用"""
        self._health.last_check = time.time()
        self._health.consecutive_failures += 1
        self._health.error_message = error
        if self._health.consecutive_failures >= 3:
            self._health.status = ProviderStatus.UNHEALTHY
        else:
            self._health.status = ProviderStatus.DEGRADED
        self._logger.warning(f"[{self.name}] 调用失败: {error}")

    def _timed_call(self, fn, *args, **kwargs):
        """包装调用, 自动计时和记录健康状态"""
        start = time.time()
        try:
            result = fn(*args, **kwargs)
            latency = (time.time() - start) * 1000
            self._record_success(latency)
            return result
        except Exception as e:
            self._record_failure(str(e))
            raise

    def health_check(self) -> dict:
        """健康检查, 返回 Provider 状态信息"""
        return {
            "name": self.name,
            "status": self._health.status.value,
            "last_success": self._health.last_success,
            "consecutive_failures": self._health.consecutive_failures,
            "avg_latency_ms": round(self._health.avg_latency_ms, 1),
            "error": self._health.error_message,
        }

    # ---- 数据获取接口 (子类按需实现) ----

    def get_news(self, query: dict, **kwargs) -> list[dict]:
        """获取新闻数据"""
        raise NotImplementedError(f"{self.name} 不支持 get_news")

    def get_reports(self, query: dict, **kwargs) -> list[dict]:
        """获取研报数据"""
        raise NotImplementedError(f"{self.name} 不支持 get_reports")

    def get_announcements(self, query: dict, **kwargs) -> list[dict]:
        """获取公告数据"""
        raise NotImplementedError(f"{self.name} 不支持 get_announcements")

    def get_prices(self, query: dict, **kwargs) -> list[dict]:
        """获取行情数据"""
        raise NotImplementedError(f"{self.name} 不支持 get_prices")

    def get_fundamentals(self, query: dict, **kwargs) -> dict:
        """获取基本面数据"""
        raise NotImplementedError(f"{self.name} 不支持 get_fundamentals")

    def get_fund_flow(self, query: dict, **kwargs) -> list[dict]:
        """获取资金流数据"""
        raise NotImplementedError(f"{self.name} 不支持 get_fund_flow")
