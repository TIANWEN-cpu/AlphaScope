"""Tests for Agent/Team Editor API — Agent/专家团管理端点"""

from __future__ import annotations

from unittest.mock import patch

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from httpx import ASGITransport, AsyncClient

from backend.api.main import app

MOCK_AGENTS = [
    {
        "id": "fundamental",
        "name": "基本面分析师",
        "description": "分析财报和估值",
        "provider": "claude",
        "model": "claude-sonnet-4-5",
        "tools": ["search", "calculator"],
        "temperature": 0.3,
        "max_tokens": 400,
        "enabled": True,
    },
    {
        "id": "technical",
        "name": "技术面分析师",
        "description": "分析K线和指标",
        "provider": "gpt",
        "model": "gpt-5.2",
        "tools": ["chart"],
        "temperature": 0.2,
        "max_tokens": 300,
        "enabled": True,
    },
]

MOCK_TEAMS = [
    {
        "id": "stock-partner",
        "name": "股票合伙人团队",
        "description": "十位专家一体分析",
        "members": [
            {"agent_id": "fundamental", "role": "member", "sort_order": 0},
            {"agent_id": "technical", "role": "member", "sort_order": 1},
        ],
    },
]


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.anyio
async def test_list_agents(client):
    """GET /api/manage/agents 返回 Agent 列表"""
    with patch("backend.agent_store.list_agents", return_value=MOCK_AGENTS):
        resp = await client.get("/api/manage/agents")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["data"]["agents"]) == 2
    assert data["data"]["agents"][0]["id"] == "fundamental"


@pytest.mark.anyio
async def test_save_agent(client):
    """POST /api/manage/agents 创建 Agent"""
    saved = {**MOCK_AGENTS[0], "system_prompt": "分析基本面"}
    with patch("backend.agent_store.save_agent", return_value=saved):
        resp = await client.post(
            "/api/manage/agents",
            json={
                "id": "fundamental",
                "name": "基本面分析师",
                "description": "分析财报和估值",
                "provider": "claude",
                "model": "claude-sonnet-4-5",
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["id"] == "fundamental"


@pytest.mark.anyio
async def test_delete_agent(client):
    """DELETE /api/manage/agents/{id} 删除 Agent"""
    with patch("backend.agent_store.delete_agent", return_value=True):
        resp = await client.delete("/api/manage/agents/fundamental")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["deleted"] == "fundamental"


@pytest.mark.anyio
async def test_delete_agent_not_found(client):
    """DELETE 不存在的 Agent 返回失败"""
    with patch("backend.agent_store.delete_agent", return_value=False):
        resp = await client.delete("/api/manage/agents/nonexistent")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert "不存在" in data["error"]


@pytest.mark.anyio
async def test_list_teams(client):
    """GET /api/manage/teams 返回专家团列表"""
    with patch("backend.agent_store.list_teams", return_value=MOCK_TEAMS):
        resp = await client.get("/api/manage/teams")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["data"]["teams"]) == 1


@pytest.mark.anyio
async def test_save_team(client):
    """POST /api/manage/teams 创建专家团"""
    with patch("backend.agent_store.save_team", return_value=MOCK_TEAMS[0]):
        resp = await client.post(
            "/api/manage/teams",
            json={
                "id": "stock-partner",
                "name": "股票合伙人团队",
                "description": "十位专家一体分析",
                "member_ids": ["fundamental", "technical"],
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["id"] == "stock-partner"


@pytest.mark.anyio
async def test_delete_team(client):
    """DELETE /api/manage/teams/{id} 删除专家团"""
    with patch("backend.agent_store.delete_team", return_value=True):
        resp = await client.delete("/api/manage/teams/stock-partner")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["deleted"] == "stock-partner"


@pytest.mark.anyio
async def test_delete_team_not_found(client):
    """DELETE 不存在的专家团返回失败"""
    with patch("backend.agent_store.delete_team", return_value=False):
        resp = await client.delete("/api/manage/teams/nonexistent")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
