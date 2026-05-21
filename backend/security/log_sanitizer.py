"""日志脱敏 — 清除日志中的敏感信息（API Key、密码、Token）"""

from __future__ import annotations

import re

# 脱敏正则模式
_PATTERNS = [
    # OpenAI/DeepSeek API Key
    (re.compile(r"sk-[a-zA-Z0-9]{20,}"), "sk-****"),
    # AWS Access Key
    (re.compile(r"AKIA[0-9A-Z]{16}"), "AKIA****"),
    # Bearer Token
    (re.compile(r"Bearer\s+[a-zA-Z0-9._\-]{20,}", re.IGNORECASE), "Bearer ****"),
    # Generic long hex tokens (32+ chars)
    (re.compile(r"\b[a-f0-9]{32,}\b"), "****"),
    # Password in URL (e.g., http://user:pass@host)
    (re.compile(r"://[^:]+:([^@]+)@"), "://****:****@"),
    # Common password/key patterns in text
    (
        re.compile(
            r"(password|passwd|secret|token|api_key|api_key)\s*[:=]\s*\S+",
            re.IGNORECASE,
        ),
        r"\1=****",
    ),
]

# 敏感字段名
_SENSITIVE_FIELDS = {
    "api_key",
    "apikey",
    "api_secret",
    "secret",
    "password",
    "passwd",
    "token",
    "access_token",
    "refresh_token",
    "encrypted_api_key",
    "master_key",
    "private_key",
    "auth",
    "authorization",
}


def sanitize_log_message(msg: str) -> str:
    """脱敏单条日志消息。"""
    if not msg:
        return msg
    result = msg
    for pattern, replacement in _PATTERNS:
        result = pattern.sub(replacement, result)
    return result


def sanitize_dict(data: dict) -> dict:
    """递归脱敏 dict 中的敏感字段。"""
    if not isinstance(data, dict):
        return data
    result = {}
    for k, v in data.items():
        if isinstance(v, dict):
            result[k] = sanitize_dict(v)
        elif isinstance(v, str) and k.lower() in _SENSITIVE_FIELDS:
            result[k] = _mask_value(v)
        elif isinstance(v, str):
            result[k] = sanitize_log_message(v)
        else:
            result[k] = v
    return result


def _mask_value(value: str) -> str:
    """脱敏单个值。"""
    if not value or len(value) < 8:
        return "****"
    return f"{value[:4]}...{value[-4:]}"
