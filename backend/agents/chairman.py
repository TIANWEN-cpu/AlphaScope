"""
Chairman Agent: 投资委员会主席综合判断。

职责：
- summarize_with_chairman() - 综合所有 Agent 观点输出最终建议

从 llm_agents.py 拆分而来。
"""

from typing import Dict, Any, Optional

from backend.models.provider_gateway import VENDORS, _call_with, get_configured_provider
from backend.agents.base import AGENT_MODEL_CONFIG


def summarize_with_chairman(
    results: Dict[str, Any], stock_name: str, api_key: Optional[str] = None
) -> str:
    """
    主席角色：综合所有 Agent 给出最终投资建议（用 Claude Opus 顶级模型）。
    支持细粒度 API Key。
    """
    agents_text = "\n\n".join(
        [
            f"【{r['name']} · {r.get('vendor', '?')}/{r.get('model', '?')}】信号: {r['signal']} | 置信度: {r['confidence']}%\n理由: {r['reason']}"
            for r in results["agents"].values()
        ]
    )

    prompt = f"""你是投资委员会主席。下面是分析师团队对 {stock_name} 的独立观点（每位使用不同模型，避免同质化偏见）：

{agents_text}

汇总投票: 买入 {results["summary"]["buy"]} / 卖出 {results["summary"]["sell"]} / 观望 {results["summary"]["hold"]}

请综合所有观点，输出一份**专业、克制、可执行**的最终建议，包括：
1. 一句话核心结论
2. 主要支持论据（2-3 点）
3. 主要风险与反对意见（1-2 点）
4. 操作建议（仓位、止损位、关注信号）

字数控制在 280 字以内，使用 markdown 格式。"""

    vendor, model = AGENT_MODEL_CONFIG["chairman"]
    fallback_vendor, fallback_model = get_configured_provider()
    messages = [
        {
            "role": "system",
            "content": "你是一位严谨克制的投资委员会主席，注重风控与可执行性。",
        },
        {"role": "user", "content": prompt},
    ]
    last = ""
    candidates = [(vendor, model, api_key)]
    if (fallback_vendor, fallback_model) != (vendor, model):
        candidates.append((fallback_vendor, fallback_model, None))
    for vd, md, key_override in candidates:
        try:
            return _call_with(
                vd,
                md,
                messages,
                json_mode=False,
                max_tokens=700,
                temperature=0.4,
                api_key=key_override,
            )
        except Exception as e:
            last = f"主席总结生成失败 ({VENDORS.get(vd, {}).get('label', vd)}/{md}): {e}"
            continue
    return last
