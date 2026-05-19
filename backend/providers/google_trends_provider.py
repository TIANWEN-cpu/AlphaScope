"""Google Trends Provider - retail attention shifts (free via pytrends, 50 req/day soft limit)"""

from __future__ import annotations

import logging

from backend.providers.base import BaseProvider

logger = logging.getLogger(__name__)


class GoogleTrendsProvider(BaseProvider):
    """Google Trends data provider for retail attention

    Sudden spikes in search volume often precede price movements.
    Academic research validates Google Trends as a leading indicator for retail attention.
    """

    name = "google_trends"
    markets = ["GLOBAL"]
    data_types = ["sentiment", "alternative", "attention"]
    priority = 60
    license_level = "public"
    data_class = "alternative"
    freshness = "daily"
    cost_tier = "free"
    rate_limit = {"per_minute": 5, "per_day": 50}
    requires_key = False

    def get_sentiment(self, query: dict, **kwargs) -> dict:
        """Get Google Trends interest over time for a stock/company"""
        keyword = query.get("keyword") or query.get("symbol", "")
        if not keyword:
            return {}
        try:
            from pytrends.request import TrendReq

            pytrends = TrendReq(hl="en-US", tz=360)
            pytrends.build_payload(
                kw_list=[keyword],
                timeframe=query.get("timeframe", "today 3-m"),
                geo=query.get("geo", ""),
            )
            df = pytrends.interest_over_time()
            if df is None or df.empty:
                return {}

            # Calculate trend: compare last week vs previous week
            values = df[keyword].tolist()
            if len(values) >= 2:
                recent = sum(values[-7:]) / 7 if len(values) >= 7 else values[-1]
                previous = sum(values[-14:-7]) / 7 if len(values) >= 14 else values[0]
                trend_pct = ((recent - previous) / max(previous, 1)) * 100
            else:
                trend_pct = 0
                recent = values[-1] if values else 0

            return {
                "keyword": keyword,
                "current_interest": int(recent),
                "trend_pct": round(trend_pct, 1),
                "data_points": len(values),
                "source": "google_trends",
            }
        except Exception as e:
            logger.warning("Google Trends failed: %s", e)
            return {}

    def get_related_queries(self, query: dict, **kwargs) -> dict:
        """Get related queries for a keyword"""
        keyword = query.get("keyword") or query.get("symbol", "")
        if not keyword:
            return {}
        try:
            from pytrends.request import TrendReq

            pytrends = TrendReq(hl="en-US", tz=360)
            pytrends.build_payload(kw_list=[keyword], timeframe="today 3-m")
            related = pytrends.related_queries()
            result = {}
            if keyword in related:
                top = related[keyword].get("top")
                rising = related[keyword].get("rising")
                if top is not None:
                    result["top_queries"] = top.to_dict("records")[:10]
                if rising is not None:
                    result["rising_queries"] = rising.to_dict("records")[:10]
            return result
        except Exception as e:
            logger.warning("Google Trends related queries failed: %s", e)
            return {}

    def get_news(self, query: dict, **kwargs) -> list[dict]:
        """Google Trends doesn't provide news"""
        return []
