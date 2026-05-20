"""Degradation Tests — 无 ChromaDB / 无 API Key 时的优雅降级"""

from __future__ import annotations

from unittest.mock import patch

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from httpx import ASGITransport, AsyncClient

from backend.api.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.fixture
def reset_vectorstore():
    """重置 VectorStore 单例，测试后恢复"""
    from backend.rag.vector_store import VectorStore

    original = VectorStore._instance
    VectorStore._instance = None
    yield
    VectorStore._instance = original


@pytest.mark.anyio
async def test_no_chromadb_app_starts(client, reset_vectorstore):
    """无 ChromaDB 时应用正常启动，health 端点正常"""
    from backend.rag.vector_store import VectorStore

    vs = VectorStore()
    with patch.object(vs, "_get_client", return_value=None):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

        resp = await client.get("/")
        assert resp.status_code == 200


@pytest.mark.anyio
async def test_no_chromadb_vector_search_fails_clearly(reset_vectorstore):
    """无 ChromaDB 时向量搜索抛出明确 RuntimeError"""
    from backend.rag.vector_store import VectorStore

    vs = VectorStore()
    with patch.object(vs, "_get_client", return_value=None):
        with pytest.raises(RuntimeError, match="chromadb"):
            vs.get_collection("test")


def test_no_api_keys_create_client_fails_clearly():
    """无 API Key 时 create_client 抛出明确错误"""
    from backend.models.provider_gateway import create_client

    empty_vendors = {
        "deepseek": {"api_key": None, "base_url": "https://api.deepseek.com/v1"},
        "claude": {"api_key": None, "base_url": "https://api.anthropic.com"},
    }

    with patch("backend.models.provider_gateway.VENDORS", empty_vendors):
        with pytest.raises(RuntimeError, match="未配置完整"):
            create_client("deepseek")


@pytest.mark.anyio
async def test_no_api_keys_app_starts(client):
    """无 API Key 时应用正常启动，health 端点正常"""
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["success"] is True
