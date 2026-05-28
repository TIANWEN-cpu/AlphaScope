"""设置存储层 — 管理 model_providers 与应用偏好设置。"""

from __future__ import annotations

import copy
import json
import logging
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)

from backend.security.key_vault import decrypt_key, encrypt_key, mask_key
from backend.storage.db import Database

_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS model_providers (
    id TEXT PRIMARY KEY,
    workspace_id TEXT DEFAULT 'default',
    name TEXT NOT NULL,
    type TEXT DEFAULT 'openai_compatible',
    base_url TEXT,
    encrypted_api_key TEXT,
    enabled INTEGER DEFAULT 1,
    config_json TEXT DEFAULT '{}',
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
)
"""

_PREFERENCES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS app_preferences (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at REAL NOT NULL
)
"""

DEFAULT_APP_PREFERENCES: dict[str, dict[str, Any]] = {
    "general": {
        "language": "zh-CN",
        "theme": "dark",
        "default_symbol": "600519",
        "auto_refresh": True,
        "refresh_interval": 60,
    },
    "network": {
        "api_base_url": "http://127.0.0.1:8000",
        "request_timeout_ms": 12000,
        "retry_count": 1,
        "proxy_url": "",
    },
    "security": {
        "mask_api_keys": True,
        "confirm_deletes": True,
        "allow_external_links": True,
        "audit_log": True,
    },
    "data": {
        "news_limit": 30,
        "price_cache_days": 180,
        "prefer_local_cache": True,
        "auto_fetch_missing": True,
    },
}

_INT_LIMITS: dict[tuple[str, str], tuple[int, int]] = {
    ("general", "refresh_interval"): (10, 3600),
    ("network", "request_timeout_ms"): (3000, 120000),
    ("network", "retry_count"): (0, 5),
    ("data", "news_limit"): (5, 100),
    ("data", "price_cache_days"): (30, 3650),
}

_MODEL_PREFERENCE_HINTS = (
    "deepseek",
    "sensenova",
    "flash",
    "chat",
    "gpt",
    "moonshot",
)


_MOJIBAKE_MARKERS = ("\ufffd", "\u951f", "\u8119", "\u8117")


def _contains_cjk(value: str) -> bool:
    return any("\u4e00" <= ch <= "\u9fff" for ch in value)


def _has_latin1_run(value: str) -> bool:
    run = 0
    for ch in value:
        if "\u00c0" <= ch <= "\u00ff":
            run += 1
            if run >= 2:
                return True
        else:
            run = 0
    return False


def _looks_mojibake(value: str) -> bool:
    if not value:
        return False
    if any(marker in value for marker in _MOJIBAKE_MARKERS):
        return True
    if any("\u0080" <= ch <= "\u009f" for ch in value):
        return True
    return _has_latin1_run(value)


def _repair_mojibake_name(value: str) -> str:
    try:
        raw = value.encode("latin1")
    except UnicodeEncodeError:
        return ""
    for encoding in ("utf-8", "gbk"):
        try:
            decoded = raw.decode(encoding).strip()
        except UnicodeDecodeError:
            continue
        if decoded and _contains_cjk(decoded):
            return decoded
    return ""


def _infer_provider_name(provider_id: str, base_url: str) -> str:
    haystack = f"{provider_id} {base_url}".lower()
    for token, label in (
        ("deepseek", "DeepSeek"),
        ("sensenova", "SenseNova"),
        ("sensecore", "SenseNova"),
        ("sense", "SenseNova"),
        ("moonshot", "Kimi"),
        ("kimi", "Kimi"),
        ("openai", "OpenAI"),
        ("gpt", "OpenAI"),
        ("anthropic", "Claude"),
        ("claude", "Claude"),
        ("mimo", "Mimo"),
    ):
        if token in haystack:
            return label
    return provider_id.strip()


def _clean_provider_name(provider_id: str, name: str, base_url: str) -> str:
    raw_name = str(name or "").strip()
    if raw_name and not _looks_mojibake(raw_name):
        return raw_name
    repaired = _repair_mojibake_name(raw_name) if raw_name else ""
    if repaired:
        return repaired
    inferred = _infer_provider_name(str(provider_id or ""), str(base_url or ""))
    return inferred or raw_name or "Unnamed Provider"


def _preferred_model_id(model_ids: list[str]) -> str:
    """Pick a likely chat model from a provider model listing."""
    for hint in _MODEL_PREFERENCE_HINTS:
        for model_id in model_ids:
            if hint in model_id.lower():
                return model_id
    return model_ids[0] if model_ids else ""


def _ensure_table(conn) -> None:
    conn.execute(_TABLE_SQL)
    conn.execute(_PREFERENCES_TABLE_SQL)
    conn.commit()


def _get_conn():
    db = Database()
    _ensure_table(db._conn)
    return db._conn


