"""Security layer: key encryption, permissions, sandbox, compliance.

子模块:
- trading_boundary: 交易边界 (No-Live-Order), 见 config/legal_boundaries.yaml
"""

from backend.security.trading_boundary import (
    FORBIDDEN_SYMBOL_NAMES,
    BoundaryViolation,
    TradingBoundary,
    assert_no_live_order,
    describe_capabilities,
    get_boundary,
    scan_forbidden_symbols,
)

__all__ = [
    "FORBIDDEN_SYMBOL_NAMES",
    "BoundaryViolation",
    "TradingBoundary",
    "assert_no_live_order",
    "describe_capabilities",
    "get_boundary",
    "scan_forbidden_symbols",
]
