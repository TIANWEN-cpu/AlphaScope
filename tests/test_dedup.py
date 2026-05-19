"""Deduplicator 去重模块单元测试"""


class TestDeduplicator:
    def test_news_dedup(self):
        from backend.quality.dedup import Deduplicator

        d = Deduplicator()
        items = [
            {"title": "茅台提价", "datetime": "2026-05-18", "source": "cls"},
            {"title": "茅台提价", "datetime": "2026-05-18", "source": "cls"},  # dup
            {"title": "五粮液业绩", "datetime": "2026-05-18", "source": "em"},
        ]
        result = d.dedup_news(items)
        assert len(result) == 2
        assert d.stats["news_dup"] == 1

    def test_report_dedup_by_pdf_hash(self):
        from backend.quality.dedup import Deduplicator

        d = Deduplicator()
        items = [
            {
                "title": "深度报告",
                "institution": "中信",
                "datetime": "2026-05-18",
                "pdf_hash": "abc123",
            },
            {
                "title": "深度报告",
                "institution": "中信",
                "datetime": "2026-05-18",
                "pdf_hash": "abc123",
            },  # dup
        ]
        result = d.dedup_reports(items)
        assert len(result) == 1

    def test_announcement_dedup(self):
        from backend.quality.dedup import Deduplicator

        d = Deduplicator()
        items = [
            {"title": "分红公告", "symbol": "600519", "datetime": "2026-05-18"},
            {"title": "分红公告", "symbol": "600519", "datetime": "2026-05-18"},  # dup
            {
                "title": "分红公告",
                "symbol": "000858",
                "datetime": "2026-05-18",
            },  # different symbol
        ]
        result = d.dedup_announcements(items)
        assert len(result) == 2

    def test_fingerprint_normalization(self):
        from backend.quality.dedup import Deduplicator

        d = Deduplicator()
        # 不同标点但相同内容应去重
        item1 = {"title": "茅台：提价公告", "datetime": "2026-05-18", "source": "cls"}
        item2 = {"title": "茅台提价公告", "datetime": "2026-05-18", "source": "cls"}
        fp1 = d.news_fingerprint(item1)
        fp2 = d.news_fingerprint(item2)
        # normalize 去掉标点后应该相同
        assert fp1 == fp2

    def test_reset(self):
        from backend.quality.dedup import Deduplicator

        d = Deduplicator()
        d.dedup_news([{"title": "test", "datetime": "2026-05-18", "source": "cls"}])
        assert d.stats["news_dup"] == 0  # 第一次不算 dup
        d.dedup_news([{"title": "test", "datetime": "2026-05-18", "source": "cls"}])
        assert d.stats["news_dup"] == 1
        d.reset()
        assert d.stats["news_dup"] == 0
