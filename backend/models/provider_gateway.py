"""
Provider Gateway: 统一 OpenAI-compatible LLM 调用层。

职责：
- 从 providers.yaml 加载 Provider 配置
- 管理 VENDORS（向后兼容）
- 创建和缓存 OpenAI 客户端
- 提供统一的 LLM 调用接口 (_call_with / call_llm)
- Base URL 校验与规范化
- JSON 提取工具

从 llm_agents.py 拆分而来，保持完全向后兼容。
"""

import os
import json
import logging
import re
import threading
import ipaddress
from urllib.parse import urlsplit
from typing import Dict, Any, Optional, List
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
import yaml

try:
    from backend.project_paths import CONFIG_DIR, ENV_FILE
except ImportError:
    from project_paths import CONFIG_DIR, ENV_FILE

# 成本追踪（可选依赖，导入失败不影响核心功能）
try:
    from backend.observability.cost_tracker import get_cost_tracker
except ImportError:
    try:
        from observability.cost_tracker import get_cost_tracker
    except ImportError:
        get_cost_tracker = None  # type: ignore[assignment]

load_dotenv(ENV_FILE)

logger = logging.getLogger(__name__)

DEFAULT_PROVIDER_MODELS = {
    "deepseek": "deepseek-chat",
    "kimi": "moonshot-v1-32k",
    "claude": "claude-sonnet-4-5",
    "gpt": "gpt-5.2",
    "mimo": "mimo-v2.5-pro",
    "sensenova": "deepseek-v4-flash",
}


# ============== Provider 配置加载 ==============


def _resolve_env(value: str) -> str:
    """解析环境变量占位符 ${VAR_NAME}"""
    if not value or not isinstance(value, str):
        return value

    def replacer(m):
        var_name = m.group(1)
        return os.getenv(var_name, "")

    return re.sub(r"\$\{([^}]+)\}", replacer, value)


def normalize_openai_base_url(base_url: str) -> str:
    """Normalize OpenAI-compatible base URLs without corrupting explicit version paths."""
    cleaned = (base_url or "").strip().rstrip("/")
    if not cleaned:
        return ""
    if not cleaned.startswith(("http://", "https://")):
        cleaned = "https://" + cleaned
    path = urlsplit(cleaned).path.rstrip("/")
    if re.search(r"/v\d+(?:/)?$", path):
        return cleaned
    return cleaned + "/v1"


