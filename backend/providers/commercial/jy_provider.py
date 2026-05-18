"""恒生聚源 Provider - 金融数据库 (Stub)

恒生聚源是国内机构级金融数据库, 覆盖行情、资讯、终端、机构服务。
需要聚源账号和 API 授权。
"""

from __future__ import annotations

import logging
import os

from ..base import BaseProvider

logger = logging.getLogger(__name__)


class JYProvider(BaseProvider):
    name = "jy"
    markets = ["CN"]
    data_types = ["news", "reports", "announcements", "prices", "fundamentals"]
    priority = 96
    license_level = "commercial"

    def __init__(self) -> None:
        super().__init__()
        self._api_key = os.environ.get("JY_API_KEY", "")

    def _check_available(self) -> bool:
        if not self._api_key:
            logger.debug("聚源 API Key 未配置 (JY_API_KEY)")
            return False
        return True

    def get_news(self, query: dict, **kwargs) -> list[dict]:
        raise NotImplementedError("聚源 Provider 需要配置 JY_API_KEY")

    def get_reports(self, query: dict, **kwargs) -> list[dict]:
        raise NotImplementedError("聚源 Provider 需要配置 JY_API_KEY")

    def get_announcements(self, query: dict, **kwargs) -> list[dict]:
        raise NotImplementedError("聚源 Provider 需要配置 JY_API_KEY")

    def get_prices(self, query: dict, **kwargs) -> list[dict]:
        raise NotImplementedError("聚源 Provider 需要配置 JY_API_KEY")

    def get_fundamentals(self, query: dict, **kwargs) -> dict:
        raise NotImplementedError("聚源 Provider 需要配置 JY_API_KEY")
