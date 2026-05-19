"""SEC Provider 单元测试"""

from unittest.mock import patch, MagicMock


class TestSECProvider:
    def test_form_to_category(self):
        from backend.providers.sec_provider import SECProvider

        assert SECProvider._form_to_category("10-K") == "earnings"
        assert SECProvider._form_to_category("10-Q") == "earnings"
        assert SECProvider._form_to_category("8-K") == "other"
        assert SECProvider._form_to_category("S-1") == "financing"
        assert SECProvider._form_to_category("SC 13D") == "mna"
        assert SECProvider._form_to_category("UNKNOWN") == "other"

    def test_init(self):
        from backend.providers.sec_provider import SECProvider

        p = SECProvider()
        assert p.name == "sec"
        assert "US" in p.markets
        assert "announcements" in p.data_types
        assert p.priority == 95

    @patch("backend.providers.sec_provider.requests.get")
    def test_symbol_to_cik_cached(self, mock_get):
        from backend.providers.sec_provider import SECProvider

        p = SECProvider()
        # 手动设置缓存
        p._ticker_cik_map = {"AAPL": "0000320193", "MSFT": "0000789019"}
        p._cik_loaded = True
        assert p._symbol_to_cik("AAPL") == "0000320193"
        assert p._symbol_to_cik("MSFT") == "0000789019"
        assert p._symbol_to_cik("UNKNOWN") == ""
        # 不应该发起 HTTP 请求
        mock_get.assert_not_called()

    @patch("backend.providers.sec_provider.requests.get")
    def test_get_announcements_success(self, mock_get):
        from backend.providers.sec_provider import SECProvider

        p = SECProvider()
        p._ticker_cik_map = {"AAPL": "0000320193"}
        p._cik_loaded = True

        # Mock SEC submissions response
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "name": "Apple Inc.",
            "filings": {
                "recent": {
                    "form": ["10-K", "8-K"],
                    "filingDate": ["2026-02-01", "2026-03-15"],
                    "accessionNumber": ["0000320193-26-000001", "0000320193-26-000002"],
                    "primaryDocument": ["10-k.htm", "8-k.htm"],
                    "primaryDocDescription": ["Annual Report", "Current Report"],
                }
            },
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        results = p.get_announcements({"symbol": "AAPL", "limit": 10})
        assert len(results) == 2
        assert results[0]["form_type"] == "10-K"
        assert results[0]["company_name"] == "Apple Inc."
        assert "sec.gov" in results[0]["url"]

    @patch("backend.providers.sec_provider.requests.get")
    def test_get_announcements_no_cik(self, mock_get):
        from backend.providers.sec_provider import SECProvider

        p = SECProvider()
        p._ticker_cik_map = {}
        p._cik_loaded = True
        results = p.get_announcements({"symbol": "UNKNOWN_TICKER"})
        assert results == []
