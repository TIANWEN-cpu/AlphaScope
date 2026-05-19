"""Pydantic 数据模型单元测试"""


class TestNewsItem:
    def test_create_minimal(self):
        from backend.schemas.news import NewsItem

        item = NewsItem(title="测试新闻", source="cls")
        assert item.title == "测试新闻"
        assert item.source == "cls"
        assert item.id.startswith("news_cls_")
        assert item.confidence == 0.6

    def test_create_full(self):
        from backend.schemas.news import NewsItem

        item = NewsItem(
            title="茅台公告",
            source="cninfo",
            summary="分红公告",
            symbols=["600519.SH"],
            industries=["白酒"],
            sentiment=0.3,
            importance=0.8,
        )
        assert item.symbols == ["600519.SH"]
        assert item.sentiment == 0.3

    def test_auto_id_generation(self):
        from backend.schemas.news import NewsItem

        a = NewsItem(title="新闻A", source="cls")
        b = NewsItem(title="新闻B", source="cls")
        assert a.id != b.id

    def test_query_defaults(self):
        from backend.schemas.news import NewsQuery

        q = NewsQuery()
        assert q.limit == 50
        assert q.keywords == ""


class TestResearchReport:
    def test_create(self):
        from backend.schemas.report import ResearchReport

        r = ResearchReport(title="茅台深度", source="tushare", institution="中信")
        assert r.id.startswith("report_tushare_")
        assert r.confidence == 0.8
        assert r.license_level == "restricted"

    def test_with_symbols(self):
        from backend.schemas.report import ResearchReport

        r = ResearchReport(
            title="行业报告",
            source="eastmoney",
            symbols=["600519.SH", "000858.SZ"],
            rating="买入",
        )
        assert len(r.symbols) == 2


class TestAnnouncement:
    def test_create(self):
        from backend.schemas.announcement import Announcement

        a = Announcement(title="分红公告", source="cninfo", symbol="600519.SH")
        assert a.id.startswith("ann_cninfo_")
        assert a.confidence == 0.9

    def test_category(self):
        from backend.schemas.announcement import Announcement

        a = Announcement(
            title="年度报告",
            source="sec",
            symbol="AAPL",
            category="earnings",
        )
        assert a.category == "earnings"


class TestPriceBar:
    def test_create(self):
        from backend.schemas.market import PriceBar

        bar = PriceBar(
            symbol="600519.SH",
            date="2026-05-18",
            open=1800.0,
            high=1820.0,
            low=1790.0,
            close=1810.0,
            volume=50000,
        )
        assert bar.market == "CN"
        assert bar.frequency == "1d"
        assert bar.close == 1810.0


class TestFundFlow:
    def test_create(self):
        from backend.schemas.market import FundFlow

        f = FundFlow(symbol="600519.SH", date="2026-05-18", main_net_inflow=1.5e8)
        assert f.source == "eastmoney"
        assert f.main_net_inflow == 1.5e8


class TestEvidence:
    def test_evidence_item(self):
        from backend.schemas.evidence import EvidenceItem

        e = EvidenceItem(
            id="ev_001",
            evidence_type="news",
            title="茅台提价",
            source="cls",
        )
        assert e.confidence == 0.7
        assert e.relevance == 0.5

    def test_evidence_bundle(self):
        from backend.schemas.evidence import EvidenceBundle

        b = EvidenceBundle(
            claim="短期盈利上修",
            evidence_ids=["ev_001", "ev_002"],
            confidence=0.72,
        )
        assert len(b.evidence_ids) == 2

    def test_agent_report(self):
        from backend.schemas.evidence import AgentReport

        r = AgentReport(
            symbol="600519.SH",
            agent_role="fundamental",
            decision="buy",
            confidence=0.75,
        )
        assert r.agent_role == "fundamental"
