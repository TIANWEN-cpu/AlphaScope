"""标准化数据模型 - 研策中枢 AlphaScope v0.40"""

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

# 数据源模型
from .data_source import DataSourceResult, DataSourceStatus, ProviderHealthStatus

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

# 量化模块
from .quant import (
    BacktestMetrics,
    BacktestRequest,
    BacktestResult,
    QuantEngineStatus,
    RunRecord,
    RunStatus,
    StrategyInfo,
    StrategyParam,
    StrategyStatus,
)

# 基金模块
from .funds import (
    DCAFrequency,
    DCAPlan,
    DCASimulationRequest,
    DCASimulationResult,
    FundInfo,
    FundMetrics,
    FundNav,
    FundType,
    Portfolio,
    PortfolioHolding,
    RebalanceRequest,
    RebalanceResult,
)

# 交易边界 / 研究决策 (Phase 0) — 不含任何实盘下单能力
from .manual_ticket import (
    ManualReviewTicket,
    TicketLine,
    TicketLineAction,
    TicketStatus,
)
from .paper_order import PaperOrder, PaperOrderStatus
from .research_decision import DecisionVerdict, ResearchDecision

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
    # 数据源模型
    "DataSourceResult",
    "DataSourceStatus",
    "ProviderHealthStatus",
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
    # 量化模块
    "BacktestMetrics",
    "BacktestRequest",
    "BacktestResult",
    "QuantEngineStatus",
    "RunRecord",
    "RunStatus",
    "StrategyInfo",
    "StrategyParam",
    "StrategyStatus",
    # 基金模块
    "DCAFrequency",
    "DCAPlan",
    "DCASimulationRequest",
    "DCASimulationResult",
    "FundInfo",
    "FundMetrics",
    "FundNav",
    "FundType",
    "Portfolio",
    "PortfolioHolding",
    "RebalanceRequest",
    "RebalanceResult",
    # 交易边界 / 研究决策 (Phase 0)
    "ManualReviewTicket",
    "TicketLine",
    "TicketLineAction",
    "TicketStatus",
    "PaperOrder",
    "PaperOrderStatus",
    "DecisionVerdict",
    "ResearchDecision",
]
