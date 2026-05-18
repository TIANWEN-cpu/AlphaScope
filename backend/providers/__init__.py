"""Provider 插件体系 - AI-Finance v0.11

所有数据源统一抽象为 Provider 插件, 支持:
- 统一接口: get_news/get_reports/get_announcements/get_prices/get_fundamentals
- 自动优先级选择: ProviderRegistry 按 market + data_type 自动选源
- 健康检查: health_check() 探测数据源可用性
- 故障降级: 主源失败自动尝试备源
"""

from .base import BaseProvider, ProviderStatus
from .registry import ProviderRegistry, get_registry

__all__ = ["BaseProvider", "ProviderStatus", "ProviderRegistry", "get_registry"]
