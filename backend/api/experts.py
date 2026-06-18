"""投资人库 API — 列出 config/experts.yaml 中的投资人 persona(只读)。

供前端"投资人面板"展示。纯新增,不改动既有功能。
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

from backend.schemas.api import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/experts", tags=["experts"])


@router.get("")
def list_experts():
    """列出投资人 persona(id/名称/风格/图标/关注维度/理念预览)。"""
    import yaml

    from backend.expert_panel import EXPERTS_YAML_PATH

    try:
        data = yaml.safe_load(EXPERTS_YAML_PATH.read_text(encoding="utf-8")) or {}
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("[experts] 读取 experts.yaml 失败: %s", exc)
        return ApiResponse(success=True, data={"experts": [], "total": 0})

    experts = []
    for e in data.get("experts") or []:
        prompt = str(e.get("system_prompt") or "").strip()
        preview = (prompt[:160] + "…") if len(prompt) > 160 else prompt
        experts.append(
            {
                "id": e.get("key"),
                "name": e.get("name"),
                "style": e.get("style"),
                "icon": e.get("icon"),
                "focus_dims": e.get("focus_dims") or [],
                "preview": preview,
                "model": e.get("preferred_model"),
            }
        )

    return ApiResponse(success=True, data={"experts": experts, "total": len(experts)})
