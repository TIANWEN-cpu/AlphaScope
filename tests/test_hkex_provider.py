"""HKEX Provider 单元测试"""


class TestHKEXProvider:
    def test_guess_category(self):
        from backend.providers.hkex_provider import HKEXProvider

        p = HKEXProvider()
        assert p._guess_category("末期股息派付公告") == "dividend"
        assert p._guess_category("截至2025年12月31日止年度业绩") == "earnings"
        assert p._guess_category("有关收购目标公司全部股权") == "mna"
        assert p._guess_category("有关诉讼进展") == "litigation"
        assert p._guess_category("配售新股份") == "financing"
        assert p._guess_category("更改公司名称") == "other"

    def test_init(self):
        from backend.providers.hkex_provider import HKEXProvider

        p = HKEXProvider()
        assert p.name == "hkex"
        assert "HK" in p.markets
        assert p.priority == 95

    def test_parse_hkex_html_table_rows(self):
        from backend.providers.hkex_provider import HKEXProvider

        p = HKEXProvider()
        html = """
        <tr>
            <td>2026-05-18</td>
            <td><a href="/news/20260518001.pdf">末期股息派付公告</a></td>
        </tr>
        <tr>
            <td>2026-05-17</td>
            <td><a href="/news/20260517001.pdf">截至2025年12月31日止年度业绩</a></td>
        </tr>
        """
        results = p._parse_hkex_html(html, "00700")
        assert len(results) == 2
        assert results[0]["title"] == "末期股息派付公告"
        assert results[0]["datetime"] == "2026-05-18"
        assert "hkexnews.hk" in results[0]["url"]
        assert results[0]["symbol"] == "00700"

    def test_parse_hkex_html_fallback_links(self):
        """结构化解析失败时, 应兜底提取链接"""
        from backend.providers.hkex_provider import HKEXProvider

        p = HKEXProvider()
        html = '<a href="/documents/2026/report.pdf">2025年度报告摘要</a>'
        results = p._parse_hkex_html(html, "00700")
        assert len(results) >= 1
        assert "年度报告" in results[0]["title"]

    def test_parse_hkex_html_empty(self):
        from backend.providers.hkex_provider import HKEXProvider

        p = HKEXProvider()
        results = p._parse_hkex_html("<html><body>无结果</body></html>", "00700")
        assert results == []

    def test_parse_hkex_html_url_completion(self):
        """相对 URL 应补全为绝对 URL"""
        from backend.providers.hkex_provider import HKEXProvider

        p = HKEXProvider()
        html = '<tr><td>2026-05-18</td><td><a href="/news/file.pdf">标题</a></td></tr>'
        results = p._parse_hkex_html(html, "00700")
        assert results[0]["url"].startswith("https://")
