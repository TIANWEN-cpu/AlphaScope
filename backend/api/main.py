"""
FastAPI 主入口 (v0.24)

提供完整的 REST API 和 SSE 流式输出：
- /api/chat/stream — 对话流式输出 (SSE)
- /api/analysis/run — 运行 Agent 分析
- /api/vision/analyze — 图片/K线图分析
- /api/agents — Agent 配置管理
- /api/teams — 专家团管理
- /api/models/providers — 模型供应商管理
- /api/reports — 分析报告
- /api/conversations — 对话管理

使用方式：
    uvicorn backend.api.main:app --reload --port 8000
"""

import json
import asyncio
from typing import Optional, AsyncGenerator

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import StreamingResponse
    from pydantic import BaseModel

    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

if HAS_FASTAPI:
    app = FastAPI(
        title="AI-Finance API",
        description="金融 AI 分析工作台 API — 多 Agent 异构分析、专家团、K线图视觉分析",
        version="0.24.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ============== 请求/响应模型 ==============

    class ChatRequest(BaseModel):
        conversation_id: Optional[str] = None
        message: str
        mode: str = "free"
        stock_symbol: Optional[str] = None
        stock_name: Optional[str] = None
        expert_team_id: Optional[str] = None

    class AnalysisRequest(BaseModel):
        stock_symbol: str
        stock_name: str = ""
        mode: str = "deep"
        agent_configs: Optional[list] = None
        global_ai_settings: Optional[dict] = None

    class VisionRequest(BaseModel):
        image_base64: str
        mime_type: str = "image/png"
        user_context: str = ""
        vendor: str = "deepseek"
        model: str = "deepseek-chat"

    class ConversationCreate(BaseModel):
        title: str = "新对话"
        stock_symbol: Optional[str] = None
        stock_name: Optional[str] = None
        mode: str = "free"

    # ============== 健康检查 ==============

    @app.get("/")
    async def root():
        return {
            "status": "ok",
            "service": "AI-Finance API",
            "version": "0.24.0",
            "endpoints": [
                "/api/chat/stream",
                "/api/analysis/run",
                "/api/vision/analyze",
                "/api/agents",
                "/api/teams",
                "/api/models/providers",
                "/api/conversations",
                "/api/reports/{id}",
            ],
        }

    @app.get("/health")
    async def health():
        return {"status": "healthy"}

    # ============== 对话 API ==============

    @app.post("/api/conversations")
    async def create_conversation(req: ConversationCreate):
        """创建新对话"""
        try:
            from backend.ai_assistant.conversation_store import ConversationStore
            from backend.storage.db import Database

            store = ConversationStore(db=Database())
            conv_id = store.create_conversation(
                title=req.title,
                stock_symbol=req.stock_symbol or "",
                stock_name=req.stock_name or "",
                mode=req.mode,
            )
            return {"conversation_id": conv_id, "status": "created"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/api/conversations")
    async def list_conversations(stock_symbol: Optional[str] = None, limit: int = 20):
        """列出对话"""
        try:
            from backend.ai_assistant.conversation_store import ConversationStore
            from backend.storage.db import Database

            store = ConversationStore(db=Database())
            convs = store.list_conversations(stock_symbol=stock_symbol, limit=limit)
            return {"conversations": convs}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/api/conversations/{conversation_id}")
    async def get_conversation(conversation_id: str):
        """获取对话详情"""
        try:
            from backend.ai_assistant.conversation_store import ConversationStore
            from backend.storage.db import Database

            store = ConversationStore(db=Database())
            conv = store.get_conversation(conversation_id)
            if not conv:
                raise HTTPException(status_code=404, detail="对话不存在")
            messages = store.get_messages(conversation_id)
            return {"conversation": conv, "messages": messages}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.delete("/api/conversations/{conversation_id}")
    async def delete_conversation(conversation_id: str):
        """删除对话"""
        try:
            from backend.ai_assistant.conversation_store import ConversationStore
            from backend.storage.db import Database

            store = ConversationStore(db=Database())
            store.delete_conversation(conversation_id)
            return {"status": "deleted"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ============== 对话流式 API (SSE) ==============

    async def _sse_generator(result: dict) -> AsyncGenerator[str, None]:
        """将分析结果转为 SSE 事件流"""
        # 发送状态事件
        yield f"data: {json.dumps({'type': 'status', 'mode': result.get('mode', 'free')})}\n\n"

        # 发送内容
        content = result.get("content", "")
        # 模拟流式输出（逐块发送）
        chunk_size = 20
        for i in range(0, len(content), chunk_size):
            chunk = content[i : i + chunk_size]
            yield f"data: {json.dumps({'type': 'content', 'chunk': chunk})}\n\n"
            await asyncio.sleep(0.02)  # 模拟延迟

        # 发送证据链
        evidence = result.get("evidence", [])
        if evidence:
            yield f"data: {json.dumps({'type': 'evidence', 'data': evidence})}\n\n"

        # 发送 Agent 投票
        agents = result.get("agents", {})
        if agents:
            yield f"data: {json.dumps({'type': 'agents', 'data': agents})}\n\n"

        # 发送完成事件
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    @app.post("/api/chat/stream")
    async def chat_stream(req: ChatRequest):
        """对话流式输出 (SSE)"""
        try:
            from backend.ai_assistant.orchestrator import ChatOrchestrator

            orch = ChatOrchestrator()

            # 创建或获取对话
            conv_id = req.conversation_id
            if not conv_id:
                conv_id = orch.new_conversation(
                    stock_symbol=req.stock_symbol or "",
                    stock_name=req.stock_name or "",
                    mode=req.mode,
                )

            # 构建 stock_data（如果有）
            stock_data = None
            if req.stock_symbol:
                stock_data = {
                    "symbol": req.stock_symbol,
                    "name": req.stock_name or "",
                }

            # 运行分析
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
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ============== 分析 API ==============

    @app.post("/api/analysis/run")
    async def run_analysis(req: AnalysisRequest):
        """运行 Agent 分析"""
        try:
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

            return {
                "status": "ok",
                "mode": result.get("mode"),
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
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ============== 视觉分析 API ==============

    @app.post("/api/vision/analyze")
    async def analyze_vision(req: VisionRequest):
        """图片/K线图分析"""
        try:
            from backend.vision.vision_agent import analyze_image

            result = analyze_image(
                image_base64=req.image_base64,
                mime_type=req.mime_type,
                user_context=req.user_context,
                vendor=req.vendor,
                model=req.model,
            )

            return {
                "status": "ok" if result.ok else "failed",
                "summary": result.summary,
                "needs_more_info": result.needs_more_info,
                "missing_info": result.missing_info,
                "disclaimer": result.disclaimer,
                "detection": {
                    "is_chart": result.detection.is_chart
                    if result.detection
                    else False,
                    "chart_type": result.detection.chart_type
                    if result.detection
                    else "",
                    "ticker": result.detection.ticker if result.detection else "",
                    "ticker_name": result.detection.ticker_name
                    if result.detection
                    else "",
                    "period": result.detection.period if result.detection else "",
                }
                if result.detection
                else None,
                "kline_analysis": {
                    "trend": result.kline_analysis.trend
                    if result.kline_analysis
                    else "",
                    "support_levels": result.kline_analysis.support_levels
                    if result.kline_analysis
                    else [],
                    "resistance_levels": result.kline_analysis.resistance_levels
                    if result.kline_analysis
                    else [],
                    "patterns": result.kline_analysis.patterns
                    if result.kline_analysis
                    else [],
                    "summary": result.kline_analysis.summary
                    if result.kline_analysis
                    else "",
                }
                if result.kline_analysis
                else None,
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ============== Agent 配置 API ==============

    @app.get("/api/agents")
    async def list_agents():
        """列出所有 Agent 配置"""
        from backend.agents.base import get_default_agent_configs

        return {"agents": get_default_agent_configs()}

    @app.get("/api/agents/models")
    async def list_agent_models():
        """列出 Agent 模型分配表"""
        from backend.agents.financial_agents import get_agent_model_table

        table = get_agent_model_table()
        return {
            "agents": [
                {"key": k, "name": n, "vendor": v, "model": m} for k, n, v, m in table
            ]
        }

    # ============== 专家团 API ==============

    @app.get("/api/teams")
    async def list_teams():
        """列出所有专家团"""
        from backend.teams.team_loader import list_team_names

        return {"teams": list_team_names()}

    @app.get("/api/teams/{team_id}")
    async def get_team(team_id: str):
        """获取专家团详情"""
        from backend.teams.team_loader import get_team

        team = get_team(team_id)
        if not team:
            raise HTTPException(status_code=404, detail="专家团不存在")
        return {
            "id": team.id,
            "name": team.name,
            "description": team.description,
            "members": [
                {
                    "id": m.id,
                    "name": m.name,
                    "role": m.role,
                    "provider": m.provider,
                    "model": m.model,
                }
                for m in team.members
            ],
        }

    # ============== 模型供应商 API ==============

    @app.get("/api/models/providers")
    async def list_providers():
        """列出所有模型供应商"""
        from backend.models.provider_gateway import get_provider_list

        return {"providers": get_provider_list()}

    @app.get("/api/models/providers/{provider_id}/models")
    async def list_provider_models(provider_id: str):
        """列出指定供应商的模型"""
        from backend.models.provider_gateway import get_provider_models

        models = get_provider_models(provider_id)
        return {"models": models}

    # ============== 报告 API ==============

    @app.get("/api/reports/{report_id}")
    async def get_report(report_id: str):
        """获取分析报告"""
        try:
            from backend.ai_assistant.report_generator import generate_report
            from backend.ai_assistant.conversation_store import ConversationStore
            from backend.storage.db import Database

            store = ConversationStore(db=Database())
            conv = store.get_conversation(report_id)
            if not conv:
                raise HTTPException(status_code=404, detail="报告不存在")
            messages = store.get_messages(report_id)
            md = generate_report(conv, messages)
            return {"report_id": report_id, "markdown": md}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ============== 分析模式 API ==============

    @app.get("/api/modes")
    async def list_modes():
        """列出所有分析模式"""
        from backend.agent_modes import get_mode_choices

        return {"modes": get_mode_choices()}

    # ============== 文件上传 API ==============

    @app.post("/api/files/upload")
    async def upload_file(file: bytes, filename: str = "upload.png"):
        """上传文件（图片/文档）"""
        import base64
        import hashlib
        from pathlib import Path

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

        if len(file) > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="文件大小超过 20MB 限制")

        file_hash = hashlib.md5(file).hexdigest()
        b64 = base64.b64encode(file).decode("utf-8")

        # 保存到 uploads 目录
        upload_dir = Path("uploads")
        upload_dir.mkdir(exist_ok=True)
        save_path = upload_dir / f"{file_hash}_{filename}"
        save_path.write_bytes(file)

        return {
            "file_id": file_hash,
            "filename": filename,
            "size": len(file),
            "suffix": suffix,
            "path": str(save_path),
            "base64_preview": b64[:100] + "..." if len(b64) > 100 else b64,
        }

    # ============== 研究任务模板 API ==============

    @app.get("/api/templates")
    async def list_templates():
        """列出研究任务模板"""
        from backend.runtime.task_templates import list_templates

        return {"templates": list_templates()}

    @app.get("/api/templates/{template_id}")
    async def get_template(template_id: str):
        """获取模板详情"""
        from backend.runtime.task_templates import get_template

        t = get_template(template_id)
        if not t:
            raise HTTPException(status_code=404, detail="模板不存在")
        return {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "icon": t.icon,
            "mode": t.mode,
            "requires_stock": t.requires_stock,
            "system_prompt": t.system_prompt,
            "output_format": t.output_format,
            "steps": t.steps,
        }

    # ============== Web 搜索 API ==============

    @app.get("/api/search")
    async def web_search(query: str, max_results: int = 5):
        """联网搜索"""
        from backend.providers.web_search_provider import get_web_search_provider

        provider = get_web_search_provider()
        if not provider.is_available():
            raise HTTPException(
                status_code=503, detail="搜索服务未配置 (需要 TAVILY_API_KEY)"
            )

        results = provider.search(query, max_results)
        return {
            "results": [
                {"title": r.title, "url": r.url, "snippet": r.snippet, "score": r.score}
                for r in results
            ]
        }

    # ============== 成本统计 API ==============

    @app.get("/api/costs")
    async def get_costs(mode: Optional[str] = None):
        """获取 LLM 调用成本统计"""
        from backend.observability.cost_tracker import get_cost_tracker

        tracker = get_cost_tracker()
        return tracker.get_summary(mode=mode)

    # ============== 审计日志 API ==============

    # ============== 回测 API ==============

    @app.get("/api/backtest/stats")
    async def get_backtest_stats(mode: Optional[str] = None):
        """获取后验验证统计"""
        from backend.archive.backtester import get_backtester

        bt = get_backtester()
        return bt.get_performance_stats(mode=mode)

    @app.get("/api/backtest/agent-accuracy")
    async def get_agent_accuracy():
        """按 Agent 统计准确率"""
        from backend.archive.backtester import get_backtester

        bt = get_backtester()
        return {"agents": bt.get_agent_accuracy()}

    @app.get("/api/backtest/pending")
    async def get_pending_evaluations():
        """获取待评估的决策"""
        from backend.archive.backtester import get_backtester

        bt = get_backtester()
        return {"pending": bt.get_pending_evaluations()}

    # ============== 审计日志 API ==============

    @app.get("/api/audit")
    async def get_audit_logs(limit: int = 50):
        """获取审计日志"""
        try:
            from backend.storage.db import Database

            db = Database()
            conn = db.get_connection()
            rows = conn.execute(
                "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return {
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
            }
        except Exception:
            return {"logs": []}

else:
    app = None
