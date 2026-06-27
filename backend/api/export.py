"""导出 API — 把研究成果导出为可下载文件。

会话 → Markdown 研报(复用 backend.ai_assistant.report_generator.generate_report)。
纯新增,不改动既有功能。
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/export", tags=["export"])


def _safe_filename(stem: str) -> str:
    keep = [c if (c.isalnum() or c in "-_") else "_" for c in stem]
    name = "".join(keep).strip("_") or "report"
    return name[:80]


@router.get("/conversation/{conversation_id}.md")
def export_conversation_markdown(
    conversation_id: str, gate: bool = Query(default=False)
):
    """把一段 AI 研究对话导出为 Markdown 文件(浏览器下载)。

    ``?gate=true`` 时附加 M3 研报质量门控结果(critical/warning)到文末。
    """
    from backend.ai_assistant.conversation_store import ConversationStore
    from backend.ai_assistant.report_generator import generate_report
    from backend.storage.db import Database

    store = ConversationStore(db=Database())
    conv = store.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")
    messages = store.get_messages(conversation_id)
    markdown = generate_report(conv, messages)

    if gate:
        from backend.quality.report_gate import format_human, run_gate

        result = run_gate(markdown, mode=conv.get("mode"))
        markdown += "\n\n---\n\n## 质量门控\n\n```\n" + format_human(result) + "\n```\n"

    stem = _safe_filename(
        f"alphascope-{conv.get('stock_symbol') or conv.get('title') or conversation_id}"
    )
    return Response(
        content=markdown,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{stem}.md"'},
    )
