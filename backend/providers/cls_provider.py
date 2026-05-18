"""财联社 Provider - 实时快讯"""

from __future__ import annotations

import logging

from .base import BaseProvider

logger = logging.getLogger(__name__)


class CLSProvider(BaseProvider):
    name = "cls"
    markets = ["CN"]
    data_types = ["news"]
    priority = 80
    license_level = "research_only"

    def get_news(self, query: dict, **kwargs) -> list[dict]:
        try:
            import akshare as ak

            df = ak.stock_info_global_cls(symbol="全部")
            if df is None or len(df) == 0:
                return []
            results = []
            for _, row in df.head(query.get("limit", 30)).iterrows():
                results.append({
                    "source": "cls",
                    "upstream": "cls",
                    "title": str(row.get("标题", "")).strip(),
                    "summary": str(row.get("内容", "")).strip()[:200],
                    "datetime": f"{row.get('发布日期', '')} {row.get('发布时间', '')}".strip(),
                    "url": "",
                })
            return results
        except Exception as e:
            logger.debug("CLS news failed: %s", e)
            return []
