"""BaoStock Provider - A股行情兜底数据源

免费, 无需API Key, 适合行情校验和回测
"""

from __future__ import annotations

import logging

from .base import BaseProvider

logger = logging.getLogger(__name__)


class BaoStockProvider(BaseProvider):
    name = "baostock"
    markets = ["CN"]
    data_types = ["prices", "fundamentals"]
    priority = 50
    license_level = "public"

    def get_prices(self, query: dict, **kwargs) -> list[dict]:
        symbol = query.get("symbol", "")
        if not symbol:
            return []

        # BaoStock 使用 sh.600519 / sz.000001 格式
        if "." not in symbol:
            if symbol.startswith(("60", "68", "9")):
                bs_code = f"sh.{symbol}"
            elif symbol.startswith(("00", "30", "20")):
                bs_code = f"sz.{symbol}"
            else:
                bs_code = f"bj.{symbol}"
        else:
            bs_code = symbol

        try:
            import baostock as bs

            bs.login()
            start = query.get("start_date", "2024-01-01")
            end = query.get("end_date", "")
            fields = "date,open,high,low,close,volume,amount,turn,pctChg"

            rs = bs.query_history_k_data_plus(
                bs_code,
                fields,
                start_date=start,
                end_date=end or "",
                frequency=query.get("frequency", "d"),
                adjustflag="2",  # 前复权
            )

            results = []
            while rs.error_code == "0" and rs.next():
                row = rs.get_row_data()
                results.append(
                    {
                        "symbol": symbol,
                        "market": "CN",
                        "date": row[0],
                        "open": float(row[1]) if row[1] else 0,
                        "high": float(row[2]) if row[2] else 0,
                        "low": float(row[3]) if row[3] else 0,
                        "close": float(row[4]) if row[4] else 0,
                        "volume": float(row[5]) if row[5] else 0,
                        "amount": float(row[6]) if row[6] else 0,
                        "turnover": float(row[7]) if row[7] else 0,
                        "change_pct": float(row[8]) if row[8] else 0,
                        "source": "baostock",
                    }
                )
            bs.logout()
            return results
        except Exception as e:
            logger.debug("BaoStock prices failed: %s", e)
            return []

    def get_fundamentals(self, query: dict, **kwargs) -> dict:
        symbol = query.get("symbol", "")
        if not symbol:
            return {}

        if "." not in symbol:
            if symbol.startswith(("60", "68", "9")):
                bs_code = f"sh.{symbol}"
            else:
                bs_code = f"sz.{symbol}"
        else:
            bs_code = symbol

        try:
            import baostock as bs

            bs.login()
            year = query.get("year", "2025")
            quarter = query.get("quarter", "4")

            rs = bs.query_profit_data(code=bs_code, year=year, quarter=quarter)
            profit_data = []
            while rs.error_code == "0" and rs.next():
                profit_data.append(rs.get_row_data())

            rs = bs.query_growth_data(code=bs_code, year=year, quarter=quarter)
            growth_data = []
            while rs.error_code == "0" and rs.next():
                growth_data.append(rs.get_row_data())

            bs.logout()
            return {
                "profit": profit_data,
                "growth": growth_data,
                "source": "baostock",
            }
        except Exception as e:
            logger.debug("BaoStock fundamentals failed: %s", e)
            return {}
