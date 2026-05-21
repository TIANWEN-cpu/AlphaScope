"""设置存储层 — 管理 model_providers 表的 CRUD 操作"""

from __future__ import annotations

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


def _ensure_table(conn) -> None:
    conn.execute(_TABLE_SQL)
    conn.commit()


def _get_conn():
    db = Database()
    _ensure_table(db._conn)
    return db._conn


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
                "name": row["name"],
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
        "name": row["name"],
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
    config_json: str = "{}",
) -> dict[str, Any]:
    """添加或更新 provider"""
    conn = _get_conn()
    now = time.time()
    encrypted = encrypt_key(api_key) if api_key else ""

    existing = conn.execute(
        "SELECT id FROM model_providers WHERE id = ?", (provider_id,)
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE model_providers SET name=?, base_url=?, encrypted_api_key=?, enabled=?, config_json=?, updated_at=? WHERE id=?",
            (name, base_url, encrypted, int(enabled), config_json, now, provider_id),
        )
    else:
        conn.execute(
            "INSERT INTO model_providers (id, name, type, base_url, encrypted_api_key, enabled, config_json, created_at, updated_at) "
            "VALUES (?, ?, 'openai_compatible', ?, ?, ?, ?, ?, ?)",
            (
                provider_id,
                name,
                base_url,
                encrypted,
                int(enabled),
                config_json,
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
    return {
        "imported": imported,
        "message": f"导入 {imported} 个 provider（需手动填写 API Key）",
    }


def _sync_to_gateway() -> None:
    """将 DB 配置同步到 provider_gateway 的 VENDORS dict"""
    try:
        from backend.models.provider_gateway import VENDORS, clear_client_cache

        providers = list_providers()
        for p in providers:
            pid = p["id"]
            if pid in VENDORS:
                # 更新已有 vendor
                if p["base_url"]:
                    VENDORS[pid]["base_url"] = p["base_url"]
                # api_key 需要解密后更新
                provider_full = get_provider(pid)
                if provider_full and provider_full["api_key"]:
                    VENDORS[pid]["api_key"] = provider_full["api_key"]
            else:
                # 新增 vendor
                provider_full = get_provider(pid)
                VENDORS[pid] = {
                    "api_key": provider_full["api_key"] if provider_full else "",
                    "base_url": p["base_url"],
                    "supports_json_mode": True,
                    "label": p["name"],
                }
        clear_client_cache()
    except Exception as e:
        logger.warning("同步设置到 gateway 失败: %s", e)
