from __future__ import annotations

from fastapi.testclient import TestClient

from backend.api.main import app


client = TestClient(app)


def test_news_list_accepts_normal_limit(monkeypatch):
    monkeypatch.setattr(
        "backend.news_store.list_news",
        lambda **kwargs: [{"id": "n1", "title": "hello"}],
    )

    response = client.get("/api/news?limit=50")

    assert response.status_code == 200
    assert response.json()["success"] is True


def test_news_list_rejects_excessive_limit():
    response = client.get("/api/news?limit=101")

    assert response.status_code == 422


def test_news_events_accepts_normal_days(monkeypatch):
    monkeypatch.setattr(
        "backend.news_store.get_event_summary",
        lambda symbol, days=30: {"symbol": symbol, "days": days},
    )

    response = client.get("/api/news/events/600519.SH?days=30")

    assert response.status_code == 200
    assert response.json()["success"] is True


def test_news_events_rejects_excessive_days():
    response = client.get("/api/news/events/600519.SH?days=181")

    assert response.status_code == 422


def test_news_impact_accepts_normal_window(monkeypatch):
    monkeypatch.setattr(
        "backend.news_store.list_news",
        lambda **kwargs: [{"id": "e1", "title": "event"}],
    )
    monkeypatch.setattr(
        "backend.price_store.get_prices",
        lambda symbol, limit=250: [
            {"date": "2026-05-01", "open": 10, "close": 11, "high": 12, "low": 9, "volume": 1000}
        ],
    )
    monkeypatch.setattr(
        "backend.event_impact.analyze_event_impact",
        lambda events, prices, window_days=5: [{"window_days": window_days}],
    )
    monkeypatch.setattr(
        "backend.event_impact.correlate_events_prices",
        lambda events, prices: {"correlation": 0.5},
    )

    response = client.get("/api/news/impact/600519.SH?days=30&window=5")

    assert response.status_code == 200
    assert response.json()["success"] is True


def test_news_impact_rejects_excessive_window():
    response = client.get("/api/news/impact/600519.SH?days=30&window=31")

    assert response.status_code == 422


def test_technical_all_indicators_accepts_normal_limit(monkeypatch):
    monkeypatch.setattr(
        "backend.price_store.get_prices",
        lambda symbol, limit=250: [
            {"date": "2026-05-01", "open": 10, "close": 11, "high": 12, "low": 9, "volume": 1000}
        ],
    )
    monkeypatch.setattr(
        "backend.indicators.calc_all",
        lambda bars: {"bars": len(bars)},
    )

    response = client.get("/api/technical/600519.SH?limit=250")

    assert response.status_code == 200
    assert response.json()["success"] is True


def test_technical_all_indicators_rejects_excessive_limit():
    response = client.get("/api/technical/600519.SH?limit=501")

    assert response.status_code == 422


def test_technical_support_resistance_accepts_normal_lookback(monkeypatch):
    monkeypatch.setattr(
        "backend.price_store.get_prices",
        lambda symbol, limit=25: [
            {"date": "2026-05-01", "open": 10, "close": 11, "high": 12, "low": 9, "volume": 1000}
        ],
    )
    monkeypatch.setattr(
        "backend.indicators.calc_support_resistance",
        lambda bars, lookback=20: {"support": 9, "resistance": 12},
    )

    response = client.get("/api/technical/600519.SH/support-resistance?lookback=20")

    assert response.status_code == 200
    assert response.json()["success"] is True


def test_technical_support_resistance_rejects_excessive_lookback():
    response = client.get("/api/technical/600519.SH/support-resistance?lookback=121")

    assert response.status_code == 422
