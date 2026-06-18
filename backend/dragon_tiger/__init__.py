"""龙虎榜 / 游资席位分析 (A 股).

提供:
- 游资席位库与席位匹配 (:mod:`backend.dragon_tiger.seat_db`)
- akshare 龙虎榜抓取与机构/游资净额拆分 (:mod:`backend.dragon_tiger.lhb`)
- 杀猪盘信号扫描 (:mod:`backend.dragon_tiger.trap_signals`)

数据/逻辑移植并改编自 UZI-Skill (MIT)，详见
``docs/uzi-integration/ATTRIBUTION.md``。
"""

from __future__ import annotations

from .seat_db import (
    SEATS,
    is_in_range,
    match_seats_in_lhb,
    split_inst_vs_youzi,
)

__all__ = [
    "SEATS",
    "match_seats_in_lhb",
    "split_inst_vs_youzi",
    "is_in_range",
]
