"""HKEXnews Provider - 港股公告核心源

注意: HKEXnews 有版权和免责声明, 仅保存元数据和URL, 不建议全文搬运
"""

from __future__ import annotations

import logging
import re

import requests

from .base import BaseProvider

logger = logging.getLogger(__name__)

HKEX_SEARCH_URL = "https://www1.hkexnews.hk/search/titlesearch.xhtml"


class HKEXProvider(BaseProvider):
    name = "hkex"
    markets = ["HK"]
    data_types = ["announcements"]
    priority = 95
    license_level = "restricted"

    def get_announcements(self, query: dict, **kwargs) -> list[dict]:
        symbol = query.get("symbol", "")
        if not symbol:
            return []

        try:
            params = {
                "lang": "ZH",
                "stock": symbol,
                "category": query.get("category", "0"),
                "from": query.get("start_date", ""),
                "to": query.get("end_date", ""),
            }
            resp = requests.get(HKEX_SEARCH_URL, params=params, timeout=15)
            resp.raise_for_status()

            results = self._parse_hkex_html(resp.text, symbol)
            logger.info("HKEX 返回 %d 条公告 (%s)", len(results), symbol)
            return results

        except Exception as e:
            self._record_failure(str(e))
            logger.debug("HKEX announcements failed: %s", e)
            return []

    def _parse_hkex_html(self, html: str, symbol: str) -> list[dict]:
        """解析 HKEXnews 搜索结果 HTML

        HKEX 返回的 HTML 片段结构:
        <div class="result_row">
            <div class="date">2026-05-18</div>
            <div class="title">
                <a href="/path/to/file.pdf">公告标题</a>
            </div>
            <div class="category">类别</div>
        </div>
        """
        results = []

        # 匹配每一行结果
        # HKEX 使用 table 或 div 结构, 用多种 pattern 兜底
        row_patterns = [
            # pattern 1: table row with date and link
            re.compile(
                r"<tr[^>]*>.*?<td[^>]*>(\d{4}-\d{2}-\d{2})</td>.*?"
                r'<a[^>]*href="([^"]*)"[^>]*>([^<]*)</a>.*?</tr>',
                re.DOTALL,
            ),
            # pattern 2: div-based layout
            re.compile(
                r'<div[^>]*class="[^"]*result[^"]*"[^>]*>.*?'
                r"(\d{4}-\d{2}-\d{2}).*?"
                r'<a[^>]*href="([^"]*)"[^>]*>([^<]*)</a>',
                re.DOTALL,
            ),
        ]

        for pattern in row_patterns:
            matches = pattern.findall(html)
            if matches:
                for match in matches:
                    date_str, url, title = match[0], match[1], match[2].strip()
                    if not title:
                        continue

                    # 补全 URL
                    if url and not url.startswith("http"):
                        url = "https://www1.hkexnews.hk" + url

                    results.append(
                        {
                            "source": "hkex",
                            "upstream": "hkex",
                            "symbol": symbol,
                            "company_name": "",
                            "title": title,
                            "category": self._guess_category(title),
                            "datetime": date_str,
                            "url": url,
                            "source_url": url,
                            "confidence": 0.95,
                        }
                    )
                break  # 用第一个匹配成功的 pattern

        # 兜底: 如果结构化解析失败, 尝试提取所有链接
        if not results:
            link_pattern = re.compile(
                r'<a[^>]*href="([^"]*(?:news|c|documents)[^"]*)"[^>]*>([^<]+)</a>',
                re.IGNORECASE,
            )
            for url, title in link_pattern.findall(html):
                title = title.strip()
                if len(title) < 5:
                    continue
                if not url.startswith("http"):
                    url = "https://www1.hkexnews.hk" + url
                results.append(
                    {
                        "source": "hkex",
                        "upstream": "hkex",
                        "symbol": symbol,
                        "company_name": "",
                        "title": title,
                        "category": self._guess_category(title),
                        "datetime": "",
                        "url": url,
                        "source_url": url,
                        "confidence": 0.95,
                    }
                )

        return results

    @staticmethod
    def _guess_category(title: str) -> str:
        """根据标题关键词猜测公告类别"""
        category_map = {
            "dividend": ["股息", "分红", "派息", "分配"],
            "earnings": ["业绩", "盈利", "中期报告", "年度报告", "季度"],
            "mna": ["收购", "合并", "要约", "私有化"],
            "litigation": ["诉讼", "仲裁", "法律"],
            "financing": ["配售", "供股", "增发", "发债", "融资"],
        }
        for cat, keywords in category_map.items():
            for kw in keywords:
                if kw in title:
                    return cat
        return "other"
