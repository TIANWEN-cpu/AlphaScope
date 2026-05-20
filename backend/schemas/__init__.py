"""标准化数据模型 - AI-Finance v0.40"""

from .announcement import Announcement
from .evidence import AgentReport, EvidenceBundle, EvidenceItem
from .market import FundFlow, PriceBar
from .news import NewsItem
from .report import ResearchReport

# Agent/专家团配置模型
from .agents import (
    AgentConfig,
    AgentOutput,
    AnalysisSummary,
    ExpertMemberConfig,
    ExpertOutput,
    FallbackConfig,
    ModelConfig,
    TeamConfig,
    ToolPermission,
    WorkflowMode,
)

# API 请求/响应模型
from .api import (
    AgentData,
    AnalysisRequest,
    AnalysisResultData,
    ApiResponse,
    AuditLogData,
    BacktestStatsData,
    ChatRequest,
    ChatResultData,
    ConversationCreate,
    ConversationData,
    CostData,
    FileUploadData,
    HealthData,
    MessageData,
    ModeData,
    ModelProviderData,
    PaginatedData,
    ReportData,
    SearchData,
    TeamData,
    TemplateData,
    VisionRequest,
    VisionResultData,
)

__all__ = [
    # 数据模型
    "NewsItem",
    "ResearchReport",
    "Announcement",
    "PriceBar",
    "FundFlow",
    "EvidenceItem",
    "EvidenceBundle",
    "AgentReport",
    # Agent/专家团模型
    "AgentConfig",
    "AgentOutput",
    "AnalysisSummary",
    "ExpertMemberConfig",
    "ExpertOutput",
    "FallbackConfig",
    "ModelConfig",
    "TeamConfig",
    "ToolPermission",
    "WorkflowMode",
    # API 模型
    "ApiResponse",
    "PaginatedData",
    "ChatRequest",
    "AnalysisRequest",
    "VisionRequest",
    "ConversationCreate",
    "HealthData",
    "ConversationData",
    "MessageData",
    "ChatResultData",
    "AnalysisResultData",
    "VisionResultData",
    "AgentData",
    "TeamData",
    "ModelProviderData",
    "ReportData",
    "TemplateData",
    "CostData",
    "BacktestStatsData",
    "ModeData",
    "AuditLogData",
    "SearchData",
    "FileUploadData",
]
