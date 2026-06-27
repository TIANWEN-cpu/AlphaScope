"""系统监控中心 API (v1.9.10)

把数据源 / 回测引擎 / 实验记录 / 模型成本 / 工具调用 / 执行追踪的健康信号
聚合成单一快照, 供前端「监控中心」单页总览。纯聚合、失败安全、不触网。
"""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.api import ApiResponse

router = APIRouter(prefix="/api/monitor", tags=["monitor"])


@router.get("/snapshot")
async def monitor_snapshot():
    """系统健康聚合快照(各组件状态 + 系统总状态)。"""
    from backend.observability.monitor import build_system_snapshot

    return ApiResponse(success=True, data=build_system_snapshot())
