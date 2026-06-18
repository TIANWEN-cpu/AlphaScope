"""akshare 龙虎榜抓取 (A 股，席位级)。

移植并改编自 UZI-Skill ``scripts/lib/data_sources.py::fetch_lhb_recent`` 与
``scripts/fetch_lhb.py`` (MIT)，见 ``docs/uzi-integration/ATTRIBUTION.md``。

akshare 1.18+ 弃用了 ``stock_lhb_stock_detail_em`` 的 ``date="近一月"`` 简写，
故先用 ``stock_lhb_stock_detail_date_em`` 枚举个股实际上榜日，再按 ``YYYYMMDD``
逐日取席位明细。``交易营业部名称`` 列统一重命名为 ``营业部名称`` 供下游消费。
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def _ak():
    """惰性导入 akshare(未安装时返回 None，调用方降级为空结果)。"""
    try:
        import akshare as ak  # type: ignore

        return ak
    except Exception:  # pragma: no cover - 仅在缺依赖环境触发
        return None


def fetch_lhb_recent(code: str, days: int = 30) -> list[dict]:
    """取个股近 ``days`` 日的席位级龙虎榜记录。

    Args:
        code: 6 位 A 股代码 (如 ``"600519"``)。
        days: 回看天数。

    Returns:
        记录列表;每条含 ``营业部名称`` / 买卖额 / ``上榜日`` 等列。无数据返回 ``[]``。
    """
    ak = _ak()
    if ak is None or not code:
        return []
    try:
        dates_df = ak.stock_lhb_stock_detail_date_em(symbol=code)
    except Exception as exc:
        logger.debug("[dragon_tiger] 取上榜日失败 %s: %s", code, exc)
        return []
    if dates_df is None or dates_df.empty or "交易日" not in dates_df.columns:
        return []

    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    dates: list[str] = []
    for d in dates_df["交易日"].astype(str):
        d10 = d[:10]  # "2026-04-17" 或带时间，取前 10 位
        if d10 >= cutoff:
            dates.append(d10.replace("-", ""))

    records: list[dict] = []
    for dt in dates:
        try:
            df = ak.stock_lhb_stock_detail_em(symbol=code, date=dt)
        except Exception:
            continue
        if df is None or df.empty:
            continue
        for legacy in ("交易营业部名称", "交易营业部"):
            if legacy in df.columns and "营业部名称" not in df.columns:
                df = df.rename(columns={legacy: "营业部名称"})
                break
        df = df.copy()
        df["上榜日"] = dt
        records.extend(df.to_dict("records"))
    return records


def fetch_sector_lhb(top: int = 30) -> list[dict]:
    """近一月活跃龙虎榜个股榜(用于同板块/板块辨识度参考)。"""
    ak = _ak()
    if ak is None:
        return []
    try:
        df = ak.stock_lhb_stock_statistic_em(symbol="近一月")
    except Exception:
        return []
    if df is None or df.empty:
        return []
    return df.head(top).to_dict("records")
