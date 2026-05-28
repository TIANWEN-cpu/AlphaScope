"""设置 API — 模型 Provider 管理端点"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.schemas.api import ApiResponse

router = APIRouter(prefix="/api/settings", tags=["settings"])


# ============== Request/Response Models ==============


class ProviderSaveRequest(BaseModel):
    id: str = Field(description="Provider ID，如 deepseek、claude")
    name: str = Field(description="显示名称")
    base_url: str = Field(description="API Base URL")
    api_key: str = Field(default="", description="API Key（留空则不更新）")
    enabled: bool = Field(default=True, description="是否启用")


class ImportRequest(BaseModel):
    version: str = Field(default="1.0")
    providers: list[dict[str, Any]] = Field(default_factory=list)
    preferences: dict[str, Any] | None = Field(default=None)


class PreferencesSaveRequest(BaseModel):
    preferences: dict[str, Any] = Field(default_factory=dict)


def _public_provider(provider: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in provider.items() if key != "api_key"}


# ============== Endpoints ==============


@router.get("/providers")
async def list_providers():
    """列出所有 provider"""
    from backend.settings_store import list_providers as _list

    return ApiResponse(success=True, data={"providers": _list()})


@router.get("/preferences")
async def get_preferences():
    """读取前端系统偏好设置"""
    from backend.settings_store import get_app_preferences

    return ApiResponse(success=True, data={"preferences": get_app_preferences()})


@router.put("/preferences")
async def save_preferences(req: PreferencesSaveRequest):
    """保存前端系统偏好设置"""
    from backend.settings_store import save_app_preferences

    preferences = save_app_preferences(req.preferences)
    return ApiResponse(success=True, data={"preferences": preferences})


@router.post("/providers")
async def save_provider(req: ProviderSaveRequest):
    """添加或更新 provider"""
    from backend.settings_store import save_provider as _save

    result = _save(
        provider_id=req.id,
        name=req.name,
        base_url=req.base_url,
        api_key=req.api_key,
        enabled=req.enabled,
    )
    return ApiResponse(success=True, data=_public_provider(result))


@router.delete("/providers/{provider_id}")
async def delete_provider(provider_id: str):
    """删除 provider"""
    from backend.settings_store import delete_provider as _delete

    deleted = _delete(provider_id)
    if not deleted:
        return ApiResponse(success=False, error="Provider 不存在")
    return ApiResponse(success=True, data={"deleted": provider_id})


@router.post("/providers/{provider_id}/test")
async def test_provider_connection(provider_id: str):
    """测试 provider 连接"""
    from backend.settings_store import test_connection as _test

    result = _test(provider_id)
    return ApiResponse(success=result["success"], data=result)


@router.get("/providers/{provider_id}/models")
async def list_provider_models(provider_id: str):
    """列出 provider 的模型"""
    from backend.settings_store import get_provider

    provider = get_provider(provider_id)
    if not provider:
        return ApiResponse(success=False, error="Provider 不存在")

    if not provider["api_key"] or not provider["base_url"]:
        return ApiResponse(success=False, error="Provider 未配置完整")

    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=provider["api_key"], base_url=provider["base_url"], timeout=15.0
        )
        models = client.models.list()
        model_list = [
            {"id": m.id, "owned_by": getattr(m, "owned_by", "")}
            for m in (models.data or [])
        ]
        return ApiResponse(success=True, data={"models": model_list})
    except Exception as e:
        return ApiResponse(success=False, error=f"获取模型列表失败: {e}")


@router.get("/export")
async def export_settings():
    """导出设置（脱敏）"""
    from backend.settings_store import export_settings as _export

    return ApiResponse(success=True, data=_export())


@router.post("/import")
async def import_settings(req: ImportRequest):
    """导入设置"""
    from backend.settings_store import import_settings as _import

    payload: dict[str, Any] = {"version": req.version, "providers": req.providers}
    if req.preferences is not None:
        payload["preferences"] = req.preferences
    result = _import(payload)
    return ApiResponse(success=True, data=result)
