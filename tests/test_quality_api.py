"""#2 研报质量门控 API + 导出 gate 集成 测试。"""

from __future__ import annotations

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi.testclient import TestClient

from backend.api.main import app
import backend.ai_assistant.conversation_store as cs

client = TestClient(app)


def test_report_gate_flags_fluff():
    resp = client.post(
        "/api/quality/report-gate",
        json={"text": "公司基本面良好。" * 5 + " 风险提示:仅供参考。"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["passed"] is False
    assert data["critical_count"] >= 1


def test_report_gate_clean_passes():
    clean = (
        "贵州茅台 ROE 31%,DCF 内在价值 ¥1850,安全边际 +14%,但 Comps 显示 PE 处同业高分位,存在分歧。"
        "风险提示:以上仅供参考,不构成投资建议。"
    )
    resp = client.post(
        "/api/quality/report-gate",
        json={
            "text": clean,
            "evidence_chain": {
                "coverage": 0.9,
                "overall_confidence": 0.7,
                "contradictions": [],
                "missing_evidence": [],
            },
        },
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["passed"] is True


def test_export_with_gate_appends_section(monkeypatch):
    monkeypatch.setattr(
        cs.ConversationStore,
        "get_conversation",
        lambda self, cid: {"title": "T", "stock_symbol": "600519", "mode": "deep"},
    )
    monkeypatch.setattr(
        cs.ConversationStore,
        "get_messages",
        lambda self, cid, limit=200: [
            {
                "role": "assistant",
                "content": "营收同比 +18%。",
                "timestamp": "t",
                "metadata": {},
            }
        ],
    )
    resp = client.get("/api/export/conversation/x.md?gate=true")
    assert resp.status_code == 200
    assert "质量门控" in resp.text
