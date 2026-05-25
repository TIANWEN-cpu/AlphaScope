"""股票身份解析：把用户输入统一成代码、名称和交易所。"""

from __future__ import annotations

import logging
import re
from functools import lru_cache
from typing import Any

from backend.price_store import get_market, normalize_symbol

logger = logging.getLogger(__name__)

FALLBACK_STOCKS: dict[str, dict[str, str]] = {
    "600519": {"name": "贵州茅台", "exchange": "SH", "market": "CN"},
    "600036": {"name": "招商银行", "exchange": "SH", "market": "CN"},
    "300750": {"name": "宁德时代", "exchange": "SZ", "market": "CN"},
    "600837": {"name": "海通证券", "exchange": "SH", "market": "CN"},
    "301666": {"name": "大普微-UW", "exchange": "SZ", "market": "CN"},
    "00700": {"name": "腾讯控股", "exchange": "HK", "market": "HK"},
}


def infer_exchange(symbol: str) -> str:
    """根据代码推断交易所缩写。"""
    code = normalize_symbol(symbol)
    if not code:
        return ""
    if len(code) == 5:
        return "HK"
    if code.startswith(("60", "68", "90")):
        return "SH"
    if code.startswith(("00", "30", "20")):
        return "SZ"
    if code.startswith(("4", "8")):
        return "BJ"
    return get_market(code)


def _clean_query(query: str) -> str:
    return (query or "").strip().upper().replace(" ", "")


def _coerce_a_share_code(value: Any) -> str:
    raw = str(value or "").strip()
    if raw.endswith(".0"):
        raw = raw[:-2]
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""
    if len(digits) <= 6:
        return digits.zfill(6)
    return digits[:6]


def _clean_name(value: Any) -> str:
    name = str(value or "").strip()
    if name.lower() in {"nan", "none", "null"}:
        return ""
    return name


def _fetch_a_share_code_name():
    import akshare as ak

    return ak.stock_info_a_code_name()


def _find_column(columns: list[Any], candidates: tuple[str, ...]) -> Any | None:
    normalized = {str(col).strip().lower(): col for col in columns}
    for candidate in candidates:
        key = candidate.strip().lower()
        if key in normalized:
            return normalized[key]
    for col in columns:
        text = str(col).strip().lower()
        if any(candidate.strip().lower() in text for candidate in candidates):
            return col
    return None


@lru_cache(maxsize=1)
def _a_share_name_map() -> dict[str, str]:
    """读取 AkShare A 股代码名称表，并缓存到进程内。"""
    try:
        df = _fetch_a_share_code_name()
    except Exception as exc:
        logger.warning("stock_info_a_code_name failed: %s", exc)
        return {}

    if df is None or len(df) == 0:
        return {}

    code_col = _find_column(list(df.columns), ("code", "代码", "股票代码"))
    name_col = _find_column(list(df.columns), ("name", "名称", "股票名称", "股票简称"))
    if code_col is None or name_col is None:
        logger.warning(
            "unexpected stock_info_a_code_name columns: %s", list(df.columns)
        )
        return {}

    out: dict[str, str] = {}
    for _, row in df.iterrows():
        code = _coerce_a_share_code(row.get(code_col))
        name = _clean_name(row.get(name_col))
        if code and name:
            out[code] = name
    return out


def clear_stock_name_cache() -> None:
    """测试和手动刷新时清空进程内股票名称缓存。"""
    _a_share_name_map.cache_clear()


def _fallback_result(symbol: str, query: str) -> dict[str, Any]:
    code = normalize_symbol(symbol)
    fallback = FALLBACK_STOCKS.get(code, {})
    return {
        "query": query,
        "symbol": code,
        "name": fallback.get("name") or (f"股票代码 {code}" if code else query.strip()),
        "market": fallback.get("market") or get_market(code),
        "exchange": fallback.get("exchange") or infer_exchange(code),
        "resolved": bool(fallback),
        "source": "fallback_alias" if fallback else "fallback_symbol",
    }


def resolve_stock(query: str) -> dict[str, Any]:
    """解析股票代码或名称，优先返回真实公司名称。"""
    raw_query = query or ""
    cleaned = _clean_query(raw_query)
    code = normalize_symbol(cleaned)

    if code:
        if code in FALLBACK_STOCKS:
            result = _fallback_result(code, raw_query)
            result["source"] = "fallback_alias"
        else:
            result = _fallback_result(code, raw_query)

        if get_market(code) == "CN":
            name = _a_share_name_map().get(code)
            if name:
                result.update(
                    {
                        "name": name,
                        "market": "CN",
                        "exchange": infer_exchange(code),
                        "resolved": True,
                        "source": "akshare_stock_info_a_code_name",
                    }
                )
        return result

    for symbol, item in FALLBACK_STOCKS.items():
        name = item["name"]
        if cleaned and (cleaned in name.upper() or name.upper() in cleaned):
            return {
                "query": raw_query,
                "symbol": symbol,
                "name": name,
                "market": item.get("market") or get_market(symbol),
                "exchange": item.get("exchange") or infer_exchange(symbol),
                "resolved": True,
                "source": "fallback_alias",
            }

    for symbol, name in _a_share_name_map().items():
        if cleaned and (cleaned in name.upper() or name.upper() in cleaned):
            return {
                "query": raw_query,
                "symbol": symbol,
                "name": name,
                "market": "CN",
                "exchange": infer_exchange(symbol),
                "resolved": True,
                "source": "akshare_stock_info_a_code_name",
            }

    return {
        "query": raw_query,
        "symbol": "",
        "name": raw_query.strip(),
        "market": "",
        "exchange": "",
        "resolved": False,
        "source": "unresolved",
    }
