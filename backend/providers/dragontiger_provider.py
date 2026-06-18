"""龙虎榜 Provider - A 股「机构 vs 游资」席位分析。

数据源: akshare 龙虎榜(免费、无需 key)。逻辑见 :mod:`backend.dragon_tiger`。
移植自 UZI-Skill (MIT)，见 ``docs/uzi-integration/ATTRIBUTION.md``。
"""

from __future__ import annotations

import logging
import re

from backend.dragon_tiger import lhb as _lhb
from backend.dragon_tiger.seat_db import (
    SEATS,
    match_seats_in_lhb,
    split_inst_vs_youzi,
)

from .base import BaseProvider

logger = logging.getLogger(__name__)


def _normalize_cn_code(symbol: str) -> str:
    """归一化为 6 位 A 股代码;非 A 股/无法识别返回空串。

    支持 ``600519`` / ``sh600519`` / ``600519.SH`` / ``SZ000001`` 等写法。
    """
    s = str(symbol or "").strip().upper()
    s = s.replace("SH", "").replace("SZ", "").replace("BJ", "")
    m = re.search(r"\d{6}", s)
    return m.group(0) if m else ""


class DragonTigerProvider(BaseProvider):
    """龙虎榜席位分析 Provider(仅 A 股)。"""

    name = "dragontiger"
    markets = ["CN"]
    data_types = ["dragon_tiger"]
    priority = 60
    license_level = "research_only"
    data_class = "event"
    freshness = "daily"
    cost_tier = "free"
    requires_key = False

    @classmethod
    def is_available(cls) -> bool:
        try:
            import akshare  # noqa: F401

            return True
        except Exception:
            return False

    def get_dragon_tiger(self, query: dict, **kwargs) -> dict:
        """取个股龙虎榜 + 游资席位匹配 + 机构/游资净额拆分。

        Args:
            query: ``{"symbol": "600519", "days": 30, ...}``。

        Returns:
            汇总字典;无龙虎榜或非 A 股时 ``lhb_count_30d=0``。
        """
        code = _normalize_cn_code(query.get("symbol", ""))
        if not code:
            return {}
        days = int(query.get("days", 30) or 30)

        records = self._timed_call(_lhb.fetch_lhb_recent, code, days)
        matched = match_seats_in_lhb(records)
        split = split_inst_vs_youzi(records)

        try:
            sector = _lhb.fetch_sector_lhb(top=30)
        except Exception:
            sector = []

        return {
            "code": code,
            "lhb_count_30d": len(records),
            "lhb_records": records[:30],
            "matched_youzi": list(matched.keys()),
            "matched_youzi_detail": {
                nick: {
                    "tier": SEATS.get(nick, {}).get("tier"),
                    "style": SEATS.get(nick, {}).get("style"),
                    "premium": SEATS.get(nick, {}).get("premium"),
                    "hits": rows[:3],
                }
                for nick, rows in matched.items()
            },
            "inst_vs_youzi": split,
            "sector_lhb_top": sector[:30],
            "source": "akshare:stock_lhb_stock_detail_em + seat_db",
        }
