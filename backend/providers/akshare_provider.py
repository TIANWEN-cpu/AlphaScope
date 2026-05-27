"""AkShare Provider - 主力免费数据源

覆盖: A股/港股/美股行情, 新闻, 研报, 公告, 资金流, 基本面, 宏观数据
"""

from __future__ import annotations

import warnings

warnings.filterwarnings("ignore")

import logging
from datetime import datetime, timedelta

import akshare as ak

from .base import BaseProvider

logger = logging.getLogger(__name__)


def _safe(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception:
        return None


def _to_tx_symbol(symbol: str) -> str:
    code = str(symbol or "").strip()
    if code.startswith(("sh", "sz", "bj")):
        return code
    if code.startswith("6"):
        return f"sh{code}"
    if code.startswith(("0", "3")):
        return f"sz{code}"
    if code.startswith(("4", "8")):
        return f"bj{code}"
    return code


def _float_value(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


class AkShareProvider(BaseProvider):
    name = "akshare"
    markets = ["CN", "ALL"]
    data_types = [
        "news",
        "reports",
        "announcements",
        "prices",
        "fundamentals",
        "fund_flow",
    ]
    priority = 60
    license_level = "research_only"

    # ---- 新闻 ----
    def get_news(self, query: dict, **kwargs) -> list[dict]:
        import time as _time

        _t0 = _time.time()
        results = []
        limit = query.get("limit", 30)

        # 财联社快讯
        try:
            df = _safe(ak.stock_info_global_cls, symbol="全部")
            if df is not None and len(df) > 0:
                for _, row in df.head(limit).iterrows():
                    results.append(
                        {
                            "source": "cls",
                            "upstream": "cls",
                            "title": str(row.get("标题", "")).strip(),
                            "summary": str(row.get("内容", "")).strip()[:200],
                            "datetime": f"{row.get('发布日期', '')} {row.get('发布时间', '')}".strip(),
                            "url": "",
                        }
                    )
        except Exception as e:
            logger.debug("AkShare CLS news failed: %s", e)
            self._record_failure(f"cls news: {e}")

        # 东财快讯
        try:
            df = _safe(ak.stock_info_global_em)
            if df is not None and len(df) > 0:
                for _, row in df.head(limit).iterrows():
                    results.append(
                        {
                            "source": "eastmoney",
                            "upstream": "eastmoney",
                            "title": str(row.get("标题", "")).strip(),
                            "summary": str(row.get("摘要", "")).strip()[:200],
                            "datetime": str(row.get("发布时间", "")).strip(),
                            "url": str(row.get("链接", "")).strip(),
                        }
                    )
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
                    results.append(
                        {
                            "source": "sina",
                            "upstream": "sina",
                            "title": title[:80],
                            "summary": content[:200],
                            "datetime": str(row.get("时间", "")).strip(),
                            "url": "",
                        }
                    )
        except Exception as e:
            logger.debug("AkShare Sina news failed: %s", e)

        if results:
            self._record_success((_time.time() - _t0) * 1000)
        elif not results:
            self._record_failure("all news sub-sources returned empty")
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
                results.append(
                    {
                        "source": "eastmoney",
                        "upstream": "eastmoney",
                        "title": str(row.get("报告名称", "")).strip(),
                        "institution": str(row.get("机构", "")).strip(),
                        "rating": str(row.get("最新评级", "")).strip(),
                        "industry": str(row.get("行业", "")).strip(),
                        "datetime": str(row.get("日期", "")).strip(),
                        "pdf_url": str(row.get("报告链接", "")).strip(),
                        "symbols": [symbol],
                    }
                )
            return results
        except Exception as e:
            logger.debug("AkShare reports failed: %s", e)
            self._record_failure(f"reports: {e}")
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
                    results.append(
                        {
                            "source": "cninfo",
                            "upstream": "cninfo",
                            "symbol": symbol,
                            "title": str(row.get("公告标题", "")).strip(),
                            "datetime": str(row.get("公告时间", "")).strip(),
                            "url": str(row.get("公告链接", "")).strip(),
                        }
                    )
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
                    results.append(
                        {
                            "source": "eastmoney",
                            "upstream": "eastmoney",
                            "symbol": symbol,
                            "title": str(row.get("公告标题", "")).strip(),
                            "datetime": str(row.get("公告日期", "")).strip(),
                            "url": "",
                        }
                    )
        except Exception as e:
            logger.debug("AkShare EM announcements failed: %s", e)

        return results

    # ---- 行情 ----
    def get_prices(self, query: dict, **kwargs) -> list[dict]:
        symbol = query.get("symbol", "")
        if not symbol:
            return []
        frequency = str(query.get("frequency") or "").lower()
        period = query.get("period") or {"1w": "weekly", "1mo": "monthly"}.get(
            frequency, "daily"
        )
        start_date = query.get("start_date", "")
        end_date = query.get("end_date", "")
        if not end_date:
            end_date = datetime.now().strftime("%Y%m%d")
        if not start_date:
            limit = int(query.get("limit", 120) or 120)
            start_date = (datetime.now() - timedelta(days=max(limit * 2, 30))).strftime(
                "%Y%m%d"
            )
        adjust = query.get("adjust", "")

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
                return self._get_prices_from_tencent(symbol, start_date, end_date)
            results = []
            for _, row in df.iterrows():
                results.append(
                    {
                        "symbol": symbol,
                        "market": "CN",
                        "date": str(row.get("日期", "")),
                        "open": _float_value(row.get("开盘", 0)),
                        "high": _float_value(row.get("最高", 0)),
                        "low": _float_value(row.get("最低", 0)),
                        "close": _float_value(row.get("收盘", 0)),
                        "volume": _float_value(row.get("成交量", 0)),
                        "amount": _float_value(row.get("成交额", 0)),
                        "turnover": _float_value(row.get("换手率", 0)),
                        "amplitude": _float_value(row.get("振幅", 0)),
                        "change_pct": _float_value(row.get("涨跌幅", 0)),
                        "adjust": adjust,
                        "frequency": {"weekly": "1w", "monthly": "1mo"}.get(
                            str(period), "1d"
                        ),
                        "source": "akshare",
                    }
                )
            return results
        except Exception as e:
            logger.debug("AkShare prices failed: %s", e)
        return self._get_prices_from_tencent(symbol, start_date, end_date)

    def _get_prices_from_tencent(
        self,
        symbol: str,
        start_date: str,
        end_date: str,
    ) -> list[dict]:
        try:
            df = _safe(
                ak.stock_zh_a_hist_tx,
                symbol=_to_tx_symbol(symbol),
                start_date=start_date.replace("-", ""),
                end_date=end_date.replace("-", ""),
                adjust="",
            )
            if df is None or len(df) == 0:
                return []
            df = df.copy().sort_values("date")
            results = []
            prev_close = None
            for _, row in df.iterrows():
                open_price = _float_value(row.get("open", 0))
                high = _float_value(row.get("high", 0))
                low = _float_value(row.get("low", 0))
                close = _float_value(row.get("close", 0))
                amount = _float_value(row.get("amount", 0))
                base = prev_close or open_price or close
                change_pct = ((close - base) / base * 100) if base else 0.0
                amplitude = ((high - low) / base * 100) if base else 0.0
                volume = round(amount / max(close, 0.01), 0) if amount else 0.0
                results.append(
                    {
                        "symbol": symbol,
                        "market": "CN",
                        "date": str(row.get("date", "")),
                        "open": open_price,
                        "high": high,
                        "low": low,
                        "close": close,
                        "volume": volume,
                        "amount": amount,
                        "turnover": 0.0,
                        "amplitude": round(amplitude, 4),
                        "change_pct": round(change_pct, 4),
                        "adjust": "",
                        "source": "tencent",
                    }
                )
                prev_close = close
            return results
        except Exception as e:
            logger.debug("Tencent prices fallback failed: %s", e)
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
                results.append(
                    {
                        "symbol": symbol,
                        "date": str(row.get("日期", "")),
                        "main_net_inflow": float(row.get("主力净流入-净额", 0)),
                        "super_large_net_inflow": float(
                            row.get("超大单净流入-净额", 0)
                        ),
                        "large_net_inflow": float(row.get("大单净流入-净额", 0)),
                        "medium_net_inflow": float(row.get("中单净流入-净额", 0)),
                        "small_net_inflow": float(row.get("小单净流入-净额", 0)),
                        "close": float(row.get("收盘价", 0)),
                        "change_pct": float(row.get("涨跌幅", 0)),
                        "source": "eastmoney",
                    }
                )
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
