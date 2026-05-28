"""Tests for Settings API — 模型 Provider 管理端点"""

from __future__ import annotations

import sqlite3
from unittest.mock import patch

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from httpx import ASGITransport, AsyncClient

from backend.api.main import app

MOCK_PROVIDERS = [
    {
        "id": "deepseek",
        "name": "DeepSeek",
        "type": "openai_compatible",
        "base_url": "https://api.deepseek.com/v1",
        "api_key_masked": "sk-a...x9Zz",
        "enabled": True,
        "config_json": "{}",
    },
    {
        "id": "claude",
        "name": "Claude",
        "type": "openai_compatible",
        "base_url": "https://api.anthropic.com",
        "api_key_masked": "sk-a...bcde",
        "enabled": True,
        "config_json": "{}",
    },
]


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class _MemoryDatabase:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn


@pytest.mark.anyio
async def test_list_providers(client):
    """GET /api/settings/providers 返回 provider 列表"""
    with patch("backend.settings_store.list_providers", return_value=MOCK_PROVIDERS):
        resp = await client.get("/api/settings/providers")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["data"]["providers"]) == 2
    assert data["data"]["providers"][0]["id"] == "deepseek"


@pytest.mark.anyio
async def test_get_preferences(client):
    """GET /api/settings/preferences 返回应用偏好设置"""
    preferences = {
        "general": {"default_symbol": "600519", "refresh_interval": 60},
        "data": {"news_limit": 30},
    }
    with patch("backend.settings_store.get_app_preferences", return_value=preferences):
        resp = await client.get("/api/settings/preferences")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["preferences"]["general"]["default_symbol"] == "600519"


