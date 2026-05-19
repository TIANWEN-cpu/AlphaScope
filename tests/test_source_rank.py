"""SourceRanker 可信度排序单元测试"""


class TestSourceRanker:
    def test_trust_levels(self):
        from backend.quality.source_rank import SourceRanker

        r = SourceRanker()
        assert r.get_trust_level("cninfo") == "S"
        assert r.get_trust_level("sec") == "S"
        assert r.get_trust_level("tushare") == "A"
        assert r.get_trust_level("cls") == "B"
        assert r.get_trust_level("xueqiu") == "C"
        assert r.get_trust_level("unknown_source") == "D"

    def test_trust_score_range(self):
        from backend.quality.source_rank import SourceRanker

        r = SourceRanker()
        s_score = r.get_trust_score("cninfo")
        d_score = r.get_trust_score("unknown_source")
        assert s_score > d_score
        assert 0.9 <= s_score <= 0.99
        assert 0.1 <= d_score <= 0.39

    def test_rank_items(self):
        from backend.quality.source_rank import SourceRanker

        r = SourceRanker()
        items = [
            {"source": "unknown", "title": "论坛帖子"},
            {"source": "cninfo", "title": "官方公告"},
            {"source": "cls", "title": "财联社快讯"},
        ]
        ranked = r.rank_items(items)
        assert ranked[0]["source"] == "cninfo"  # S 级排最前
        assert ranked[-1]["source"] == "unknown"  # D 级排最后

    def test_merge_by_trust(self):
        from backend.quality.source_rank import SourceRanker

        r = SourceRanker()
        items = [
            {"source": "xueqiu", "title": "雪球讨论"},
            {"source": "tushare", "title": "Tushare数据"},
        ]
        merged = r.merge_by_trust(items)
        assert merged[0]["source"] == "tushare"  # A > C
