"""估值建模 API — DCF / Comps / LBO / 三表。

移植自 UZI-Skill (MIT) 的估值引擎，见 ``docs/uzi-integration/ATTRIBUTION.md``。
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

from backend.schemas.api import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/valuation", tags=["valuation"])


@router.get("/{symbol}")
async def get_valuation(symbol: str):
    """对个股运行机构级估值建模(DCF/Comps/LBO/三表)。"""
    from backend.valuation import value_symbol

    try:
        data = value_symbol(symbol)
        return ApiResponse(success=True, data=data)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("[valuation] %s 估值失败: %s", symbol, exc)
        return ApiResponse(
            success=False,
            data={"symbol": symbol},
            error=str(exc),
            error_code="VALUATION_FAILED",
        )
