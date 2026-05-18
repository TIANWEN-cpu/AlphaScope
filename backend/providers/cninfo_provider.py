"""巨潮资讯 CNINFO Provider - A股公告核心源"""

from __future__ import annotations

import logging

from .base import BaseProvider

logger = logging.getLogger(__name__)


class CNInfoProvider(BaseProvider):
    name = "cninfo"
    markets = ["CN"]
    data_types = ["announcements"]
    priority = 95
    license_level = "public"

    def get_announcements(self, query: dict, **kwargs) -> list[dict]:
        symbol = query.get("symbol", "")
        if not symbol:
            return []
        try:
            import akshare as ak

            df = ak.stock_zh_a_disclosure_report_cninfo(
                symbol=symbol,
                market="",
                keyword=query.get("keywords", ""),
                category=query.get("category", ""),
                start_date=query.get("start_date", ""),
                end_date=query.get("end_date", ""),
            )
            if df is None or len(df) == 0:
                return []
            results = []
            for _, row in df.head(query.get("limit", 50)).iterrows():
                results.append({
                    "source": "cninfo",
                    "upstream": "cninfo",
                    "symbol": symbol,
                    "title": str(row.get("公告标题", "")).strip(),
                    "datetime": str(row.get("公告时间", "")).strip(),
                    "url": str(row.get("公告链接", "")).strip(),
                })
            return results
        except Exception as e:
            logger.debug("CNInfo announcements failed: %s", e)
            return []