def _allow_local_base_url() -> bool:
    return os.getenv("ALLOW_LOCAL_LLM_BASE_URL", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def validate_custom_base_url(base_url: str) -> str:
    """Reject private/local custom endpoints unless explicitly enabled by environment."""
    normalized = normalize_openai_base_url(base_url)
    if not normalized or _allow_local_base_url():
        return normalized
    parsed = urlsplit(normalized)
    host = (parsed.hostname or "").strip().lower().rstrip(".")
    if not host:
        raise ValueError("自定义 Base URL 缺少有效主机名")
    if host == "localhost" or host.endswith(".localhost"):
        raise ValueError(
            "默认禁止连接 localhost 自定义 Base URL;如需本机代理请设置 ALLOW_LOCAL_LLM_BASE_URL=1"
        )
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return normalized
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        raise ValueError(
            "默认禁止连接内网或本机自定义 Base URL;如需本机代理请设置 ALLOW_LOCAL_LLM_BASE_URL=1"
        )
    return normalized


def load_providers(config_path: Optional[str] = None) -> Dict[str, Any]:
    """从 providers.yaml 加载 Provider 配置"""
    p = Path(config_path) if config_path else CONFIG_DIR / "providers.yaml"
    if not p.exists():
        return {}
    try:
        raw = yaml.safe_load(p.read_text(encoding="utf-8"))
        providers = {}
        for prov in raw.get("providers", []):
            prov_id = prov["id"]
            api_host = _resolve_env(prov.get("apiHost", ""))
            api_key = _resolve_env(prov.get("apiKey", ""))
            api_host = normalize_openai_base_url(api_host)
            providers[prov_id] = {
                "api_key": api_key,
                "base_url": api_host,
                "supports_json_mode": prov.get("supportsJsonMode", True),
                "label": prov.get("name", prov_id),
                "models": {m["id"]: m for m in prov.get("models", [])},
            }
        return providers
    except Exception as e:
        print(f"[Provider] 加载配置失败: {e}")
        return {}


# 加载 Provider 配置（如果存在）
_PROVIDER_CONFIG = load_providers()
_PERSISTED_PROVIDERS_SYNCED = False
_PERSISTED_PROVIDERS_SYNCING = False


# ============== 供应商配置（向后兼容）=============
VENDORS = {
    "deepseek": {
        "api_key": os.getenv("DEEPSEEK_API_KEY"),
        "base_url": os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
        "supports_json_mode": True,
        "label": "DeepSeek",
    },
    "claude": {
        "api_key": os.getenv("CLAUDE_API_KEY"),
        "base_url": (os.getenv("CLAUDE_BASE_URL", "") + "/v1")
        if os.getenv("CLAUDE_BASE_URL")
        else None,
        "supports_json_mode": False,
        "label": "Claude",
    },
    "gpt": {
        "api_key": os.getenv("GPT_API_KEY"),
        "base_url": (os.getenv("GPT_BASE_URL", "") + "/v1")
        if os.getenv("GPT_BASE_URL")
        else None,
        "supports_json_mode": True,
        "label": "GPT",
    },
    "mimo": {
        "api_key": os.getenv("MIMO_API_KEY"),
        "base_url": (os.getenv("MIMO_BASE_URL", "") + "/v1")
        if os.getenv("MIMO_BASE_URL")
        else None,
        "supports_json_mode": False,
        "label": "Mimo",
    },
    "sensenova": {
        "api_key": os.getenv("SENSENOVA_API_KEY"),
        "base_url": os.getenv("SENSENOVA_BASE_URL"),
        "supports_json_mode": False,
        "label": "SenseNova",
    },
    "kimi": {
        "api_key": os.getenv("KIMI_API_KEY"),
        "base_url": os.getenv("KIMI_BASE_URL", "https://api.moonshot.cn/v1"),
        "supports_json_mode": True,
        "label": "Kimi",
    },
}

# 如果 Provider 配置加载成功，合并到 VENDORS（Provider 配置优先）
if _PROVIDER_CONFIG:
    for prov_id, cfg in _PROVIDER_CONFIG.items():
        if cfg.get("api_key") and cfg.get("base_url"):
            VENDORS[prov_id] = {
                "api_key": cfg["api_key"],
                "base_url": cfg["base_url"],
                "supports_json_mode": cfg.get("supports_json_mode", True),
                "label": cfg.get("label", prov_id),
            }
            print(f"[Provider] 已加载: {prov_id} -> {cfg['base_url']}")


def _sync_persisted_providers_once() -> None:
    """Load providers saved via the settings UI after a backend restart."""
    global _PERSISTED_PROVIDERS_SYNCED, _PERSISTED_PROVIDERS_SYNCING
    if _PERSISTED_PROVIDERS_SYNCED or _PERSISTED_PROVIDERS_SYNCING:
        return
    _PERSISTED_PROVIDERS_SYNCING = True
    try:
        from backend.settings_store import get_provider, list_providers

        for public_provider in list_providers():
            if public_provider.get("enabled") is False:
                continue
            provider_id = str(public_provider.get("id") or "").strip()
            if not provider_id:
                continue
            full_provider = get_provider(provider_id)
            if not full_provider:
                continue
            api_key = full_provider.get("api_key") or ""
            base_url = normalize_openai_base_url(full_provider.get("base_url") or "")
            if not api_key or not base_url:
                continue
            VENDORS[provider_id] = {
                "api_key": api_key,
                "base_url": base_url,
                "supports_json_mode": True,
                "label": full_provider.get("name") or provider_id,
            }
    except Exception as exc:
        logger.debug("failed to sync persisted providers: %s", exc)
    finally:
        _PERSISTED_PROVIDERS_SYNCING = False
        _PERSISTED_PROVIDERS_SYNCED = True


# ============== 客户端管理 ==============


def get_vendor_config(
    vendor: str, api_key: Optional[str] = None, base_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    获取供应商配置。
    如果提供了 api_key/base_url，则创建临时配置（细粒度 Key / 自定义 OpenAI-compatible Base URL）。
    """
    _sync_persisted_providers_once()
    base = VENDORS.get(vendor) or VENDORS.get("deepseek")
    if not base:
        return None
    if api_key or base_url:
        normalized_base_url = normalize_openai_base_url(
            base_url or base.get("base_url") or ""
        )
        if base_url:
            normalized_base_url = validate_custom_base_url(normalized_base_url)
        return {
            **base,
            "api_key": api_key or base.get("api_key"),
            "base_url": normalized_base_url,
        }
    return base


def get_configured_provider(preferred: Optional[str] = None) -> tuple[str, str]:
    """Return a configured provider/model, preferring explicit and env defaults."""
    _sync_persisted_providers_once()
    candidates = [
        preferred,
        os.getenv("AI_CHAT_PROVIDER"),
        os.getenv("DEFAULT_LLM_PROVIDER"),
        "deepseek",
        "sensenova",
        "kimi",
        "gpt",
        "claude",
        "mimo",
    ]
    seen: set[str] = set()
    for candidate in candidates:
        provider = (candidate or "").strip()
        if not provider or provider in seen:
            continue
        seen.add(provider)
        cfg = VENDORS.get(provider)
        if not cfg or not cfg.get("api_key") or not cfg.get("base_url"):
            continue
        model = (
            os.getenv("AI_CHAT_MODEL")
            if provider == (os.getenv("AI_CHAT_PROVIDER") or "").strip()
            else ""
        )
        model = model or DEFAULT_PROVIDER_MODELS.get(provider) or "deepseek-chat"
        return provider, model
    fallback = (preferred or os.getenv("AI_CHAT_PROVIDER") or "deepseek").strip()
    return fallback, DEFAULT_PROVIDER_MODELS.get(fallback, "deepseek-chat")


def create_client(
    vendor: str, api_key: Optional[str] = None, base_url: Optional[str] = None
) -> OpenAI:
    """创建 OpenAI 兼容客户端，支持细粒度 API Key 与自定义 Base URL"""
    cfg = get_vendor_config(vendor, api_key, base_url)
    if not cfg or not cfg["api_key"] or not cfg["base_url"]:
        raise RuntimeError(f"供应商 {vendor} 未配置完整")
    return OpenAI(
        api_key=cfg["api_key"],
        base_url=cfg["base_url"],
        timeout=60.0,
    )


_client_cache: Dict[str, OpenAI] = {}
_client_cache_lock = threading.Lock()


def get_client(
    vendor: str, api_key: Optional[str] = None, base_url: Optional[str] = None
) -> OpenAI:
    """
    获取客户端。
    如果提供了 api_key/base_url，则创建独立客户端（不走缓存，避免 Key/URL 混淆）。
    """
    if api_key or base_url:
        return create_client(vendor, api_key, base_url)

    cache_key = vendor
    with _client_cache_lock:
        if cache_key in _client_cache:
            return _client_cache[cache_key]
        client = create_client(vendor)
        _client_cache[cache_key] = client
        return client


def clear_client_cache():
    """清理客户端缓存（热重载后调用）"""
    global _client_cache
    with _client_cache_lock:
        _client_cache = {}


# ============== LLM 统一调用 ==============


def _record_cost(
    resp: Any,
    vendor: str,
    model: str,
    agent_key: str,
    mode: str,
    conversation_id: str,
):
    """从响应中提取 token 用量并记录到 CostTracker 和 ModelRegistry。"""
    if get_cost_tracker is None:
        return
    try:
        usage = getattr(resp, "usage", None)
        if usage is None:
            return
        input_tokens = getattr(usage, "prompt_tokens", 0) or 0
        output_tokens = getattr(usage, "completion_tokens", 0) or 0
        if input_tokens == 0 and output_tokens == 0:
            return
        tracker = get_cost_tracker()
        tracker.record_call(
            agent_key=agent_key,
            model=model,
            vendor=vendor,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            mode=mode,
            conversation_id=conversation_id,
        )

        # 同步到 ModelRegistry（预算追踪）
        try:
            from backend.models.model_registry import get_model_registry

            cost_est = tracker._estimate_cost(model, input_tokens, output_tokens)
            get_model_registry().record_usage(
                model, input_tokens, output_tokens, cost_est
            )
        except Exception:
            pass
    except Exception:
        # 成本记录不应阻断正常调用
        pass


def _call_with(
    vendor: str,
    model: str,
    messages: list,
    json_mode: bool = False,
    max_tokens: int = 400,
    temperature: float = 0.3,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    agent_key: str = "unknown",
    mode: str = "",
    conversation_id: str = "",
) -> str:
    """
    统一调用接口，支持细粒度 API Key 与 Base URL。
    自动处理 json_mode 不支持的情况。
    调用前检查 Token 预算。
    调用完成后自动记录 token 用量到 CostTracker。
    """
    # 预算检查（可选依赖）
    try:
        from backend.models.model_registry import get_model_registry

        registry = get_model_registry()
        budget_check = registry.check_budget()
        if not budget_check.get("ok", True):
            raise RuntimeError(budget_check.get("message", "预算不足"))

        # 能力检查：如果请求 json_mode 但模型不支持，降级
        if json_mode and not registry.supports_tool_call(model):
            # 检查是否支持 json_mode
            cap = registry.get_capability(model)
            if not cap.json_mode:
                json_mode = False
    except ImportError:
        pass

    client = get_client(vendor, api_key, base_url)
    kwargs = dict(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    cfg = get_vendor_config(vendor, api_key, base_url)
    if json_mode and cfg and cfg.get("supports_json_mode"):
        kwargs["response_format"] = {"type": "json_object"}
    resp = client.chat.completions.create(**kwargs)
    # 记录成本（透明，不影响返回值）
    _record_cost(resp, vendor, model, agent_key, mode, conversation_id)
    return resp.choices[0].message.content or ""


# 公共别名：所有新模块统一通过 call_llm 调用
call_llm = _call_with


# ============== JSON 提取工具 ==============


def _extract_json(text: str) -> dict:
    """从 LLM 返回的文本里稳健地提取 JSON 对象，兼容 Mimo 等模型的说明文字/尾逗号。"""
    if not text:
        return {}

    def _balanced_json_candidates(raw: str) -> List[str]:
        candidates: List[str] = []
        start: Optional[int] = None
        depth = 0
        in_string = False
        escape = False
        for i, ch in enumerate(raw):
            if start is None:
                if ch == "{":
                    start = i
                    depth = 1
                    in_string = False
                    escape = False
                continue
            if escape:
                escape = False
                continue
            if ch == "\\" and in_string:
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0 and start is not None:
                    candidates.append(raw[start : i + 1])
                    start = None
        return candidates

    def _loads(candidate: str) -> dict:
        candidate = (candidate or "").strip()
        candidate = (
            candidate.replace("“", '"')
            .replace("”", '"')
            .replace("‘", "'")
            .replace("’", "'")
        )
        candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
        return json.loads(candidate)

    # 1) 直接尝试
    try:
        return _loads(text)
    except Exception:
        pass
    # 2) 提取 ```json ... ``` 代码块
    m = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if m:
        try:
            return _loads(m.group(1))
        except Exception:
            pass
    # 3) 抓平衡的 JSON 对象块
    for candidate in _balanced_json_candidates(text):
        try:
            return _loads(candidate)
        except Exception:
            continue
    return {}


# ============== Provider 管理工具 ==============


def get_provider_list() -> list:
    """返回所有已配置的 Provider 列表"""
    return [
        {
            "id": k,
            "name": v["label"],
            "base_url": v["base_url"],
            "has_key": bool(v.get("api_key")),
        }
        for k, v in VENDORS.items()
    ]


def get_provider_models(provider_id: str) -> list:
    """返回指定 Provider 的模型列表"""
    prov = _PROVIDER_CONFIG.get(provider_id)
    if not prov:
        return []
    return [
        {
            "id": m_id,
            "name": m.get("name", m_id),
            "contextWindow": m.get("contextWindow", "未知"),
        }
        for m_id, m in prov.get("models", {}).items()
    ]
