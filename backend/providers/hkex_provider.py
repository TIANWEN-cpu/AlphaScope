"""HKEXnews Provider - 港股公告核心源

注意: HKEXnews 有版权和免责声明, 仅保存元数据和URL, 不建议全文搬运
"""

from __future__ import annotations

import logging

import requests

from .base import BaseProvider

logger = logging.getLogger(__name__)

HKEX_SEARCH_URL = "https://www1.hkexnews.hk/search/titlesearch.xhtml"


class HKEXProvider(BaseProvider):
    name = "hkex"
    markets = ["HK"]
    data_types = ["announcements"]
    priority = 95
    license_level = "restricted"

    def get_announcements(self, query: dict, **kwargs) -> list[dict]:
        symbol = query.get("symbol", "")
        if not symbol:
            return []

        try:
            params = {
                "lang": "ZH",
                "stock": symbol,
                "category": query.get("category", "0"),
                "from": query.get("start_date", ""),
                "to": query.get("end_date", ""),
            }
            resp = requests.get(HKEX_SEARCH_URL, params=params, timeout=15)
            resp.raise_for_status()

            # 解析HTML返回 (HKEXnews 返回HTML片段)
            from html.parser import HTMLParser

            results = []
            # 简单提取标题和链接
            text = resp.text
            # 实际解析需要更复杂的HTML解析
            # 这里提供基础框架
            logger.info("HKEX response received for %s, length=%d", symbol, len(text))

            return results
        except Exception as e:
            logger.debug("HKEX announcements failed: %s", e)
            return []