def _default_preferences() -> dict[str, dict[str, Any]]:
    return copy.deepcopy(DEFAULT_APP_PREFERENCES)


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on", "enabled"}
    return bool(value)


def _coerce_int(section: str, key: str, value: Any, default: int) -> int:
    try:
        coerced = int(value)
    except (TypeError, ValueError):
        coerced = default
    low, high = _INT_LIMITS.get((section, key), (0, 10_000_000))
    return max(low, min(high, coerced))


def _coerce_preference_value(section: str, key: str, value: Any) -> Any:
    default = DEFAULT_APP_PREFERENCES[section][key]
    if isinstance(default, bool):
        return _coerce_bool(value)
    if isinstance(default, int):
        return _coerce_int(section, key, value, default)
    text = str(value if value is not None else default).strip()
    if section == "general" and key == "language":
        return text if text in {"zh-CN", "en-US"} else default
    if section == "general" and key == "theme":
        return text if text in {"dark", "light", "system"} else default
    return text


def _normalize_preferences(raw: dict[str, Any]) -> dict[str, dict[str, Any]]:
    normalized = _default_preferences()
    for section, values in (raw or {}).items():
        if section not in normalized or not isinstance(values, dict):
            continue
        for key, value in values.items():
            if key in normalized[section]:
                normalized[section][key] = _coerce_preference_value(
                    section, key, value
                )
    return normalized


def get_app_preferences() -> dict[str, dict[str, Any]]:
    """读取应用偏好设置，并补齐新增默认项。"""
    conn = _get_conn()
    rows = conn.execute("SELECT key, value_json FROM app_preferences").fetchall()
    raw = _default_preferences()
    for row in rows:
        section = row["key"]
        if section not in raw:
            continue
        try:
            values = json.loads(row["value_json"] or "{}")
        except json.JSONDecodeError:
            logger.warning("应用偏好设置 %s JSON 解析失败，使用默认值", section)
            continue
        if isinstance(values, dict):
            raw[section].update(values)
    return _normalize_preferences(raw)


def save_app_preferences(
    preferences: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    """合并保存应用偏好设置，只接受已声明的 section/key。"""
    conn = _get_conn()
    current = get_app_preferences()
    for section, values in (preferences or {}).items():
        if section in current and isinstance(values, dict):
            current[section].update(values)
    normalized = _normalize_preferences(current)
    now = time.time()
    for section, values in normalized.items():
        conn.execute(
            "INSERT OR REPLACE INTO app_preferences (key, value_json, updated_at) VALUES (?, ?, ?)",
            (section, json.dumps(values, ensure_ascii=False), now),
        )
    conn.commit()
    return normalized


def list_providers() -> list[dict[str, Any]]:
    """列出所有 DB 中的 provider"""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, name, type, base_url, encrypted_api_key, enabled, config_json, created_at, updated_at "
        "FROM model_providers ORDER BY name"
    ).fetchall()
    result = []
    for row in rows:
        result.append(
            {
                "id": row["id"],
                "name": _clean_provider_name(
                    row["id"], row["name"], row["base_url"] or ""
                ),
                "type": row["type"],
                "base_url": row["base_url"] or "",
                "api_key_masked": mask_key(decrypt_key(row["encrypted_api_key"] or "")),
                "enabled": bool(row["enabled"]),
                "config_json": row["config_json"] or "{}",
            }
        )
    return result


def get_provider(provider_id: str) -> Optional[dict[str, Any]]:
    """获取单个 provider（含解密的 api_key）"""
    conn = _get_conn()
    row = conn.execute(
        "SELECT id, name, type, base_url, encrypted_api_key, enabled, config_json FROM model_providers WHERE id = ?",
        (provider_id,),
    ).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "name": _clean_provider_name(row["id"], row["name"], row["base_url"] or ""),
        "type": row["type"],
        "base_url": row["base_url"] or "",
        "api_key": decrypt_key(row["encrypted_api_key"] or ""),
        "api_key_masked": mask_key(decrypt_key(row["encrypted_api_key"] or "")),
        "enabled": bool(row["enabled"]),
        "config_json": row["config_json"] or "{}",
    }