@pytest.mark.anyio
async def test_save_preferences(client):
    """PUT /api/settings/preferences 保存应用偏好设置"""
    saved = {
        "general": {"default_symbol": "000001", "refresh_interval": 15},
        "data": {"news_limit": 35},
    }
    with patch("backend.settings_store.save_app_preferences", return_value=saved):
        resp = await client.put(
            "/api/settings/preferences",
            json={
                "preferences": {
                    "general": {"default_symbol": "000001", "refresh_interval": 15}
                }
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["preferences"]["general"]["default_symbol"] == "000001"


@pytest.mark.anyio
async def test_save_provider(client):
    """POST /api/settings/providers 保存 provider"""
    saved = {
        "id": "test-provider",
        "name": "Test",
        "type": "openai_compatible",
        "base_url": "https://api.test.com/v1",
        "api_key": "sk-test123456789",
        "api_key_masked": "sk-t...6789",
        "enabled": True,
        "config_json": "{}",
    }
    with patch("backend.settings_store.save_provider", return_value=saved):
        resp = await client.post(
            "/api/settings/providers",
            json={
                "id": "test-provider",
                "name": "Test",
                "base_url": "https://api.test.com/v1",
                "api_key": "sk-test123456789",
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["id"] == "test-provider"
    assert "api_key" not in data["data"]
    assert data["data"]["api_key_masked"] == "sk-t...6789"


@pytest.mark.anyio
async def test_save_provider_response_does_not_leak_plaintext_key(client):
    """POST /api/settings/providers 响应不回显明文 API Key"""
    saved = {
        "id": "test-provider",
        "name": "Test",
        "type": "openai_compatible",
        "base_url": "https://api.test.com/v1",
        "api_key": "sk-secret-plaintext",
        "api_key_masked": "sk-s...text",
        "enabled": True,
        "config_json": "{}",
    }
    with patch("backend.settings_store.save_provider", return_value=saved):
        resp = await client.post(
            "/api/settings/providers",
            json={
                "id": "test-provider",
                "name": "Test",
                "base_url": "https://api.test.com/v1",
                "api_key": "sk-secret-plaintext",
            },
        )

    data = resp.json()
    assert data["success"] is True
    assert "api_key" not in data["data"]
    assert "sk-secret-plaintext" not in resp.text
    assert data["data"]["api_key_masked"] == "sk-s...text"


@pytest.mark.anyio
async def test_delete_provider(client):
    """DELETE /api/settings/providers/{id} 删除 provider"""
    with patch("backend.settings_store.delete_provider", return_value=True):
        resp = await client.delete("/api/settings/providers/test-provider")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["deleted"] == "test-provider"


@pytest.mark.anyio
async def test_delete_provider_not_found(client):
    """DELETE 不存在的 provider 返回失败"""
    with patch("backend.settings_store.delete_provider", return_value=False):
        resp = await client.delete("/api/settings/providers/nonexistent")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert "不存在" in data["error"]


@pytest.mark.anyio
async def test_test_connection_success(client):
    """POST /api/settings/providers/{id}/test 连接成功"""
    result = {
        "success": True,
        "models": ["deepseek-chat", "deepseek-reasoner"],
        "message": "连接成功",
    }
    with patch("backend.settings_store.test_connection", return_value=result):
        resp = await client.post("/api/settings/providers/deepseek/test")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "models" in data["data"]


@pytest.mark.anyio
async def test_test_connection_failure(client):
    """POST /api/settings/providers/{id}/test 连接失败"""
    result = {"success": False, "error": "连接失败: Connection refused"}
    with patch("backend.settings_store.test_connection", return_value=result):
        resp = await client.post("/api/settings/providers/deepseek/test")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert "连接失败" in data["data"]["error"]


@pytest.mark.anyio
async def test_masked_key_in_response(client):
    """响应中 API Key 已脱敏"""
    with patch("backend.settings_store.list_providers", return_value=MOCK_PROVIDERS):
        resp = await client.get("/api/settings/providers")
    data = resp.json()
    for p in data["data"]["providers"]:
        assert "api_key_masked" in p
        assert p["api_key_masked"].startswith("sk-")
        assert "..." in p["api_key_masked"]
        # 不应包含完整 key
        assert "api_key" not in p or p.get("api_key", "") == ""


def test_save_provider_empty_key_preserves_existing_key():
    """更新已有 provider 时空 API Key 不清空旧密钥"""
    from backend import settings_store

    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row

    with (
        patch("backend.settings_store.Database", return_value=_MemoryDatabase(conn)),
        patch("backend.settings_store._sync_to_gateway"),
    ):
        settings_store.save_provider(
            provider_id="keep-key",
            name="Keep Key",
            base_url="https://old.example.com/v1",
            api_key="sk-original-key",
            enabled=True,
        )
        settings_store.save_provider(
            provider_id="keep-key",
            name="Keep Key Updated",
            base_url="https://new.example.com/v1",
            api_key="",
            enabled=True,
        )
        provider = settings_store.get_provider("keep-key")

    assert provider is not None
    assert provider["api_key"] == "sk-original-key"
    assert provider["base_url"] == "https://new.example.com/v1"


def test_provider_names_are_cleaned_before_returning():
    """DB 中的历史乱码 provider 名称不应继续透出给前端或 gateway。"""
    from backend import settings_store

    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row

    with (
        patch("backend.settings_store.Database", return_value=_MemoryDatabase(conn)),
        patch("backend.settings_store._sync_to_gateway"),
    ):
        settings_store.save_provider(
            provider_id="sensenova",
            name="ÉÌÌÀ",
            base_url="https://api.sensenova.cn/v1",
            api_key="sk-original-key",
            enabled=True,
        )
        providers = settings_store.list_providers()
        provider = settings_store.get_provider("sensenova")

    assert providers[0]["name"] == "商汤"
    assert provider is not None
    assert provider["name"] == "商汤"


def test_app_preferences_are_persisted_and_sanitized():
    """应用偏好设置应持久化，并对越界数值回落到允许范围。"""
    from backend import settings_store

    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row

    with patch("backend.settings_store.Database", return_value=_MemoryDatabase(conn)):
        saved = settings_store.save_app_preferences(
            {
                "general": {
                    "default_symbol": "000001",
                    "refresh_interval": 1,
                    "theme": "unknown",
                },
                "data": {"news_limit": 500},
                "unknown": {"x": 1},
            }
        )
        loaded = settings_store.get_app_preferences()

    assert saved["general"]["default_symbol"] == "000001"
    assert saved["general"]["refresh_interval"] == 10
    assert saved["general"]["theme"] == "dark"
    assert saved["data"]["news_limit"] == 100
    assert loaded == saved


@pytest.mark.anyio
async def test_export_settings(client):
    """GET /api/settings/export 导出不含明文 key"""
    export_data = {
        "version": "1.0",
        "providers": [
            {
                "id": "deepseek",
                "name": "DeepSeek",
                "base_url": "https://api.deepseek.com/v1",
                "api_key_masked": "sk-a...x9Zz",
                "enabled": True,
            }
        ],
    }
    with patch("backend.settings_store.export_settings", return_value=export_data):
        resp = await client.get("/api/settings/export")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    for p in data["data"]["providers"]:
        assert "api_key_masked" in p
        assert "api_key" not in p


@pytest.mark.anyio
async def test_import_settings(client):
    """POST /api/settings/import 导入设置"""
    import_result = {
        "imported": 2,
        "message": "导入 2 个 provider（需手动填写 API Key）",
    }
    with patch("backend.settings_store.import_settings", return_value=import_result):
        resp = await client.post(
            "/api/settings/import",
            json={
                "version": "1.0",
                "providers": [
                    {
                        "id": "deepseek",
                        "name": "DeepSeek",
                        "base_url": "https://api.deepseek.com/v1",
                    },
                    {
                        "id": "claude",
                        "name": "Claude",
                        "base_url": "https://api.anthropic.com",
                    },
                ],
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["imported"] == 2
