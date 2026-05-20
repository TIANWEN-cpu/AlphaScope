"""
Key Vault: API Key 加密存储与管理。

职责：
- API Key 加密/解密（开发环境用 base64，生产环境应用 KMS/libsodium）
- Key 轮换支持
- 脱敏显示

Phase 2-3 完善，当前为基础实现。
"""

import base64
import hashlib
import os


def _get_encryption_key() -> bytes:
    """获取加密密钥（从环境变量或生成临时密钥）"""
    key = os.getenv("AI_FINANCE_MASTER_KEY", "")
    if key:
        return hashlib.sha256(key.encode()).digest()
    # 开发环境：使用固定密钥（不安全，仅用于开发）
    return hashlib.sha256(b"dev-only-not-for-production").digest()


def encrypt_key(plain_key: str) -> str:
    """
    加密 API Key。

    当前使用简单 XOR + base64（开发阶段）。
    生产环境应替换为 AES-GCM 或 KMS。
    """
    if not plain_key:
        return ""
    key = _get_encryption_key()
    data = plain_key.encode("utf-8")
    # XOR 加密（简单实现，生产环境需替换）
    encrypted = bytes(d ^ key[i % len(key)] for i, d in enumerate(data))
    return base64.urlsafe_b64encode(encrypted).decode("ascii")


def decrypt_key(encrypted_key: str) -> str:
    """
    解密 API Key。

    当前使用简单 XOR + base64（开发阶段）。
    """
    if not encrypted_key:
        return ""
    key = _get_encryption_key()
    try:
        data = base64.urlsafe_b64decode(encrypted_key.encode("ascii"))
        decrypted = bytes(d ^ key[i % len(key)] for i, d in enumerate(data))
        return decrypted.decode("utf-8")
    except Exception:
        return ""


def mask_key(key: str) -> str:
    """脱敏显示 API Key，只显示前4位和后4位"""
    if not key or len(key) < 12:
        return "****"
    return f"{key[:4]}...{key[-4:]}"


def validate_key_format(key: str, provider: str = "") -> bool:
    """验证 API Key 格式是否合理"""
    if not key or len(key) < 8:
        return False
    # 基本格式检查
    if provider == "deepseek" and not key.startswith("sk-"):
        return False
    if provider == "openai" and not key.startswith("sk-"):
        return False
    return True
