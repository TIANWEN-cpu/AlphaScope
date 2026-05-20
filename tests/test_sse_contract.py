"""SSE Contract Tests — 验证 /api/chat/stream 事件格式契约"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from httpx import ASGITransport, AsyncClient

from backend.api.main import app


def _parse_sse_events(body: str) -> list[dict]:
    """解析 SSE 响应体为事件列表"""
    events = []
    for line in body.split("\n"):
        line = line.strip()
        if line.startswith("data: "):
            payload = line[6:]
            events.append(json.loads(payload))
    return events


def _mock_orchestrator(result: dict) -> MagicMock:
    """创建 mock ChatOrchestrator"""
    mock_orch = MagicMock()
    mock_orch.new_conversation.return_value = "test-conv-id"
    mock_orch.send_message.return_value = result
    return mock_orch


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.anyio
async def test_status_event_has_type_and_mode(client):
    """status event 必须包含 type 和 mode"""
    mock_orch = _mock_orchestrator(
        {"mode": "deep", "content": "x", "evidence": [], "agents": {}}
    )

    with patch(
        "backend.ai_assistant.orchestrator.ChatOrchestrator", return_value=mock_orch
    ):
        resp = await client.post("/api/chat/stream", json={"message": "hi"})

    events = _parse_sse_events(resp.text)
    assert events[0]["type"] == "status"
    assert events[0]["mode"] == "deep"


@pytest.mark.anyio
async def test_content_events_have_type_and_chunk(client):
    """content event 必须包含 type 和 chunk"""
    mock_orch = _mock_orchestrator(
        {"mode": "free", "content": "hello world test", "evidence": [], "agents": {}}
    )

    with patch(
        "backend.ai_assistant.orchestrator.ChatOrchestrator", return_value=mock_orch
    ):
        resp = await client.post("/api/chat/stream", json={"message": "hi"})

    events = _parse_sse_events(resp.text)
    content_events = [e for e in events if e["type"] == "content"]
    assert len(content_events) >= 1
    for ev in content_events:
        assert "chunk" in ev
        assert isinstance(ev["chunk"], str)
        assert len(ev["chunk"]) > 0


@pytest.mark.anyio
async def test_evidence_event_has_type_and_data(client):
    """evidence event 必须包含 type 和 data (list)"""
    evidence_data = [{"source": "test", "text": "evidence1"}]
    mock_orch = _mock_orchestrator(
        {"mode": "deep", "content": "x", "evidence": evidence_data, "agents": {}}
    )

    with patch(
        "backend.ai_assistant.orchestrator.ChatOrchestrator", return_value=mock_orch
    ):
        resp = await client.post("/api/chat/stream", json={"message": "hi"})

    events = _parse_sse_events(resp.text)
    evidence_events = [e for e in events if e["type"] == "evidence"]
    assert len(evidence_events) == 1
    assert evidence_events[0]["data"] == evidence_data


@pytest.mark.anyio
async def test_agents_event_has_type_and_data(client):
    """agents event 必须包含 type 和 data (dict)"""
    agents_data = {"fundamental": {"signal": "buy", "confidence": 80}}
    mock_orch = _mock_orchestrator(
        {"mode": "deep", "content": "x", "evidence": [], "agents": agents_data}
    )

    with patch(
        "backend.ai_assistant.orchestrator.ChatOrchestrator", return_value=mock_orch
    ):
        resp = await client.post("/api/chat/stream", json={"message": "hi"})

    events = _parse_sse_events(resp.text)
    agents_events = [e for e in events if e["type"] == "agents"]
    assert len(agents_events) == 1
    assert agents_events[0]["data"] == agents_data


@pytest.mark.anyio
async def test_done_event_is_always_last(client):
    """done event 始终是最后一个"""
    mock_orch = _mock_orchestrator(
        {
            "mode": "deep",
            "content": "test",
            "evidence": [{"source": "s", "text": "e"}],
            "agents": {"a": {"signal": "buy"}},
        }
    )

    with patch(
        "backend.ai_assistant.orchestrator.ChatOrchestrator", return_value=mock_orch
    ):
        resp = await client.post("/api/chat/stream", json={"message": "hi"})

    events = _parse_sse_events(resp.text)
    assert events[-1]["type"] == "done"


@pytest.mark.anyio
async def test_content_chunking_20_char_max(client):
    """content 按 20 字符分块，最后一块可能更短"""
    content = "a" * 45  # 20 + 20 + 5
    mock_orch = _mock_orchestrator(
        {"mode": "free", "content": content, "evidence": [], "agents": {}}
    )

    with patch(
        "backend.ai_assistant.orchestrator.ChatOrchestrator", return_value=mock_orch
    ):
        resp = await client.post("/api/chat/stream", json={"message": "hi"})

    events = _parse_sse_events(resp.text)
    chunks = [e["chunk"] for e in events if e["type"] == "content"]

    assert len(chunks) == 3
    assert len(chunks[0]) == 20
    assert len(chunks[1]) == 20
    assert len(chunks[2]) == 5
    assert "".join(chunks) == content

    for chunk in chunks:
        assert len(chunk) <= 20


@pytest.mark.anyio
async def test_conditional_events_absent_when_empty(client):
    """evidence 和 agents 为空时不发送对应 event"""
    mock_orch = _mock_orchestrator(
        {"mode": "free", "content": "ok", "evidence": [], "agents": {}}
    )

    with patch(
        "backend.ai_assistant.orchestrator.ChatOrchestrator", return_value=mock_orch
    ):
        resp = await client.post("/api/chat/stream", json={"message": "hi"})

    events = _parse_sse_events(resp.text)
    types = [e["type"] for e in events]
    assert "evidence" not in types
    assert "agents" not in types
    assert types == ["status", "content", "done"]


@pytest.mark.anyio
async def test_orchestrator_failure_returns_json_not_sse():
    """orchestrator 异常时返回 JSON 错误而非 SSE"""
    mock_orch = MagicMock()
    mock_orch.new_conversation.return_value = "test-conv-id"
    mock_orch.send_message.side_effect = RuntimeError("boom")

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch(
            "backend.ai_assistant.orchestrator.ChatOrchestrator", return_value=mock_orch
        ):
            resp = await client.post("/api/chat/stream", json={"message": "hi"})

    assert resp.status_code == 500
    data = resp.json()
    assert data["success"] is False
    assert "error" in data
