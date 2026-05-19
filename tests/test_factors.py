"""因子生成器测试"""

from unittest.mock import patch, MagicMock


class TestFactorReport:
    """FactorReport 数据类测试"""

    def test_default_values(self):
        from backend.factors.generator import FactorReport

        r = FactorReport(symbol="600519")
        assert r.symbol == "600519"
        assert r.news_sentiment == 0.0
        assert r.event_signal == 0.0
        assert r.analyst_rating == 0.0
        assert r.fund_flow == 0.0
        assert r.momentum == 0.0
        assert r.composite == 0.0
        assert r.news_count == 0

    def test_to_dict(self):
        from backend.factors.generator import FactorReport

        r = FactorReport(symbol="000001", stock_name="平安银行", composite=0.5)
        d = r.to_dict()
        assert d["symbol"] == "000001"
        assert d["stock_name"] == "平安银行"
        assert "factors" in d
        assert d["factors"]["composite"] == 0.5

    def test_computed_at_auto_set(self):
        from backend.factors.generator import FactorReport

        r = FactorReport(symbol="TEST")
        assert r.computed_at  # should be auto-populated


class TestRatingScores:
    """评级映射测试"""

    def test_chinese_ratings(self):
        from backend.factors.generator import _RATING_SCORES

        assert _RATING_SCORES["买入"] == 1.0
        assert _RATING_SCORES["持有"] == 0.0
        assert _RATING_SCORES["卖出"] == -1.0

    def test_english_ratings(self):
        from backend.factors.generator import _RATING_SCORES

        assert _RATING_SCORES["buy"] == 1.0
        assert _RATING_SCORES["hold"] == 0.0
        assert _RATING_SCORES["sell"] == -1.0


class TestEventCategoryScores:
    """事件类型评分测试"""

    def test_all_categories_covered(self):
        from backend.factors.generator import _EVENT_CATEGORY_SCORES

        expected = {
            "earnings",
            "dividend",
            "mna",
            "financing",
            "litigation",
            "policy",
            "supply_chain",
            "insider",
        }
        assert set(_EVENT_CATEGORY_SCORES.keys()) == expected

    def test_litigation_negative(self):
        from backend.factors.generator import _EVENT_CATEGORY_SCORES

        assert _EVENT_CATEGORY_SCORES["litigation"] < 0

    def test_dividend_positive(self):
        from backend.factors.generator import _EVENT_CATEGORY_SCORES

        assert _EVENT_CATEGORY_SCORES["dividend"] > 0


