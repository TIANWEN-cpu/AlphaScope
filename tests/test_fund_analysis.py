"""Tests for fund analysis and DCA simulation (v1.1.3)."""

from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest


# ================================================================
# Test DCA Simulator (pure logic)
# ================================================================


class TestDCASimulator:
    """Test DCA simulation engine."""

    def test_basic_simulation(self):
        from backend.fund_analysis.dca_simulator import DCASimulator

        prices = [1.0, 1.1, 1.05, 1.2, 1.15, 1.3]
        dates = [f"2024-{i + 1:02d}-01" for i in range(6)]
        sim = DCASimulator()
        result = sim.simulate(prices, dates, 1000, "monthly")

        assert result.total_invested > 0
        assert result.total_shares > 0
        assert result.average_cost > 0
        assert result.final_value > 0
        assert len(result.monthly_records) > 0

    def test_empty_prices(self):
        from backend.fund_analysis.dca_simulator import DCASimulator

        sim = DCASimulator()
        result = sim.simulate([], [], 1000)
        assert result.total_invested == 0

    def test_single_price(self):
        from backend.fund_analysis.dca_simulator import DCASimulator

        sim = DCASimulator()
        result = sim.simulate([1.0], ["2024-01-01"], 1000)
        assert result.total_invested == 0

    def test_weekly_frequency(self):
        from backend.fund_analysis.dca_simulator import DCASimulator

        prices = [1.0 + i * 0.01 for i in range(50)]
        dates = [f"d{i}" for i in range(50)]
        sim = DCASimulator()
        result = sim.simulate(prices, dates, 500, "weekly")

        assert result.total_invested > 0
        assert len(result.monthly_records) > 0

    def test_declining_market(self):
        from backend.fund_analysis.dca_simulator import DCASimulator

        prices = [2.0 - i * 0.05 for i in range(20)]
        prices = [max(p, 0.5) for p in prices]
        dates = [f"d{i}" for i in range(20)]
        sim = DCASimulator()
        result = sim.simulate(prices, dates, 1000, "monthly")

        assert result.total_return_pct < 0

    def test_to_dict(self):
        from backend.fund_analysis.dca_simulator import DCASimulator

        prices = [1.0, 1.1, 1.2]
        dates = ["d0", "d1", "d2"]
        sim = DCASimulator()
        result = sim.simulate(prices, dates, 1000, "monthly")
        d = result.to_dict()

        assert isinstance(d, dict)
        assert "total_invested" in d
        assert "total_return_pct" in d
        assert "sharpe_ratio" in d


# ================================================================
# Test Fund Analysis API
# ================================================================


@pytest.fixture
def client():
    pytest.importorskip("fastapi")
    pytest.importorskip("httpx")
    from fastapi.testclient import TestClient
    from backend.api.main import app

    return TestClient(app)


class TestFundAPI:
    """Test /api/funds/* endpoints."""

    def test_search_all(self, client):
        resp = client.get("/api/funds/search?q=易方达")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert len(data["data"]) > 0

    def test_search_by_query(self, client):
        resp = client.get("/api/funds/search?q=白酒")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["data"]) > 0
        assert "白酒" in data["data"][0]["name"]

    def test_search_by_risk(self, client):
        resp = client.get("/api/funds/search?risk=R4")
        assert resp.status_code == 200
        data = resp.json()
        for fund in data["data"]:
            assert fund["risk"] == "R4"

    def test_fund_detail(self, client):
        resp = client.get("/api/funds/detail/110011")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["symbol"] == "110011"

    def test_fund_detail_not_found(self, client):
        resp = client.get("/api/funds/detail/999999")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False

    def test_dca_simulate(self, client):
        resp = client.post(
            "/api/funds/dca/simulate",
            json={
                "symbol": "110011",
                "amount_per_period": 1000,
                "frequency": "monthly",
                "periods": 24,
                "initial_price": 1.0,
                "annual_growth_pct": 8,
                "volatility_pct": 15,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "dca" in data["data"]
        assert "lumpsum" in data["data"]
        assert "winner" in data["data"]
        assert data["data"]["dca"]["total_invested"] > 0

    def test_dca_simulate_weekly(self, client):
        resp = client.post(
            "/api/funds/dca/simulate",
            json={
                "symbol": "161725",
                "amount_per_period": 500,
                "frequency": "weekly",
                "periods": 52,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
