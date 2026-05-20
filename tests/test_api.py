"""API Smoke Tests — FastAPI 后端端点基础验证"""

from __future__ import annotations

import pytest

# Skip all tests if fastapi/httpx not installed
pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from httpx import AsyncClient, ASGITransport

from backend.api.main import app


@pytest.fixture
def client():
    """创建测试客户端"""
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.anyio
async def test_root(client):
    """GET / 返回服务信息"""
    resp = await client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["service"] == "AI-Finance API"


@pytest.mark.anyio
async def test_health(client):
    """GET /health 返回 healthy"""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["status"] == "healthy"


@pytest.mark.anyio
async def test_list_modes(client):
    """GET /api/modes 返回模式列表"""
    resp = await client.get("/api/modes")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "modes" in data["data"]


@pytest.mark.anyio
async def test_list_agents(client):
    """GET /api/agents 返回 agent 列表"""
    resp = await client.get("/api/agents")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "agents" in data["data"]


@pytest.mark.anyio
async def test_list_agent_models(client):
    """GET /api/agents/models 返回模型分配表"""
    resp = await client.get("/api/agents/models")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "agents" in data["data"]


@pytest.mark.anyio
async def test_list_teams(client):
    """GET /api/teams 返回专家团列表"""
    resp = await client.get("/api/teams")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "teams" in data["data"]


@pytest.mark.anyio
async def test_list_providers(client):
    """GET /api/models/providers 返回供应商列表"""
    resp = await client.get("/api/models/providers")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "providers" in data["data"]


@pytest.mark.anyio
async def test_list_templates(client):
    """GET /api/templates 返回模板列表"""
    resp = await client.get("/api/templates")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "templates" in data["data"]


@pytest.mark.anyio
async def test_not_found_returns_error_format(client):
    """GET /api/teams/nonexistent 返回统一错误格式"""
    resp = await client.get("/api/teams/nonexistent")
    assert resp.status_code == 404
    data = resp.json()
    assert data["success"] is False
    assert "error" in data


@pytest.mark.anyio
async def test_conversation_crud(client):
    """会话 CRUD 流程"""
    # Create
    resp = await client.post(
        "/api/conversations",
        json={"title": "测试会话", "mode": "free"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    conv_id = data["data"]["id"]

    # List
    resp = await client.get("/api/conversations")
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Get
    resp = await client.get(f"/api/conversations/{conv_id}")
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Delete
    resp = await client.delete(f"/api/conversations/{conv_id}")
    assert resp.status_code == 200
    assert resp.json()["success"] is True


@pytest.mark.anyio
async def test_report_not_found(client):
    """GET /api/reports/nonexistent 返回 404"""
    resp = await client.get("/api/reports/nonexistent")
    assert resp.status_code == 404
    data = resp.json()
    assert data["success"] is False