def save_provider(
    provider_id: str,
    name: str,
    base_url: str,
    api_key: str = "",
    enabled: bool = True,
    config_json: Optional[str] = None,
) -> dict[str, Any]:
    """添加或更新 provider"""
    conn = _get_conn()
    now = time.time()
    display_name = _clean_provider_name(provider_id, name, base_url)
    existing = conn.execute(
        "SELECT id, config_json FROM model_providers WHERE id = ?", (provider_id,)
    ).fetchone()
    next_config_json = config_json
    if next_config_json is None:
        next_config_json = (existing["config_json"] if existing else None) or "{}"
    if existing:
        if api_key:
            conn.execute(
                "UPDATE model_providers SET name=?, base_url=?, encrypted_api_key=?, enabled=?, config_json=?, updated_at=? WHERE id=?",
                (
                    display_name,
                    base_url,
                    encrypt_key(api_key),
                    int(enabled),
                    next_config_json,
                    now,
                    provider_id,
                ),
            )
        else:
            conn.execute(
                "UPDATE model_providers SET name=?, base_url=?, enabled=?, config_json=?, updated_at=? WHERE id=?",
                (
                    display_name,
                    base_url,
                    int(enabled),
                    next_config_json,
                    now,
                    provider_id,
                ),
            )
    else:
        encrypted = encrypt_key(api_key) if api_key else ""
        conn.execute(
            "INSERT INTO model_providers (id, name, type, base_url, encrypted_api_key, enabled, config_json, created_at, updated_at) "
            "VALUES (?, ?, 'openai_compatible', ?, ?, ?, ?, ?, ?)",
            (
                provider_id,
                display_name,
                base_url,
                encrypted,
                int(enabled),
                next_config_json,
                now,
                now,
            ),
        )
    conn.commit()
    _sync_to_gateway()
    return get_provider(provider_id)


def delete_provider(provider_id: str) -> bool:
    """删除 provider"""
    conn = _get_conn()
    existing = conn.execute(
        "SELECT id FROM model_providers WHERE id = ?", (provider_id,)
    ).fetchone()
    if not existing:
        return False
    conn.execute("DELETE FROM model_providers WHERE id = ?", (provider_id,))
    conn.commit()
    _sync_to_gateway()
    return True


def test_connection(provider_id: str) -> dict[str, Any]:
    """测试 provider 连接"""
    provider = get_provider(provider_id)
    if not provider:
        return {"success": False, "error": "Provider 不存在"}

    if not provider["api_key"]:
        return {"success": False, "error": "API Key 未配置"}
    if not provider["base_url"]:
        return {"success": False, "error": "Base URL 未配置"}

    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=provider["api_key"],
            base_url=provider["base_url"],
            timeout=15.0,
        )
        models = client.models.list()
        model_ids = [m.id for m in (models.data or [])][:10]
        if model_ids:
            try:
                existing = json.loads(provider.get("config_json") or "{}")
                if not isinstance(existing, dict):
                    existing = {}
            except Exception:
                existing = {}
            existing["models"] = model_ids
            existing["default_model"] = _preferred_model_id(model_ids)
            save_provider(
                provider_id=provider["id"],
                name=provider["name"],
                base_url=provider["base_url"],
                api_key="",
                enabled=provider.get("enabled", True),
                config_json=json.dumps(existing, ensure_ascii=False),
            )
        return {
            "success": True,
            "models": model_ids,
            "message": f"连接成功，发现 {len(model_ids)} 个模型",
        }
    except Exception as e:
        return {"success": False, "error": f"连接失败: {e}"}


def export_settings() -> dict[str, Any]:
    """导出设置（脱敏）"""
    providers = list_providers()
    return {
        "version": "1.0",
        "preferences": get_app_preferences(),
        "providers": [
            {
                "id": p["id"],
                "name": p["name"],
                "base_url": p["base_url"],
                "api_key_masked": p["api_key_masked"],
                "enabled": p["enabled"],
            }
            for p in providers
        ],
    }


def import_settings(data: dict[str, Any]) -> dict[str, Any]:
    """导入设置（不含 API Key，需用户手动填写）"""
    providers = data.get("providers", [])
    imported = 0
    for p in providers:
        pid = p.get("id")
        if not pid:
            continue
        save_provider(
            provider_id=pid,
            name=p.get("name", pid),
            base_url=p.get("base_url", ""),
            api_key="",  # 导入不含 key
            enabled=p.get("enabled", True),
        )
        imported += 1
    if isinstance(data.get("preferences"), dict):
        save_app_preferences(data["preferences"])
    return {
        "imported": imported,
        "message": f"导入 {imported} 个 provider（需手动填写 API Key）",
    }


def _sync_to_gateway() -> None:
    """将 DB 配置同步到 provider_gateway 的 VENDORS dict"""
    try:
        from backend.models.provider_gateway import (
            VENDORS,
            _models_from_config_json,
            clear_client_cache,
        )

        providers = list_providers()
        for p in providers:
            pid = p["id"]
            provider_full = get_provider(pid)
            if not provider_full:
                continue
            patch = {
                "base_url": p["base_url"],
                "supports_json_mode": True,
                "label": p["name"],
                "config_json": provider_full.get("config_json") or "{}",
                "models": _models_from_config_json(provider_full.get("config_json")),
            }
            if provider_full["api_key"]:
                patch["api_key"] = provider_full["api_key"]
            if pid in VENDORS:
                # 更新已有 vendor
                VENDORS[pid].update(patch)
            else:
                # 新增 vendor
                VENDORS[pid] = {
                    "api_key": provider_full["api_key"],
                    **patch,
                }
        clear_client_cache()
    except Exception as e:
        logger.warning("同步设置到 gateway 失败: %s", e)
