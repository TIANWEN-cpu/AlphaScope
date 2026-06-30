"""外部服务集成层 / Integration Hub (Phase 1).

所有外部开源项目 (OpenBB / AkShare / AData / Qlib / vectorBT / Backtrader /
TradingAgents / ai-hedge-fund / ...) 都通过本层接入 AlphaScope。

约定:
- adapter 子类放 backend/integrations/{data,factor,backtest,agent}/<name>_adapter.py
- 文件名必须以 ``_adapter.py`` 结尾才会被自动发现
- 每个 adapter 必须遵守交易边界 (Phase 0): allow_live_order=False, 不暴露实盘下单能力

入口:
- get_registry() : 单例注册表
- register       : 装饰器
- autodiscover   : 扫描子包
"""

from backend.integrations.base import (
    AgentTeamAdapter,
    BacktestEngineAdapter,
    BaseAdapter,
    DataAdapter,
    FactorAdapter,
)
from backend.integrations.registry import (
    IntegrationRegistry,
    assert_boundary_invariant,
    autodiscover,
    get_registry,
    register,
    reset_registry,
)
from backend.integrations.schemas import (
    BacktestAssumptions,
    BacktestMetrics,
    CapabilitySpec,
    HealthStatus,
    IntegrationCategory,
    IntegrationHealth,
    IntegrationMetadata,
    IntegrationMode,
    LicenseSafety,
    NormalizedAgentOpinion,
    NormalizedBacktestResult,
)

__all__ = [
    # base
    "BaseAdapter",
    "DataAdapter",
    "FactorAdapter",
    "BacktestEngineAdapter",
    "AgentTeamAdapter",
    # registry
    "IntegrationRegistry",
    "get_registry",
    "register",
    "autodiscover",
    "reset_registry",
    "assert_boundary_invariant",
    # schemas
    "IntegrationCategory",
    "IntegrationMode",
    "HealthStatus",
    "LicenseSafety",
    "CapabilitySpec",
    "IntegrationMetadata",
    "IntegrationHealth",
    "BacktestAssumptions",
    "BacktestMetrics",
    "NormalizedBacktestResult",
    "NormalizedAgentOpinion",
]
