"""
Financial Agents: Agent 执行逻辑。

职责：
- run_one_agent() - 运行单个内置 Agent
- run_all_agents() - 并行运行全部内置 Agent
- run_custom_agent() - 运行单个自定义 Agent
- run_custom_agents() - 并行运行自定义 Agent 列表
- get_custom_agent_model_table() / get_agent_model_table() - UI 辅助

从 llm_agents.py 拆分而来。
"""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict
from typing import Dict, Any, Optional, List

from backend.models.provider_gateway import (
    VENDORS,
    _call_with,
    _extract_json,
    get_configured_provider,
)
from backend.agents.base import (
    AGENT_MODEL_CONFIG,
    AGENT_PROMPTS,
    FALLBACK_VENDOR_MODEL,
    _agent_config_from_dict,
    _resolve_agent_ai_config,
    _strict_json_messages,
)

try:
    from validators import validate_agent_output as _validate_agent_output
except Exception:

    def _validate_agent_output(data):
        if not isinstance(data, dict):
            return {}
        return data


logger = logging.getLogger(__name__)


def _candidate_models(
    provider: str,
    model: str,
    *,
    api_key: Optional[str] = None,
    base_url: str = "",
) -> list[tuple[str, str, str, Optional[str]]]:
    candidates = [(provider, model, base_url, api_key)]
    fallback_provider, fallback_model = get_configured_provider()
    fallback = (fallback_provider, fallback_model, "", None)
    if (fallback_provider, fallback_model) != (provider, model):
        candidates.append(fallback)
    return candidates


