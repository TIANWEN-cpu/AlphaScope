"""
FastAPI 主入口（Phase 4 预备）。

当前为接口定义存根，提供路由框架。
Phase 4 实现时将填充完整逻辑。

使用方式：
    uvicorn backend.api.main:app --reload --port 8000
"""

from typing import Optional

try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

if HAS_FASTAPI:
    app = FastAPI(
        title="AI-Finance API",
        description="金融 AI 分析工作台 API",
        version="0.18.0",
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

    class VisionRequest(BaseModel):
        image_base64: str
        mime_type: str = "image/png"
        user_context: str = ""

    # ============== 路由 ==============

    @app.get("/")
    async def root():
        return {"status": "ok", "service": "AI-Finance API", "version": "0.18.0"}

    @app.get("/health")
    async def health():
        return {"status": "healthy"}

    @app.post("/api/chat/stream")
    async def chat_stream(req: ChatRequest):
        """对话流式输出（SSE）— Phase 4 实现"""
        return {"status": "not_implemented", "message": "Phase 4 待实现"}

    @app.post("/api/analysis/run")
    async def run_analysis(req: AnalysisRequest):
        """运行 Agent 分析 — Phase 4 实现"""
        return {"status": "not_implemented", "message": "Phase 4 待实现"}

    @app.post("/api/vision/analyze")
    async def analyze_vision(req: VisionRequest):
        """图片/K线图分析 — Phase 4 实现"""
        return {"status": "not_implemented", "message": "Phase 4 待实现"}

    @app.get("/api/agents")
    async def list_agents():
        """列出所有 Agent 配置"""
        from backend.agents.base import get_default_agent_configs

        return {"agents": get_default_agent_configs()}

    @app.get("/api/models/providers")
    async def list_providers():
        """列出所有模型供应商"""
        from backend.models.provider_gateway import get_provider_list

        return {"providers": get_provider_list()}

    @app.get("/api/teams")
    async def list_teams():
        """列出所有专家团"""
        from backend.teams.team_loader import list_team_names

        return {"teams": list_team_names()}

    @app.get("/api/reports/{report_id}")
    async def get_report(report_id: str):
        """获取分析报告 — Phase 4 实现"""
        return {"status": "not_implemented", "message": "Phase 4 待实现"}

else:
    app = None