class TestFactorGenerator:
    """FactorGenerator 计算逻辑测试"""

    def _make_db_mock(
        self, news_rows=None, report_rows=None, announcement_rows=None, price_rows=None
    ):
        """创建 Database mock"""
        mock_conn = MagicMock()

        def mock_execute(sql, params=()):
            result = MagicMock()
            if "news_items" in sql and "SELECT" in sql:
                result.fetchall.return_value = news_rows or []
            elif "research_reports" in sql and "SELECT" in sql:
                result.fetchall.return_value = report_rows or []
            elif "announcements" in sql and "SELECT" in sql:
                result.fetchall.return_value = announcement_rows or []
            elif "price_bars" in sql and "SELECT" in sql:
                result.fetchall.return_value = price_rows or []
            else:
                result.fetchall.return_value = []
            return result

        mock_conn.execute = mock_execute

        mock_db = MagicMock()
        mock_db.conn = mock_conn
        return mock_db

    def test_empty_data_returns_zero_factors(self):
        from backend.factors.generator import FactorGenerator

        gen = FactorGenerator()

        mock_db = self._make_db_mock()
        with patch("backend.storage.db.Database", return_value=mock_db):
            report = gen.generate("600519", "贵州茅台", days=30)

        assert report.symbol == "600519"
        assert report.news_sentiment == 0.0
        assert report.event_signal == 0.0
        assert report.analyst_rating == 0.0
        assert report.composite == 0.0

    def test_news_sentiment_positive(self):
        from backend.factors.generator import FactorGenerator

        gen = FactorGenerator()

        news_rows = [
            {
                "title": "贵州茅台业绩大增",
                "sentiment": 0.8,
                "importance": 0.9,
                "confidence": 0.8,
                "published_at": "2026-05-10",
            },
            {
                "title": "茅台超预期",
                "sentiment": 0.6,
                "importance": 0.7,
                "confidence": 0.7,
                "published_at": "2026-05-09",
            },
        ]

        mock_db = self._make_db_mock(news_rows=news_rows)
        with patch("backend.storage.db.Database", return_value=mock_db):
            report = gen.generate("600519", "贵州茅台")

        assert report.news_count == 2
        assert report.news_sentiment > 0

    def test_event_signal_litigation_negative(self):
        from backend.factors.generator import FactorGenerator

        gen = FactorGenerator()

        ann_rows = [
            {
                "title": "收到行政处罚",
                "category": "litigation",
                "importance": 0.9,
                "published_at": "2026-05-10",
            },
        ]

        mock_db = self._make_db_mock(announcement_rows=ann_rows)
        with patch("backend.storage.db.Database", return_value=mock_db):
            report = gen.generate("000001", "平安银行")

        assert report.event_count == 1
        assert report.event_signal < 0

    def test_analyst_rating_buy(self):
        from backend.factors.generator import FactorGenerator

        gen = FactorGenerator()

        report_rows = [
            {
                "title": "茅台深度报告",
                "rating": "买入",
                "target_price": 2000,
                "institution": "中信证券",
                "published_at": "2026-05-10",
            },
            {
                "title": "茅台点评",
                "rating": "推荐",
                "target_price": 1900,
                "institution": "国泰君安",
                "published_at": "2026-05-09",
            },
        ]

        mock_db = self._make_db_mock(report_rows=report_rows)
        with patch("backend.storage.db.Database", return_value=mock_db):
            report = gen.generate("600519", "贵州茅台")

        assert report.report_count == 2
        assert report.analyst_rating > 0

    def test_weighted_composite(self):
        from backend.factors.generator import FactorGenerator, FactorReport

        gen = FactorGenerator()

        report = FactorReport(
            symbol="TEST",
            news_sentiment=0.8,
            event_signal=0.6,
            analyst_rating=0.4,
            fund_flow=0.2,
            momentum=0.0,
        )
        composite = gen._weighted_composite(report)
        assert -1.0 <= composite <= 1.0
        assert composite > 0  # all positive factors → positive composite

    def test_generate_batch(self):
        from backend.factors.generator import FactorGenerator

        gen = FactorGenerator()

        mock_db = self._make_db_mock()
        with patch("backend.storage.db.Database", return_value=mock_db):
            reports = gen.generate_batch(
                ["600519", "000001"], {"600519": "贵州茅台", "000001": "平安银行"}
            )

        assert len(reports) == 2
        assert reports[0].symbol == "600519"
        assert reports[1].symbol == "000001"


class TestFormatFactorSummary:
    """因子摘要格式化测试"""

    def test_basic_format(self):
        from backend.factors.generator import FactorReport, format_factor_summary

        report = FactorReport(
            symbol="600519",
            stock_name="贵州茅台",
            composite=0.35,
            news_sentiment=0.6,
            news_count=5,
        )
        text = format_factor_summary(report)
        assert "600519" in text
        assert "贵州茅台" in text
        assert "+0.35" in text
        assert "新闻情绪" in text

    def test_with_signals(self):
        from backend.factors.generator import FactorReport, format_factor_summary

        report = FactorReport(
            symbol="600519",
            signals=[
                {"type": "news", "title": "茅台业绩大增", "sentiment": 0.8},
                {
                    "type": "event",
                    "category": "earnings",
                    "title": "年报发布",
                    "score": 0.5,
                },
            ],
        )
        text = format_factor_summary(report)
        assert "茅台业绩大增" in text
        assert "年报发布" in text


class TestConvenienceFunctions:
    """便捷函数测试"""

    def test_get_factor_generator_singleton(self):
        from backend.factors.generator import get_factor_generator
        import backend.factors.generator as mod

        mod._generator = None  # reset
        gen1 = get_factor_generator()
        gen2 = get_factor_generator()
        assert gen1 is gen2

    def test_generate_factor_report(self):
        from backend.factors.generator import generate_factor_report, FactorReport

        mock_db = MagicMock()
        mock_conn = MagicMock()
        mock_conn.execute.return_value.fetchall.return_value = []
        mock_db.conn = mock_conn

        import backend.factors.generator as mod

        mod._generator = None  # reset singleton

        with patch("backend.storage.db.Database", return_value=mock_db):
            report = generate_factor_report("600519")
        assert isinstance(report, FactorReport)
        assert report.symbol == "600519"
