"""SEC EDGAR Provider - 美股公告和财报官方核心源

免费, 无需API Key, 需设置 User-Agent
"""

from __future__ import annotations

import logging
import os

import requests

from .base import BaseProvider

logger = logging.getLogger(__name__)

SEC_BASE = "https://data.sec.gov"
_SUBMISSIONS_URL = f"{SEC_BASE}/submissions"
_COMPANY_FACTS_URL = f"{SEC_BASE}/api/xbrl/companyfacts"


class SECProvider(BaseProvider):
    name = "sec"
    markets = ["US"]
    data_types = ["announcements", "fundamentals"]
    priority = 95
    license_level = "public"

    def __init__(self) -> None:
        super().__init__()
        self._user_agent = os.environ.get(
            "SEC_USER_AGENT",
            "AI-Finance research@example.com",
        )
        self._headers = {"User-Agent": self._user_agent}

    def _get(self, url: str) -> dict:
        resp = requests.get(url, headers=self._headers, timeout=15)
        resp.raise_for_status()
        return resp.json()

    def get_announcements(self, query: dict, **kwargs) -> list[dict]:
        """获取公司最近提交文件 (10-K, 10-Q, 8-K 等)"""
        cik = query.get("cik", "")
        symbol = query.get("symbol", "")

        # 如果只有 symbol, 尝试通过 CIK 查找
        if not cik and symbol:
            cik = self._symbol_to_cik(symbol)
        if not cik:
            return []

        # 补齐 CIK 到 10 位
        cik_padded = cik.zfill(10)
        form_filter = query.get("form_type", "")

        try:
            data = self._get(f"{_SUBMISSIONS_URL}/CIK{cik_padded}.json")
            company = data.get("name", "")
            recent = data.get("filings", {}).get("recent", {})

            forms = recent.get("form", [])
            dates = recent.get("filingDate", [])
            accessions = recent.get("accessionNumber", [])
            primary_docs = recent.get("primaryDocument", [])

            results = []
            for i in range(min(len(forms), query.get("limit", 30))):
                if form_filter and forms[i] != form_filter:
                    continue
                acc_no = accessions[i].replace("-", "")
                results.append({
                    "source": "sec",
                    "upstream": "sec",
                    "symbol": symbol,
                    "company_name": company,
                    "title": f"{forms[i]} - {company}",
                    "category": forms[i],
                    "datetime": dates[i],
                    "url": f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc_no}/{primary_docs[i]}",
                    "form_type": forms[i],
                    "accession_number": accessions[i],
                })
            return results
        except Exception as e:
            logger.debug("SEC announcements failed: %s", e)
            return []

    def get_fundamentals(self, query: dict, **kwargs) -> dict:
        """获取公司 XBRL 财务数据"""
        cik = query.get("cik", "")
        if not cik:
            symbol = query.get("symbol", "")
            if symbol:
                cik = self._symbol_to_cik(symbol)
        if not cik:
            return {}

        cik_padded = cik.zfill(10)
        try:
            data = self._get(f"{_COMPANY_FACTS_URL}/CIK{cik_padded}.json")
            return {
                "company_name": data.get("entityName", ""),
                "cik": cik,
                "source": "sec",
                "facts": data.get("facts", {}),
            }
        except Exception as e:
            logger.debug("SEC fundamentals failed: %s", e)
            return {}

    def _symbol_to_cik(self, symbol: str) -> str:
        """通过 SEC 公司搜索 API 将 ticker 转为 CIK"""
        try:
            data = self._get("https://efts.sec.gov/LATEST/search-index?q=%22" + symbol + "%22&dateRange=custom&startdt=2024-01-01&enddt=2024-01-01")
            # 简单返回空, 实际使用建议维护 ticker->cik 映射表
            return ""
        except Exception:
            return ""
