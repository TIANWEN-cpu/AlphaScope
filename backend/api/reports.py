"""报告中心 API — 暴露 archive.py 的报告管理功能"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from backend.schemas.api import ApiResponse

router = APIRouter(prefix="/api/archive", tags=["archive"])


@router.get("")
async def list_reports(
    stock: Optional[str] = Query(None, description="股票名称/代码筛选"),
    decision: Optional[str] = Query(None, description="决策筛选（买/卖/持）"),
    date_from: Optional[str] = Query(None, description="起始日期 YYYYMMDD"),
    date_to: Optional[str] = Query(None, description="结束日期 YYYYMMDD"),
    type: Optional[str] = Query(None, description="类型: agent/roundtable"),
    limit: int = Query(200, ge=1, le=1000, description="返回数量"),
):
    """报告列表（支持筛选）"""
    from backend.archive import list_reports as _list

    reports = _list(
        stock_filter=stock,
        decision_filter=decision,
        date_from=date_from,
        date_to=date_to,
        type_filter=type,
        limit=limit,
    )
    return ApiResponse(success=True, data={"reports": reports, "total": len(reports)})


@router.get("/stats")
async def get_stats():
    """全局统计"""
    from backend.archive import get_stats as _stats

    return ApiResponse(success=True, data=_stats())


@router.get("/combo-stats")
async def get_combo_stats():
    """模型组合统计"""
    from backend.archive import get_combo_stats as _combo

    return ApiResponse(success=True, data={"combos": _combo()})


@router.get("/{path:path}")
async def get_report(path: str):
    """读取报告内容"""
    from backend.archive import load_report as _load

    content = _load(path)
    if content.startswith("⚠️"):
        raise HTTPException(status_code=404, detail=content)
    return ApiResponse(success=True, data={"path": path, "content": content})


@router.delete("/{path:path}")
async def delete_report(path: str):
    """删除报告"""
    from backend.archive import delete_report as _delete

    deleted = _delete(path)
    if not deleted:
        return ApiResponse(success=False, error="报告不存在或路径不允许")
    return ApiResponse(success=True, data={"deleted": path})
