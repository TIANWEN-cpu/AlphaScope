from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from httpx import ASGITransport, AsyncClient


def _reload_api_main(monkeypatch, token: str = "test-runtime-token"):
    monkeypatch.setenv("ALPHASCOPE_LOCAL_API_TOKEN", token)
    import backend.api.main as main

    return importlib.reload(main)


@pytest.mark.anyio
async def test_mutating_api_requires_per_run_local_token(monkeypatch):
    main = _reload_api_main(monkeypatch)
    transport = ASGITransport(app=main.app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put(
            "/api/settings/preferences",
            json={"preferences": {"general": {"default_symbol": "000001"}}},
        )

    assert resp.status_code == 401
    data = resp.json()
    assert data["success"] is False
    assert "local API token" in data["error"]


@pytest.mark.anyio
async def test_mutating_api_accepts_matching_per_run_local_token(monkeypatch):
    main = _reload_api_main(monkeypatch, token="expected-token")
    transport = ASGITransport(app=main.app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with monkeypatch.context() as m:
            m.setattr(
                "backend.settings_store.save_app_preferences",
                lambda preferences: preferences,
            )
            resp = await client.put(
                "/api/settings/preferences",
                headers={"X-AlphaScope-Local-Token": "expected-token"},
                json={"preferences": {"general": {"default_symbol": "000001"}}},
            )

    assert resp.status_code == 200
    assert resp.json()["success"] is True


def test_launcher_runtime_config_contains_per_run_local_token(tmp_path, monkeypatch):
    import launcher

    monkeypatch.setattr(launcher, "is_frozen", lambda: True)
    launcher.write_runtime_config(tmp_path, api_port=8123, local_api_token="runtime-secret")

    config_text = (tmp_path / "runtime-config.js").read_text(encoding="utf-8")
    payload = json.loads(config_text.split(" = ", 1)[1].rstrip(";\n"))

    assert payload["apiBaseUrl"] == "http://127.0.0.1:8123"
    assert payload["localApiToken"] == "runtime-secret"
    assert payload["packaged"] is True


def test_launcher_generates_distinct_local_tokens():
    import launcher

    first = launcher.generate_local_api_token()
    second = launcher.generate_local_api_token()

    assert isinstance(first, str)
    assert len(first) >= 32
    assert first != second
