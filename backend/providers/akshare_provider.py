"""AkShare Provider - 主力免费数据源

覆盖: A股/港股/美股行情, 新闻, 研报, 公告, 资金流, 基本面, 宏观数据
"""

from __future__ import annotations

import warnings

warnings.filterwarnings("ignore")

import logging
from typing import Any

import akshare as ak
import pandas as pd

from .base import BaseProvider

logger = logging.getLogger(__name__)


def _safe(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception:
        return None


class AkShareProvider(BaseProvider):
    name = "akshare"
    markets = ["CN", "ALL"]
    data_types = ["news", "reports", "announcements", "prices", "fundamentals", "fund_flow"]
    priority = 60
    license_level = "research_only"

    # ---- 新闻 ----
    def get_news(self, query: dict, **kwargs) -> list[dict]:
        results = []
        limit = query.get("limit", 30)

        # 财联社快讯
        try:
            df = _safe(ak.stock_info_global_cls, symbol="全部")
            if df is not None and len(df) > 0:
                for _, row in df.head(limit).iterrows():
                    results.append({
                        "source": "cls",
                        "upstream": "cls",
                        "title": str(row.get("标题", "")).strip(),
                        "summary": str(row.get("内容", "")).strip()[:200],
                        "datetime": f"{row.get('发布日期', '')} {row.get('发布时间', '')}".strip(),
                        "url": "",
                    })
        except Exception as e:
            logger.debug("AkShare CLS news failed: %s", e)

        # 东财快讯
        try:
            df = _safe(ak.stock_info_global_em)
            if df is not None and len(df) > 0:
                for _, row in df.head(limit).iterrows():
                    results.append({
                        "source": "eastmoney",
                        "upstream": "eastmoney",
                        "title": str(row.get("标题", "")).strip(),
                        "summary": str(row.get("摘要", "")).strip()[:200],
                        "datetime": str(row.get("发布时间", "")).strip(),
                        "url": str(row.get("链接", "")).strip(),
                    })
        except Exception as e:
            logger.debug("AkShare EM news failed: %s", e)

        # 新浪快讯
        try:
            df = _safe(ak.stock_info_global_sina)
            if df is not None and len(df) > 0:
                for _, row in df.head(min(limit, 20)).iterrows():
                    content = str(row.get("内容", "")).strip()
                    title = content
                    if content.startswith("【"):
                        end = content.find("】")
                        if end > 0:
                            title = content[1:end]
                    results.append({
                        "source": "sina",
                        "upstream": "sina",
                        "title": title[:80],
                        "summary": content[:200],
                        "datetime": str(row.get("时间", "")).strip(),
                        "url": "",
                    })
        except Exception as e:
            logger.debug("AkShare Sina news failed: %s", e)

        return results

    # ---- 研报 ----
    def get_reports(self, query: dict, **kwargs) -> list[dict]:
        symbol = query.get("symbol", "")
        if not symbol:
            return []
        try:
            df = _safe(ak.stock_research_report_em, symbol=symbol)
            if df is None or len(df) == 0:
                return []
            results = []
            for _, row in df.head(query.get("limit", 30)).iterrows():
                results.append({
                    "source": "eastmoney",
                    "upstream": "eastmoney",
                    "title": str(row.get("报告名称", "")).strip(),
                    "institution": str(row.get("机构", "")).strip(),
                    "rating": str(row.get("最新评级", "")).strip(),
                    "industry": str(row.get("行业", "")).strip(),
                    "datetime": str(row.get("日期", "")).strip(),
                    "pdf_url": str(row.get("报告链接", "")).strip(),
                    "symbols": [symbol],
                })
            return results
        except Exception as e:
            logger.debug("AkShare reports failed: %s", e)
            return []

    # ---- 公告 ----
    def get_announcements(self, query: dict, **kwargs) -> list[dict]:
        symbol = query.get("symbol", "")
        results = []

        # 巨潮公告
        try:
            df = _safe(
                ak.stock_zh_a_disclosure_report_cninfo,
                symbol=symbol,
                market="",
                keyword="",
                category="",
                start_date=query.get("start_date", ""),
                end_date=query.get("end_date", ""),
            )
            if df is not None and len(df) > 0:
                for _, row in df.head(query.get("limit", 30)).iterrows():
                    results.append({
                        "source": "cninfo",
                        "upstream": "cninfo",
                        "symbol": symbol,
                        "title": str(row.get("公告标题", "")).strip(),
                        "datetime": str(row.get("公告时间", "")).strip(),
                        "url": str(row.get("公告链接", "")).strip(),
                    })
        except Exception as e:
            logger.debug("AkShare CNInfo announcements failed: %s", e)

        # 东财公告
        try:
            df = _safe(
                ak.stock_individual_notice_report,
                symbol=symbol,
            )
            if df is not None and len(df) > 0:
                for _, row in df.head(query.get("limit", 20)).iterrows():
                    results.append({
                        "source": "eastmoney",
                        "upstream": "eastmoney",
                        "symbol": symbol,
                        "title": str(row.get("公告标题", "")).strip(),
                        "datetime": str(row.get("公告日期", "")).strip(),
                        "url": "",
                    })
        except Exception as e:
            logger.debug("AkShare EM announcements failed: %s", e)

        return results

    # ---- 行情 ----
    def get_prices(self, query: dict, **kwargs) -> list[dict]:
        symbol = query.get("symbol", "")
        if not symbol:
            return []
        period = query.get("period", "daily")
        start_date = query.get("start_date", "")
        end_date = query.get("end_date", "")
        adjust = query.get("adjust", "hfq")

        try:
            df = _safe(
                ak.stock_zh_a_hist,
                symbol=symbol,
                period=period,
                start_date=start_date.replace("-", ""),
                end_date=end_date.replace("-", "") if end_date else "",
                adjust=adjust,
            )
            if df is None or len(df) == 0:
                return []
            results = []
            for _, row in df.iterrows():
                results.append({
                    "symbol": symbol,
                    "market": "CN",
                    "date": str(row.get("日期", "")),
                    "open": float(row.get("开盘", 0)),
                    "high": float(row.get("最高", 0)),
                    "low": float(row.get("最低", 0)),
                    "close": float(row.get("收盘", 0)),
                    "volume": float(row.get("成交量", 0)),
                    "amount": float(row.get("成交额", 0)),
                    "turnover": float(row.get("换手率", 0)),
                    "amplitude": float(row.get("振幅", 0)),
                    "change_pct": float(row.get("涨跌幅", 0)),
                    "source": "akshare",
                })
            return results
        except Exception as e:
            logger.debug("AkShare prices failed: %s", e)
            return []

    # ---- 资金流 ----
    def get_fund_flow(self, query: dict, **kwargs) -> list[dict]:
        symbol = query.get("symbol", "")
        if not symbol:
            return []
        try:
            market = "sh" if symbol.startswith(("60", "68", "9")) else "sz"
            if symbol.startswith(("8", "4")):
                market = "bj"
            df = _safe(ak.stock_individual_fund_flow, stock=symbol, market=market)
            if df is None or len(df) == 0:
                return []
            df = df.tail(query.get("days", 30))
            results = []
            for _, row in df.iterrows():
                results.append({
                    "symbol": symbol,
                    "date": str(row.get("日期", "")),
                    "main_net_inflow": float(row.get("主力净流入-净额", 0)),
                    "super_large_net_inflow": float(row.get("超大单净流入-净额", 0)),
                    "large_net_inflow": float(row.get("大单净流入-净额", 0)),
                    "medium_net_inflow": float(row.get("中单净流入-净额", 0)),
                    "small_net_inflow": float(row.get("小单净流入-净额", 0)),
                    "close": float(row.get("收盘价", 0)),
                    "change_pct": float(row.get("涨跌幅", 0)),
                    "source": "eastmoney",
                })
            return results
        except Exception as e:
            logger.debug("AkShare fund flow failed: %s", e)
            return []

    # ---- 基本面 ----
    def get_fundamentals(self, query: dict, **kwargs) -> dict:
        symbol = query.get("symbol", "")
        if not symbol:
            return {}
        result = {}
        try:
            df = _safe(ak.stock_financial_analysis_indicator, symbol=symbol)
            if df is not None and len(df) > 0:
                result["financial_indicators"] = df.head(4).to_dict("records")
        except Exception as e:
            logger.debug("AkShare fundamentals failed: %s", e)
        return result
