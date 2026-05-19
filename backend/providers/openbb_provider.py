"""OpenBB Provider - 全球金融数据集成层

覆盖: 美股/港股行情, 宏观数据, FRED, SEC辅助
"""

from __future__ import annotations

import logging

from .base import BaseProvider

logger = logging.getLogger(__name__)


class OpenBBProvider(BaseProvider):
    name = "openbb"
    markets = ["US", "HK", "ALL"]
    data_types = ["prices", "fundamentals", "news"]
    priority = 75
    license_level = "public"

    def get_prices(self, query: dict, **kwargs) -> list[dict]:
        try:
            from openbb import obb

            symbol = query.get("symbol", "")
            if not symbol:
                return []
            start = query.get("start_date", "")
            end = query.get("end_date", "")

            df = obb.equity.price.historical(
                symbol=symbol,
                start_date=start if start else None,
                end_date=end if end else None,
                provider="yfinance",
            ).to_df()

            if df is None or len(df) == 0:
                return []

            results = []
            for date, row in df.iterrows():
                results.append(
                    {
                        "symbol": symbol,
                        "market": query.get("market", "US"),
                        "date": str(date),
                        "open": float(row.get("open", 0)),
                        "high": float(row.get("high", 0)),
                        "low": float(row.get("low", 0)),
                        "close": float(row.get("close", 0)),
                        "volume": float(row.get("volume", 0)),
                        "amount": 0,
                        "source": "openbb",
                    }
                )
            return results
        except Exception as e:
            logger.debug("OpenBB prices failed: %s", e)
            return []

    def get_fundamentals(self, query: dict, **kwargs) -> dict:
        try:
            from openbb import obb

            symbol = query.get("symbol", "")
            if not symbol:
                return {}

            profile = obb.equity.profile(symbol=symbol).to_dict()
            return {"profile": profile, "source": "openbb"}
        except Exception as e:
            logger.debug("OpenBB fundamentals failed: %s", e)
            return {}
