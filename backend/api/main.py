"""
FastAPI 主入口 (v0.50)

提供完整的 REST API 和 SSE 流式输出：
- /api/chat/stream — 对话流式输出 (SSE)
- /api/analysis/run — 运行 Agent 分析
- /api/vision/analyze — 图片/K线图分析
- /api/agents — Agent 配置管理
- /api/teams — 专家团管理
- /api/models/providers — 模型供应商管理
- /api/reports — 分析报告
- /api/conversations — 对话管理
- /api/knowledge — 知识库管理

使用方式：
    uvicorn backend.api.main:app --reload --port 8000
"""

import asyncio
import json
import logging
from typing import AsyncGenerator, Any, Optional

logger = logging.getLogger(__name__)

try:
    from fastapi import FastAPI, File, HTTPException, Request, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse, StreamingResponse

    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

if HAS_FASTAPI:
    from backend.schemas.api import (
        AnalysisRequest,
        AnalysisResultData,
        ApiResponse,
        ChatRequest,
        ConversationCreate,
        ConversationData,
        FileUploadData,
        HealthData,
        ReportData,
        SearchData,
        TeamData,
        VisionRequest,
        VisionResultData,
    )

    app = FastAPI(
        title="AI-Finance API",
        description="金融 AI 分析工作台 API — 多 Agent 异构分析、专家团、K线图视觉分析",
        version="0.50.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ============== 注册路由 ==============

    from backend.api.settings import router as settings_router
    from backend.api.reports import router as reports_router
    from backend.api.tasks import router as tasks_router
    from backend.api.agents import router as agents_router
    from backend.api.knowledge import router as knowledge_router
    from backend.api.evidence import router as evidence_router
    from backend.api.prices import router as prices_router
    from backend.api.technical import router as technical_router
    from backend.api.fundamentals import router as fundamentals_router

    app.include_router(settings_router)
    app.include_router(reports_router)
    app.include_router(tasks_router)
    app.include_router(agents_router)
    app.include_router(knowledge_router)
    app.include_router(evidence_router)
    app.include_router(prices_router)
    app.include_router(technical_router)
    app.include_router(fundamentals_router)

    # ============== 全局错误处理 ==============

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=ApiResponse(success=False, error=exc.detail).model_dump(),
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=500,
            content=ApiResponse(success=False, error="内部服务器错误").model_dump(),
        )

    # ============== 健康检查 ==============

    @app.get("/", response_model=ApiResponse[dict[str, Any]])
    async def root():
        return ApiResponse(
            success=True,
            data={
                "status": "ok",
                "service": "AI-Finance API",
                "version": "0.50.0",
            },
        )

    @app.get("/health", response_model=ApiResponse[HealthData])
    async def health():
        return ApiResponse(
            success=True,
            data=HealthData(status="healthy", version="0.50.0"),
        )

    @app.get("/api/providers/health", response_model=ApiResponse[dict[str, Any]])
    async def providers_health():
        """数据源健康状态"""
        from backend.providers.registry import get_registry

        registry = get_registry()
        providers = []
        healthy = degraded = unhealthy = 0
        for name, provider in registry._providers.items():
            h = provider.health
            status = h.status.value if hasattr(h.status, "value") else str(h.status)
            if status == "healthy":
                healthy += 1
            elif status == "degraded":
                degraded += 1
            else:
                unhealthy += 1
            providers.append(
                {
                    "name": name,
                    "status": status,
                    "consecutive_failures": h.consecutive_failures,
                    "avg_latency_ms": round(h.avg_latency_ms, 1),
                    "last_error": h.error_message,
                    "data_types": provider.data_types,
                    "markets": provider.markets,
                }
            )
        return ApiResponse(
            success=True,
            data={
                "total": len(providers),
                "healthy": healthy,
                "degraded": degraded,
                "unhealthy": unhealthy,
                "providers": providers,
            },
        )

    # ============== 对话 API ==============

    @app.post("/api/conversations", response_model=ApiResponse[ConversationData])
    async def create_conversation(req: ConversationCreate):
        """创建新对话"""
        from backend.ai_assistant.conversation_store import ConversationStore
        from backend.storage.db import Database

        store = ConversationStore(db=Database())
        conv_id = store.create_conversation(
            title=req.title,
            stock_symbol=req.stock_symbol or "",
            stock_name=req.stock_name or "",
            mode=req.mode,
        )
        return ApiResponse(
            success=True,
            data=ConversationData(id=conv_id, title=req.title, mode=req.mode),
            message="对话已创建",
        )

    @app.get("/api/conversations", response_model=ApiResponse[dict[str, Any]])
    async def list_conversations(stock_symbol: Optional[str] = None, limit: int = 20):
        """列出对话"""
        from backend.ai_assistant.conversation_store import ConversationStore
        from backend.storage.db import Database

        store = ConversationStore(db=Database())
        convs = store.list_conversations(stock_symbol=stock_symbol, limit=limit)
        return ApiResponse(success=True, data={"conversations": convs})

    @app.get(
        "/api/conversations/{conversation_id}",
        response_model=ApiResponse[dict[str, Any]],
    )
    async def get_conversation(conversation_id: str):
        """获取对话详情"""
        from backend.ai_assistant.conversation_store import ConversationStore
        from backend.storage.db import Database

        store = ConversationStore(db=Database())
        conv = store.get_conversation(conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="对话不存在")
        messages = store.get_messages(conversation_id)
        return ApiResponse(
            success=True, data={"conversation": conv, "messages": messages}
        )

    @app.delete(
        "/api/conversations/{conversation_id}",
        response_model=ApiResponse[dict[str, str]],
    )
    async def delete_conversation(conversation_id: str):
        """删除对话"""
        from backend.ai_assistant.conversation_store import ConversationStore
        from backend.storage.db import Database

        store = ConversationStore(db=Database())
        store.delete_conversation(conversation_id)
        return ApiResponse(success=True, data={"status": "deleted"})

    # ============== 对话流式 API (SSE) ==============

    async def _sse_generator(result: dict) -> AsyncGenerator[str, None]:
        """将分析结果转为 SSE 事件流"""
        yield f"data: {json.dumps({'type': 'status', 'mode': result.get('mode', 'free')})}\n\n"

        content = result.get("content", "")
        chunk_size = 20
        for i in range(0, len(content), chunk_size):
            chunk = content[i : i + chunk_size]
            yield f"data: {json.dumps({'type': 'content', 'chunk': chunk})}\n\n"
            await asyncio.sleep(0.02)

        evidence = result.get("evidence", [])
        if evidence:
            yield f"data: {json.dumps({'type': 'evidence', 'data': evidence})}\n\n"

        agents = result.get("agents", {})
        if agents:
            yield f"data: {json.dumps({'type': 'agents', 'data': agents})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    @app.post("/api/chat/stream")
    async def chat_stream(req: ChatRequest):
        """对话流式输出 (SSE)"""
        from backend.ai_assistant.orchestrator import ChatOrchestrator

        orch = ChatOrchestrator()

        conv_id = req.conversation_id
        if not conv_id:
            conv_id = orch.new_conversation(
                stock_symbol=req.stock_symbol or "",
                stock_name=req.stock_name or "",
                mode=req.mode,
            )

        stock_data = None
        if req.stock_symbol:
            stock_data = {"symbol": req.stock_symbol, "name": req.stock_name or ""}

        result = orch.send_message(
            conversation_id=conv_id,
            user_input=req.message,
            stock_data=stock_data,
            expert_team_id=req.expert_team_id,
        )

        return StreamingResponse(
            _sse_generator(result),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # ============== 分析 API ==============

    @app.post("/api/analysis/run", response_model=ApiResponse[AnalysisResultData])
    async def run_analysis(req: AnalysisRequest):
        """运行 Agent 分析"""
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

        result = run_agents_with_mode(
            stock_data=stock_data,
            mode=mode,
            agent_configs=req.agent_configs,
            global_ai_settings=req.global_ai_settings,
        )

        return ApiResponse(
            success=True,
            data=AnalysisResultData(
                stock_symbol=req.stock_symbol,
                stock_name=req.stock_name,
                mode=result.get("mode", req.mode),
                result={
                    "summary": result.get("summary"),
                    "agents": {
                        k: {
                            "signal": v.get("signal"),
                            "confidence": v.get("confidence"),
                            "reason": v.get("reason"),
                        }
                        for k, v in result.get("agents", {}).items()
                    },
                    "critic": result.get("critic"),
                    "chairman_summary": result.get("chairman_summary"),
                },
            ),
        )

    # ============== 视觉分析 API ==============

    @app.post("/api/vision/analyze", response_model=ApiResponse[VisionResultData])
    async def analyze_vision(req: VisionRequest):
        """图片/K线图分析"""
        from backend.schemas.api import KlineAnalysisData, RealDataComparison
        from backend.vision.vision_agent import analyze_image

        result = analyze_image(
            image_base64=req.image_base64,
            mime_type=req.mime_type,
            user_context=req.user_context,
            vendor=req.vendor,
            model=req.model,
            ticker=req.ticker,
        )

        ticker = result.detection.ticker if result.detection else ""
        needs_followup = result.needs_more_info or False
        followup = result.missing_info if needs_followup else None

        # 构建 K 线分析结构化数据
        kline_data = None
        if result.kline_analysis:
            kline_data = KlineAnalysisData(
                trend=result.kline_analysis.trend,
                support_levels=result.kline_analysis.support_levels,
                resistance_levels=result.kline_analysis.resistance_levels,
                patterns=result.kline_analysis.patterns,
                summary=result.kline_analysis.summary,
            )

        # 构建真实行情交叉验证数据
        real_data = None
        if result.real_data and result.real_data.data_available:
            real_data = RealDataComparison(
                real_trend=result.real_data.real_trend,
                trend_consistent=result.real_data.trend_consistent,
                latest_close=result.real_data.latest_close,
                conflicts=result.real_data.conflicts,
            )

        return ApiResponse(
            success=True,
            data=VisionResultData(
                chart_type=result.detection.chart_type if result.detection else None,
                ticker=ticker or None,
                analysis=result.summary or "",
                needs_followup=needs_followup,
                followup_question=followup,
                kline_analysis=kline_data,
                real_data=real_data,
            ),
        )

    # ============== Agent 配置 API ==============

    @app.get("/api/agents", response_model=ApiResponse[dict[str, Any]])
    async def list_agents():
        """列出所有 Agent 配置"""
        from backend.agents.base import get_default_agent_configs

        return ApiResponse(success=True, data={"agents": get_default_agent_configs()})

    @app.get("/api/agents/models", response_model=ApiResponse[dict[str, Any]])
    async def list_agent_models():
        """列出 Agent 模型分配表"""
        from backend.agents.financial_agents import get_agent_model_table

        table = get_agent_model_table()
        return ApiResponse(
            success=True,
            data={
                "agents": [
                    {"key": k, "name": n, "vendor": v, "model": m}
                    for k, n, v, m in table
                ]
            },
        )

    # ============== 专家团 API ==============

    @app.get("/api/teams", response_model=ApiResponse[dict[str, Any]])
    async def list_teams():
        """列出所有专家团"""
        from backend.teams.team_loader import list_team_names

        return ApiResponse(success=True, data={"teams": list_team_names()})

    @app.get("/api/teams/{team_id}", response_model=ApiResponse[TeamData])
    async def get_team(team_id: str):
        """获取专家团详情"""
        from backend.teams.team_loader import get_team

        team = get_team(team_id)
        if not team:
            raise HTTPException(status_code=404, detail="专家团不存在")
        return ApiResponse(
            success=True,
            data=TeamData(
                id=team.id,
                name=team.name,
                description=team.description,
                members=[
                    {
                        "id": m.id,
                        "name": m.name,
                        "role": m.role,
                        "provider": m.provider,
                        "model": m.model,
                    }
                    for m in team.members
                ],
            ),
        )

    # ============== 模型供应商 API ==============

    @app.get("/api/models/providers", response_model=ApiResponse[dict[str, Any]])
    async def list_providers():
        """列出所有模型供应商"""
        from backend.models.provider_gateway import get_provider_list

        return ApiResponse(success=True, data={"providers": get_provider_list()})

    @app.get(
        "/api/models/providers/{provider_id}/models",
        response_model=ApiResponse[dict[str, Any]],
    )
    async def list_provider_models(provider_id: str):
        """列出指定供应商的模型"""
        from backend.models.provider_gateway import get_provider_models

        models = get_provider_models(provider_id)
        return ApiResponse(success=True, data={"models": models})

    # ============== 报告 API ==============

    @app.get("/api/reports/{report_id}", response_model=ApiResponse[ReportData])
    async def get_report(report_id: str):
        """获取分析报告"""
        from backend.ai_assistant.report_generator import generate_report
        from backend.ai_assistant.conversation_store import ConversationStore
        from backend.storage.db import Database

        store = ConversationStore(db=Database())
        conv = store.get_conversation(report_id)
        if not conv:
            raise HTTPException(status_code=404, detail="报告不存在")
        messages = store.get_messages(report_id)
        md = generate_report(conv, messages)
        return ApiResponse(
            success=True,
            data=ReportData(
                id=report_id,
                title=conv.get("title", ""),
                content=md,
                conversation_id=report_id,
                created_at=conv.get("created_at"),
            ),
        )

    # ============== 分析模式 API ==============

    @app.get("/api/modes", response_model=ApiResponse[dict[str, Any]])
    async def list_modes():
        """列出所有分析模式"""
        from backend.agent_modes import get_mode_choices

        return ApiResponse(success=True, data={"modes": get_mode_choices()})

    # ============== 文件上传 API ==============

    @app.post("/api/files/upload", response_model=ApiResponse[FileUploadData])
    async def upload_file(file: UploadFile = File(...)):
        """上传文件（图片/文档）— 支持 multipart/form-data"""
        import hashlib
        from pathlib import Path

        filename = file.filename or "upload.png"
        suffix = Path(filename).suffix.lower()
        supported = {
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".webp",
            ".bmp",
            ".pdf",
            ".csv",
            ".xlsx",
        }
        if suffix not in supported:
            raise HTTPException(status_code=400, detail=f"不支持的文件格式: {suffix}")

        content = await file.read()
        if len(content) > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="文件大小超过 20MB 限制")

        file_hash = hashlib.md5(content).hexdigest()

        from backend.project_paths import UPLOADS_DIR

        upload_dir = UPLOADS_DIR
        upload_dir.mkdir(parents=True, exist_ok=True)
        save_path = upload_dir / f"{file_hash}_{filename}"
        save_path.write_bytes(content)

        return ApiResponse(
            success=True,
            data=FileUploadData(
                filename=filename,
                size=len(content),
                path=str(save_path),
                message="上传成功",
            ),
        )

    # ============== 研究任务模板 API ==============

    @app.get("/api/templates", response_model=ApiResponse[dict[str, Any]])
    async def list_templates():
        """列出研究任务模板"""
        from backend.runtime.task_templates import list_templates

        return ApiResponse(success=True, data={"templates": list_templates()})

    @app.get("/api/templates/{template_id}", response_model=ApiResponse[dict[str, Any]])
    async def get_template(template_id: str):
        """获取模板详情"""
        from backend.runtime.task_templates import get_template

        t = get_template(template_id)
        if not t:
            raise HTTPException(status_code=404, detail="模板不存在")
        return ApiResponse(
            success=True,
            data={
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "icon": t.icon,
                "mode": t.mode,
                "requires_stock": t.requires_stock,
                "system_prompt": t.system_prompt,
                "output_format": t.output_format,
                "steps": t.steps,
            },
        )

    # ============== Web 搜索 API ==============

    @app.get("/api/search", response_model=ApiResponse[SearchData])
    async def web_search(query: str, max_results: int = 5):
        """联网搜索"""
        from backend.providers.web_search_provider import get_web_search_provider

        provider = get_web_search_provider()
        if not provider.is_available():
            raise HTTPException(
                status_code=503, detail="搜索服务未配置 (需要 TAVILY_API_KEY)"
            )

        results = provider.search(query, max_results)
        return ApiResponse(
            success=True,
            data=SearchData(
                query=query,
                results=[
                    {
                        "title": r.title,
                        "url": r.url,
                        "snippet": r.snippet,
                        "score": r.score,
                    }
                    for r in results
                ],
                source="tavily",
            ),
        )

    # ============== 成本统计 API ==============

    @app.get("/api/costs", response_model=ApiResponse[dict[str, Any]])
    async def get_costs(mode: Optional[str] = None):
        """获取 LLM 调用成本统计"""
        from backend.observability.cost_tracker import get_cost_tracker

        tracker = get_cost_tracker()
        return ApiResponse(success=True, data=tracker.get_summary(mode=mode))

    # ============== 回测 API ==============

    @app.get("/api/backtest/stats", response_model=ApiResponse[dict[str, Any]])
    async def get_backtest_stats(mode: Optional[str] = None):
        """获取后验验证统计"""
        from backend.archive.backtester import get_backtester

        bt = get_backtester()
        return ApiResponse(success=True, data=bt.get_performance_stats(mode=mode))

    @app.get("/api/backtest/agent-accuracy", response_model=ApiResponse[dict[str, Any]])
    async def get_agent_accuracy():
        """按 Agent 统计准确率"""
        from backend.archive.backtester import get_backtester

        bt = get_backtester()
        return ApiResponse(success=True, data={"agents": bt.get_agent_accuracy()})

    @app.get("/api/backtest/pending", response_model=ApiResponse[dict[str, Any]])
    async def get_pending_evaluations():
        """获取待评估的决策"""
        from backend.archive.backtester import get_backtester

        bt = get_backtester()
        return ApiResponse(success=True, data={"pending": bt.get_pending_evaluations()})

    # ============== 审计日志 API ==============

    @app.get("/api/audit", response_model=ApiResponse[dict[str, Any]])
    async def get_audit_logs(limit: int = 50):
        """获取审计日志"""
        from backend.storage.db import Database

        db = Database()
        conn = db.conn
        rows = conn.execute(
            "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return ApiResponse(
            success=True,
            data={
                "logs": [
                    {
                        "id": r[0],
                        "action": r[1],
                        "target_type": r[2],
                        "target_id": r[3],
                        "metadata": r[4],
                        "created_at": r[5],
                    }
                    for r in rows
                ]
            },
        )

else:
    app = None
