"""任务中心 API — 后台任务管理"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from backend.schemas.api import ApiResponse

router = APIRouter(tags=["tasks"])


class AsyncAnalysisRequest(BaseModel):
    stock_symbol: str = Field(description="股票代码")
    stock_name: str = Field(default="", description="股票名称")
    mode: str = Field(default="deep", description="分析模式: standard/deep/auto")
    conversation_id: str = Field(default="", description="会话 ID")


@router.get("/api/tasks")
async def list_tasks(
    status: Optional[str] = Query(
        None, description="状态筛选: pending/running/success/failed/cancelled"
    ),
    limit: int = Query(50, ge=1, le=500, description="返回数量"),
):
    """任务列表"""
    from backend.task_queue import TaskQueue

    tasks = TaskQueue().list_tasks(status=status, limit=limit)
    return ApiResponse(success=True, data={"tasks": tasks, "total": len(tasks)})


@router.get("/api/tasks/{task_id}")
async def get_task(task_id: str):
    """任务详情"""
    from backend.task_queue import TaskQueue

    task = TaskQueue().get_task(task_id)
    if not task:
        return ApiResponse(success=False, error="任务不存在")
    return ApiResponse(success=True, data=task)


@router.post("/api/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    """取消任务"""
    from backend.task_queue import TaskQueue

    cancelled = TaskQueue().cancel_task(task_id)
    if not cancelled:
        return ApiResponse(success=False, error="任务不存在或已完成")
    return ApiResponse(success=True, data={"cancelled": task_id})


@router.post("/api/analysis/async")
async def run_analysis_async(req: AsyncAnalysisRequest):
    """异步运行分析（返回 task_id）"""
    from backend.task_queue import TaskQueue

    def _run():
        from backend.runtime.orchestrator import run_agents_with_mode
        from backend.agent_modes import AnalysisMode

        mode_map = {
            "standard": AnalysisMode.STANDARD,
            "deep": AnalysisMode.DEEP,
            "auto": AnalysisMode.AUTO,
        }
        mode = mode_map.get(req.mode, AnalysisMode.DEEP)
        stock_data = {
            "symbol": req.stock_symbol,
            "name": req.stock_name,
            "close": 0,
            "day_change": 0,
            "period_change": 0,
            "period_high": 0,
            "period_low": 0,
            "days": 30,
            "volume": 0,
            "total_amount": 0,
        }
        return run_agents_with_mode(stock_data=stock_data, mode=mode)

    task_id = TaskQueue().submit(
        task_type="analysis",
        func=_run,
        conversation_id=req.conversation_id,
        input_data={
            "stock_symbol": req.stock_symbol,
            "stock_name": req.stock_name,
            "mode": req.mode,
        },
    )
    return ApiResponse(success=True, data={"task_id": task_id, "status": "pending"})
