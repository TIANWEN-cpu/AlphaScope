"""Report generation API (v1.1.4)

Provides template listing and report generation endpoints.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/reports/templates", tags=["report-templates"])


class ReportGenerateRequest(BaseModel):
    template_name: str = Field(description="模板名称")
    data: dict[str, Any] = Field(default_factory=dict, description="报告数据")


@router.get("")
def list_report_templates() -> dict[str, Any]:
    """列出所有报告模板"""
    from backend.ai_assistant.report_templates import list_templates

    return {"success": True, "data": list_templates()}


@router.get("/{template_name}")
def get_report_template(template_name: str) -> dict[str, Any]:
    """获取模板详情"""
    from backend.ai_assistant.report_templates import get_template

    template = get_template(template_name)
    if not template:
        raise HTTPException(status_code=404, detail=f"模板不存在: {template_name}")
    return {"success": True, "data": template.to_dict()}


@router.post("/generate")
def generate_report(req: ReportGenerateRequest) -> dict[str, Any]:
    """使用模板生成报告"""
    from backend.ai_assistant.report_templates import generate_report

    content = generate_report(req.template_name, req.data)
    if content is None:
        raise HTTPException(status_code=400, detail=f"未知模板: {req.template_name}")
    return {
        "success": True,
        "data": {
            "template": req.template_name,
            "content": content,
            "format": "markdown",
        },
    }
