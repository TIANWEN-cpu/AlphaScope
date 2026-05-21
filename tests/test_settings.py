"""Tests for Settings API — 模型 Provider 管理端点"""

from __future__ import annotations

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