def run_one_agent(
    agent_key: str, market_brief: str, api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    运行单个 Agent,含 fallback 与稳健 JSON 解析。
    支持细粒度 API Key。
    """
    cfg = AGENT_PROMPTS[agent_key]
    vendor, model = AGENT_MODEL_CONFIG.get(agent_key, FALLBACK_VENDOR_MODEL)
    primary_vendor = vendor

    messages = [
        {"role": "system", "content": cfg["role"]},
        {"role": "user", "content": f"{cfg['instruction']}\n\n{market_brief}"},
    ]

    last_err = None
    for vd, md, base_url, key_override in _candidate_models(
        vendor, model, api_key=api_key
    ):
        try:
            mtokens = 2048 if vd == "mimo" else 600
            text = _call_with(
                vd,
                md,
                messages,
                json_mode=True,
                max_tokens=mtokens,
                temperature=0.3,
                api_key=key_override,
                base_url=base_url,
            )
            data = _extract_json(text)
            if not data or not data.get("signal"):
                retry_tokens = 2048 if vd == "mimo" else 400
                text = _call_with(
                    vd,
                    md,
                    messages
                    + [
                        {"role": "assistant", "content": text},
                        {
                            "role": "user",
                            "content": "请只输出符合格式的 JSON 对象,不要任何前后说明。",
                        },
                    ],
                    json_mode=True,
                    max_tokens=retry_tokens,
                    temperature=0.1,
                    api_key=key_override,
                    base_url=base_url,
                )
                data = _extract_json(text)

            if not data or not data.get("signal"):
                last_err = f"{VENDORS.get(vd, {}).get('label', vd)} 未返回有效 JSON"
                continue

            valid = _validate_agent_output(data or {})
            return {
                "key": agent_key,
                "name": cfg["name"],
                "signal": valid["signal"],
                "confidence": valid["confidence"],
                "reason": valid["reason"],
                "evidence": valid["evidence"],
                "invalid_if": valid["invalid_if"],
                "risks": valid["risks"],
                "vendor": VENDORS.get(vd, {}).get("label", vd),
                "model": md,
                "primary_vendor": VENDORS.get(primary_vendor, {}).get(
                    "label", primary_vendor
                ),
                "fallback_used": vd != primary_vendor,
                "ok": True,
            }
        except Exception as e:
            last_err = str(e)[:120]
            continue

    return {
        "key": agent_key,
        "name": cfg["name"],
        "signal": "观望",
        "confidence": 0,
        "reason": f"分析失败: {last_err}",
        "evidence": [],
        "invalid_if": "",
        "risks": [],
        "vendor": "?",
        "model": "?",
        "primary_vendor": VENDORS[primary_vendor]["label"],
        "fallback_used": True,
        "ok": False,
    }


def run_all_agents(
    stock_data: Dict[str, Any],
    include_retail: bool = True,
    api_keys: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    并行调用全部 Agent（4 核心 + 可选散户行为）。
    api_keys: {agent_key: api_key} 细粒度 API Key 映射。
    """
    from backend.runtime.context_builder import (
        build_market_brief,
        fetch_evidence_context,
        fetch_factor_context,
    )

    symbol = stock_data.get("symbol", "")
    stock_name = stock_data.get("name", "")
    evidence_ctx = fetch_evidence_context(symbol, stock_name)
    factor_ctx = fetch_factor_context(symbol, stock_name)
    brief = build_market_brief(
        stock_data, evidence_context=evidence_ctx, factor_context=factor_ctx
    )
    api_keys = api_keys or {}

    keys = ["fundamental", "technical", "sentiment", "risk"]
    if include_retail:
        keys.append("retail")

    results = {}
    with ThreadPoolExecutor(max_workers=len(keys)) as ex:
        futures = {ex.submit(run_one_agent, k, brief, api_keys.get(k)): k for k in keys}
        for fut in as_completed(futures):
            r = fut.result()
            results[r["key"]] = r

    buy = sum(1 for r in results.values() if r["signal"] == "买入")
    sell = sum(1 for r in results.values() if r["signal"] == "卖出")
    hold = sum(1 for r in results.values() if r["signal"] == "观望")
    avg_conf = sum(r["confidence"] for r in results.values()) / max(len(results), 1)

    threshold = 3 if include_retail else 2
    if buy > sell and buy >= threshold:
        final = "建议买入"
    elif sell > buy and sell >= threshold:
        final = "建议卖出"
    else:
        final = "建议观望"

    return {
        "agents": results,
        "summary": {
            "final": final,
            "buy": buy,
            "sell": sell,
            "hold": hold,
            "avg_confidence": avg_conf,
        },
        "brief": brief,
    }


def run_custom_agent(
    agent_raw: dict,
    market_brief: str,
    api_key: Optional[str] = None,
    global_ai_settings: Optional[dict] = None,
) -> Dict[str, Any]:
    """运行单个页面自定义 Agent。"""
    cfg = _agent_config_from_dict(agent_raw)
    resolved_provider, resolved_model, resolved_key, resolved_base_url = (
        _resolve_agent_ai_config(cfg, global_ai_settings)
    )
    if api_key:
        resolved_key = api_key
    messages = [
        {"role": "system", "content": cfg.role},
        {
            "role": "user",
            "content": (
                f"{cfg.instruction}\n\n{market_brief}\n\n"
                "【输出要求】请用 JSON 返回,字段:\n"
                "- signal: 买入|卖出|观望\n"
                "- confidence: 0-100 整数\n"
                "- reason: 100 字内核心理由\n"
                "- evidence: 数组,每条 {type, claim, data_date},type 取自 fund_flow/technical/fundamental/news/research/macro/sentiment/shareholder/other\n"
                "- invalid_if: 简短的失效条件\n"
                "- risks: 1-3 条主要风险(字符串数组)\n"
            ),
        },
    ]
    primary_vendor = resolved_provider
    last_err = None
    for vd, md, bu, key_override in _candidate_models(
        resolved_provider,
        resolved_model,
        api_key=resolved_key,
        base_url=resolved_base_url,
    ):
        try:
            mtokens = 2048 if vd == "mimo" else 500
            call_messages = (
                _strict_json_messages(messages) if vd == "mimo" else messages
            )
            text = _call_with(
                vd,
                md,
                call_messages,
                json_mode=True,
                max_tokens=mtokens,
                temperature=0.3,
                api_key=key_override,
                base_url=bu,
            )
            data = _extract_json(text)
            if not data or not data.get("signal"):
                retry_messages = messages + [
                    {"role": "assistant", "content": text or ""},
                    {
                        "role": "user",
                        "content": '请只输出 JSON：{"signal": "买入|卖出|观望", "confidence": 75, "reason": "理由", "evidence": [], "invalid_if": "", "risks": []}',
                    },
                ]
                if vd == "mimo":
                    retry_messages = _strict_json_messages(retry_messages)
                text = _call_with(
                    vd,
                    md,
                    retry_messages,
                    json_mode=True,
                    max_tokens=mtokens,
                    temperature=0.1,
                    api_key=key_override,
                    base_url=bu,
                )
                data = _extract_json(text)
            if not data or not data.get("signal"):
                last_err = f"{vd} 未返回有效 JSON"
                continue
            valid = _validate_agent_output(data)
            return {
                "key": cfg.key,
                "name": cfg.name,
                "signal": valid["signal"],
                "confidence": valid["confidence"],
                "reason": valid["reason"],
                "evidence": valid["evidence"],
                "invalid_if": valid["invalid_if"],
                "risks": valid["risks"],
                "vendor": VENDORS.get(vd, {}).get("label", vd),
                "model": md,
                "primary_vendor": VENDORS.get(primary_vendor, {}).get(
                    "label", primary_vendor
                ),
                "fallback_used": vd != primary_vendor,
                "ok": True,
                "card_style": cfg.card_style,
            }
        except Exception as e:
            last_err = str(e)[:120]
            continue
    return {
        "key": cfg.key,
        "name": cfg.name,
        "signal": "观望",
        "confidence": 0,
        "reason": f"分析失败: {last_err}",
        "evidence": [],
        "invalid_if": "",
        "risks": [],
        "vendor": "?",
        "model": "?",
        "primary_vendor": VENDORS.get(primary_vendor, {}).get("label", primary_vendor),
        "fallback_used": True,
        "ok": False,
        "card_style": cfg.card_style,
    }


def run_custom_agents(
    stock_data: Dict[str, Any],
    agent_configs: List[dict],
    global_ai_settings: Optional[dict] = None,
    api_keys: Optional[Dict[str, str]] = None,
    enable_critic: bool = True,
) -> Dict[str, Any]:
    """并行运行任意数量的页面自定义 Agent;并可选地批量调用 Critic 审稿。"""
    from backend.runtime.context_builder import build_market_brief

    brief = build_market_brief(stock_data)
    api_keys = api_keys or {}
    active = [
        _agent_config_from_dict(a)
        for a in agent_configs
        if bool(a.get("enabled", True))
    ]
    if not active:
        return {
            "agents": {},
            "summary": {
                "final": "建议观望",
                "buy": 0,
                "sell": 0,
                "hold": 0,
                "avg_confidence": 0,
            },
            "brief": brief,
            "agent_order": [],
            "critic": None,
        }
    results = {}
    with ThreadPoolExecutor(max_workers=len(active)) as ex:
        futures = {
            ex.submit(
                run_custom_agent,
                asdict(cfg),
                brief,
                api_keys.get(cfg.key),
                global_ai_settings,
            ): cfg.key
            for cfg in active
        }
        for fut in as_completed(futures):
            r = fut.result()
            results[r["key"]] = r
    buy = sum(1 for r in results.values() if r["signal"] == "买入")
    sell = sum(1 for r in results.values() if r["signal"] == "卖出")
    hold = sum(1 for r in results.values() if r["signal"] == "观望")
    avg_conf = sum(r["confidence"] for r in results.values()) / max(len(results), 1)
    threshold = max(1, len(results) // 2 + 1)
    if buy > sell and buy >= threshold:
        final = "建议买入"
    elif sell > buy and sell >= threshold:
        final = "建议卖出"
    else:
        final = "建议观望"

    critic_block = None
    if enable_critic and any(r.get("ok") for r in results.values()):
        try:
            from backend.critic import run_batch_critic

            critic_settings = (global_ai_settings or {}).get("critic") or {}
            inherit = bool(
                critic_settings.get(
                    "inherit_global_key",
                    (global_ai_settings or {}).get("use_unified_key", True),
                )
            )
            if inherit and (global_ai_settings or {}).get("api_key"):
                critic_api_key = (global_ai_settings or {}).get("api_key", "")
                critic_base_url = (global_ai_settings or {}).get("base_url", "")
            else:
                critic_api_key = critic_settings.get("api_key") or ""
                critic_base_url = critic_settings.get("base_url") or ""
            critic_block = run_batch_critic(
                stock_name=stock_data.get("name", "未知标的"),
                market_brief=brief,
                agent_results={k: r for k, r in results.items() if r.get("ok")},
                vendor=critic_settings.get("provider"),
                model=critic_settings.get("model"),
                api_key=critic_api_key or None,
                base_url=critic_base_url or None,
            )
            for ag_key, review in (critic_block.get("agents") or {}).items():
                if ag_key in results:
                    results[ag_key]["review"] = review
        except Exception as e:
            critic_block = {
                "agents": {},
                "divergence": {"level": "无", "main_axis": "", "summary": ""},
                "ok": False,
                "vendor": "",
                "model": "",
                "fallback_used": True,
                "error": str(e)[:200],
            }

    return {
        "agents": results,
        "summary": {
            "final": final,
            "buy": buy,
            "sell": sell,
            "hold": hold,
            "avg_confidence": avg_conf,
        },
        "brief": brief,
        "agent_order": [cfg.key for cfg in active],
        "critic": critic_block,
    }


def get_custom_agent_model_table(agent_configs: List[dict]) -> list:
    rows = []
    for raw in agent_configs:
        if not raw.get("enabled", True):
            continue
        cfg = _agent_config_from_dict(raw)
        rows.append(
            (
                cfg.key,
                cfg.name,
                VENDORS.get(cfg.provider, {}).get("label", cfg.provider),
                cfg.model,
            )
        )
    return rows


def get_agent_model_table() -> list:
    """供 UI 显示：返回 [(agent_key, agent_name, vendor_label, model)]"""
    rows = []
    for key, (vendor, model) in AGENT_MODEL_CONFIG.items():
        if key == "chairman":
            name = "🎩 投资委员会主席"
        else:
            name = AGENT_PROMPTS[key]["name"]
        rows.append((key, name, VENDORS[vendor]["label"], model))
    return rows
