"""
Runtime Orchestrator: 模式感知的 Agent 编排。

职责：
- run_agents_with_mode() - 根据 AnalysisMode 运行 Agent 分析
- _run_auto_mode() - Auto 模式：预筛 + 条件升级
- _mode_config_to_agent_dicts() - AgentModeConfig → agent dict 列表
- get_mode_model_table() - UI 显示用的模型表

从 llm_agents.py 拆分而来。
"""

import logging
from dataclasses import asdict
from typing import Dict, Any, Optional, List

from backend.models.provider_gateway import VENDORS, _call_with, _extract_json
from backend.agents.base import (
    AGENT_PROMPTS,
    _agent_config_from_dict,
)
from backend.agents.chairman import summarize_with_chairman

try:
    from backend.agent_modes import AnalysisMode, AgentModeConfig, get_mode_resolver
except ImportError:
    from agent_modes import AnalysisMode, AgentModeConfig, get_mode_resolver

logger = logging.getLogger(__name__)


def run_agents_with_mode(
    stock_data: Dict[str, Any],
    mode: AnalysisMode = AnalysisMode.DEEP,
    agent_configs: Optional[List[dict]] = None,
    global_ai_settings: Optional[dict] = None,
    api_keys: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Run agent analysis with mode-based configuration.

    Args:
        stock_data: Stock data dict with price, technical, fundamental info
        mode: AnalysisMode.STANDARD, .DEEP, or .AUTO
        agent_configs: Optional custom agent configs (overrides mode defaults)
        global_ai_settings: Optional global AI settings from dashboard
        api_keys: Optional per-agent API keys

    Returns:
        Same shape as run_custom_agents() with additional mode metadata
    """
    resolver = get_mode_resolver()
    config = resolver.resolve(mode)

    if mode == AnalysisMode.AUTO:
        return _run_auto_mode(stock_data, config, global_ai_settings, api_keys)

    # STANDARD or DEEP mode
    if agent_configs is None:
        agent_configs = _mode_config_to_agent_dicts(config)

    from backend.runtime.context_builder import (
        build_market_brief,
        fetch_evidence_context,
        fetch_factor_context,
    )

    symbol = stock_data.get("symbol", "")
    stock_name = stock_data.get("name", "")

    evidence_ctx = ""
    factor_ctx = ""
    if config.enable_evidence:
        evidence_ctx = fetch_evidence_context(symbol, stock_name)
    if config.enable_factors:
        factor_ctx = fetch_factor_context(symbol, stock_name)

    brief = build_market_brief(
        stock_data, evidence_context=evidence_ctx, factor_context=factor_ctx
    )
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
            "mode": mode.value,
            "mode_name": config.name,
        }

    from backend.agents.financial_agents import run_custom_agent

    results = {}
    from concurrent.futures import ThreadPoolExecutor, as_completed

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

    # Critic review (only in DEEP mode)
    critic_block = None
    if config.enable_critic and any(r.get("ok") for r in results.values()):
        try:
            from backend.critic import run_batch_critic

            critic_block = run_batch_critic(
                stock_name=stock_data.get("name", "未知标的"),
                market_brief=brief,
                agent_results={k: r for k, r in results.items() if r.get("ok")},
                vendor=config.critic_provider,
                model=config.critic_model,
            )
            for ag_key, review in (critic_block.get("agents") or {}).items():
                if ag_key in results:
                    results[ag_key]["review"] = review
        except Exception as e:
            critic_block = {
                "agents": {},
                "divergence": {"level": "无", "main_axis": "", "summary": ""},
                "ok": False,
                "error": str(e)[:200],
            }

    # Chairman synthesis (only in DEEP mode)
    chairman_summary = None
    if config.enable_chairman:
        try:
            chairman_summary = summarize_with_chairman(
                {
                    "agents": results,
                    "summary": {"buy": buy, "sell": sell, "hold": hold},
                },
                stock_data.get("name", ""),
            )
        except Exception as e:
            chairman_summary = f"主席总结生成失败: {e}"

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
        "chairman_summary": chairman_summary,
        "mode": mode.value,
        "mode_name": config.name,
    }


def _run_auto_mode(
    stock_data: Dict[str, Any],
    config: AgentModeConfig,
    global_ai_settings: Optional[dict] = None,
    api_keys: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Auto mode: quick pre-screen with cheap model, escalate if ambiguous.

    Stage 1: Single agent with cheap model (DeepSeek)
    Stage 2: If confidence is between 30-70, escalate to full DEEP analysis
    """
    from backend.runtime.context_builder import build_market_brief

    brief = build_market_brief(stock_data)

    # Stage 1: Pre-screen
    pre_screen_messages = [
        {
            "role": "system",
            "content": "你是一位快速股票分析师。基于简报给出买入/卖出/观望信号和置信度。",
        },
        {
            "role": "user",
            "content": (
                f"{brief}\n\n"
                '请用 JSON 返回: {"signal": "买入|卖出|观望", "confidence": 0-100, "reason": "50字内理由"}'
            ),
        },
    ]

    try:
        text = _call_with(
            config.pre_screen_provider,
            config.pre_screen_model,
            pre_screen_messages,
            json_mode=True,
            max_tokens=config.pre_screen_max_tokens,
            temperature=config.pre_screen_temperature,
        )
        pre_result = _extract_json(text)
        pre_signal = pre_result.get("signal", "观望")
        pre_confidence = int(pre_result.get("confidence", 50))
        pre_reason = pre_result.get("reason", "")
    except Exception as e:
        pre_signal = "观望"
        pre_confidence = 50
        pre_reason = f"预筛失败: {e}"

    # Check if escalation is needed
    if pre_confidence < config.escalate_below or pre_confidence > config.escalate_above:
        return {
            "agents": {
                "pre_screen": {
                    "key": "pre_screen",
                    "name": "🔍 快速预筛",
                    "signal": pre_signal,
                    "confidence": pre_confidence,
                    "reason": pre_reason,
                    "evidence": [],
                    "invalid_if": "",
                    "risks": [],
                    "vendor": config.pre_screen_provider,
                    "model": config.pre_screen_model,
                    "ok": True,
                }
            },
            "summary": {
                "final": f"建议{'买入' if pre_signal == '买入' else '卖出' if pre_signal == '卖出' else '观望'}",
                "buy": 1 if pre_signal == "买入" else 0,
                "sell": 1 if pre_signal == "卖出" else 0,
                "hold": 1 if pre_signal == "观望" else 0,
                "avg_confidence": pre_confidence,
            },
            "brief": brief,
            "agent_order": ["pre_screen"],
            "critic": None,
            "chairman_summary": None,
            "mode": "auto",
            "mode_name": "自动模式 (预筛直接输出)",
            "auto_escalated": False,
            "pre_screen_result": {
                "signal": pre_signal,
                "confidence": pre_confidence,
                "reason": pre_reason,
            },
        }

    # Escalation needed: run full DEEP analysis
    deep_configs = _mode_config_to_agent_dicts(config)
    deep_result = run_agents_with_mode(
        stock_data,
        mode=AnalysisMode.DEEP,
        agent_configs=deep_configs,
        global_ai_settings=global_ai_settings,
        api_keys=api_keys,
    )
    deep_result["mode"] = "auto"
    deep_result["mode_name"] = "自动模式 (已升级到深入分析)"
    deep_result["auto_escalated"] = True
    deep_result["pre_screen_result"] = {
        "signal": pre_signal,
        "confidence": pre_confidence,
        "reason": pre_reason,
    }
    return deep_result


def _mode_config_to_agent_dicts(config: AgentModeConfig) -> List[dict]:
    """Convert AgentModeConfig agents to list of dicts compatible with run_custom_agents()"""
    prompt_map = {
        "fundamental": AGENT_PROMPTS.get("fundamental", {}),
        "technical": AGENT_PROMPTS.get("technical", {}),
        "sentiment": AGENT_PROMPTS.get("sentiment", {}),
        "risk": AGENT_PROMPTS.get("risk", {}),
        "retail": AGENT_PROMPTS.get("retail", {}),
    }
    card_style_map = {
        "fundamental": "value",
        "technical": "technical",
        "sentiment": "growth",
        "risk": "risk",
        "retail": "macro",
    }

    result = []
    for agent_entry in config.enabled_agents:
        prompt = prompt_map.get(agent_entry.key, {})
        result.append(
            {
                "key": agent_entry.key,
                "name": prompt.get("name", agent_entry.key),
                "avatar": str(prompt.get("name", "🤖"))[:2].strip() or "🤖",
                "role": prompt.get("role", ""),
                "instruction": prompt.get("instruction", ""),
                "provider": agent_entry.provider,
                "model": agent_entry.model,
                "enabled": agent_entry.enabled,
                "inherit_global_key": True,
                "card_style": card_style_map.get(agent_entry.key, "default"),
            }
        )
    return result


def get_mode_model_table(mode: AnalysisMode) -> list:
    """Get agent model table for a specific mode (for UI display)"""
    config = get_mode_resolver().resolve(mode)
    rows = []
    for agent in config.enabled_agents:
        prompt = AGENT_PROMPTS.get(agent.key, {})
        name = prompt.get("name", agent.key)
        vendor_label = VENDORS.get(agent.provider, {}).get("label", agent.provider)
        rows.append((agent.key, name, vendor_label, agent.model))

    if config.enable_critic:
        rows.append(
            (
                "critic",
                "📝 Critic 审稿",
                VENDORS.get(config.critic_provider, {}).get(
                    "label", config.critic_provider
                ),
                config.critic_model,
            )
        )
    if config.enable_chairman:
        rows.append(
            (
                "chairman",
                "🎩 投资委员会主席",
                VENDORS.get(config.chairman_provider, {}).get(
                    "label", config.chairman_provider
                ),
                config.chairman_model,
            )
        )
    return rows
