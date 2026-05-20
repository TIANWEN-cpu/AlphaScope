"""
Agent Base: 配置、提示词、模型映射。

职责：
- AgentConfig dataclass
- AGENT_MODEL_CONFIG (agent → vendor/model 映射)
- AGENT_PROMPTS (agent 角色提示词)
- FALLBACK_VENDOR_MODEL
- get_default_agent_configs()
- _agent_config_from_dict()
- _resolve_agent_ai_config()
- _strict_json_messages()

从 llm_agents.py 拆分而来。
"""

from dataclasses import dataclass, asdict
from typing import Tuple, Optional, List


# ============== Agent 配置 ==============


@dataclass
class AgentConfig:
    key: str = ""
    name: str = ""
    avatar: str = "🤖"
    role: str = ""
    instruction: str = ""
    provider: str = "deepseek"
    model: str = "deepseek-chat"
    api_key: str = ""
    base_url: str = ""
    inherit_global_key: bool = True
    enabled: bool = True
    card_style: str = "default"


# (vendor, model)
AGENT_MODEL_CONFIG = {
    "fundamental": ("claude", "claude-sonnet-4-5"),
    "technical": ("gpt", "gpt-5.2"),
    "sentiment": ("deepseek", "deepseek-chat"),
    "risk": ("sensenova", "deepseek-v4-flash"),
    "retail": ("mimo", "mimo-v2.5-pro"),
    "chairman": ("claude", "claude-opus-4-7"),
}

# 全局兜底（任一 Agent 失败时使用）
FALLBACK_VENDOR_MODEL = ("deepseek", "deepseek-chat")


# ============== Agent 角色提示词 ==============

AGENT_PROMPTS = {
    "fundamental": {
        "name": "🏛️ 基本面分析师",
        "role": "你是一位资深基本面分析师，擅长从财务、估值、行业地位、护城河等角度评估个股。",
        "instruction": """请基于提供的股票数据，从基本面角度进行专业分析。
要求：
1. 识别公司所属行业及竞争地位
2. 评估当前估值水平（以行业惯例视角）
3. 给出明确信号：买入 / 卖出 / 观望
4. 给出 0-100 的置信度
5. 用 100 字内说明核心理由

严格按 JSON 返回（必须用双引号，不能有任何前后说明）：
{"signal": "买入|卖出|观望", "confidence": 75, "reason": "理由...", "evidence": [{"type": "fund_flow", "claim": "近5日主力净流入2.3亿", "data_date": "2026-05-16"}], "invalid_if": "跌破MA20且主力连续3日流出", "risks": ["白酒板块情绪偏弱"]}""",
    },
    "technical": {
        "name": "📐 技术分析师",
        "role": "你是一位顶级技术分析师，精通 K 线形态、均线系统、MACD、RSI、量价关系。",
        "instruction": """请基于提供的技术指标数据进行专业分析。
要求：
1. 综合 K 线、均线、MACD、RSI、成交量给出判断
2. 识别当前所处趋势阶段（上升/下降/震荡）
3. 给出明确信号：买入 / 卖出 / 观望
4. 给出 0-100 的置信度
5. 用 100 字内说明技术依据

严格按 JSON 返回（必须用双引号，不能有任何前后说明）：
{"signal": "买入|卖出|观望", "confidence": 75, "reason": "理由...", "evidence": [{"type": "fund_flow", "claim": "近5日主力净流入2.3亿", "data_date": "2026-05-16"}], "invalid_if": "跌破MA20且主力连续3日流出", "risks": ["白酒板块情绪偏弱"]}""",
    },
    "sentiment": {
        "name": "💬 舆情/情绪分析师",
        "role": "你是市场情绪与行为金融学专家，擅长解读财经新闻、研报评级、主力资金动向、散户行为。",
        "instruction": """请综合提供的【量价情绪数据】+【实时新闻摘要】+【研报评级】+【资金流向】进行分析。
要求：
1. 优先看主力资金动向：主力（超大单+大单）净流入是真金白银的看多信号，净流出是看空信号
2. 注意分歧信号：若新闻面利好但主力流出，往往是机构借利好出货；若新闻平淡但主力悄悄流入，可能是底部吸筹
3. 散户（小单）与机构（超大单）方向相反才是有效信号
4. 结合换手率、量比推断市场情绪（恐慌/贪婪/平静）
5. 关注研报评级共识
6. 给出明确信号：买入 / 卖出 / 观望
7. 给出 0-100 的置信度
8. 用 100 字内说明情绪逻辑，必须引用具体的资金流向数字或新闻证据

严格按 JSON 返回（必须用双引号，不能有任何前后说明）：
{"signal": "买入|卖出|观望", "confidence": 75, "reason": "理由...", "evidence": [{"type": "fund_flow", "claim": "近5日主力净流入2.3亿", "data_date": "2026-05-16"}], "invalid_if": "跌破MA20且主力连续3日流出", "risks": ["白酒板块情绪偏弱"]}""",
    },
    "risk": {
        "name": "⚠️ 风险控制师",
        "role": "你是机构风控负责人，注重下行风险、波动率、最大回撤、仓位管理、资金面恶化信号。",
        "instruction": """请基于波动率、近期回撤、流动性、主力资金流向等数据评估风险。
要求：
1. 主力持续净流出（连续 3 日以上）是重大风险信号
2. 大盘主力流出会拖累所有个股
3. 给出当前风险等级（低/中/高）
4. 提示主要风险点
5. 给出明确信号：买入 / 卖出 / 观望（从风控视角）
6. 给出 0-100 的置信度
7. 用 100 字内说明风险逻辑

严格按 JSON 返回（必须用双引号，不能有任何前后说明）：
{"signal": "买入|卖出|观望", "confidence": 75, "reason": "理由...", "evidence": [{"type": "fund_flow", "claim": "近5日主力净流入2.3亿", "data_date": "2026-05-16"}], "invalid_if": "跌破MA20且主力连续3日流出", "risks": ["白酒板块情绪偏弱"]}""",
    },
    "retail": {
        "name": "🏪 散户行为分析师",
        "role": "你是研究 A 股散户心理与跟风行为的专家，擅长识别『逼空-诱多-杀跌-恐慌』等散户心态阶段。",
        "instruction": """请从散户行为视角分析此标的当前所处的群体心理阶段。
要求：
1. 散户（小单）大幅净流入 + 主力流出 = 散户接盘风险
2. 散户净流出 + 主力流入 = 底部洗盘后的进场机会
3. 同向（散户和主力一起买/卖）= 趋势延续概率高
4. 高换手 + 单日大涨 = 情绪过热，警惕冲高回落
5. 给出明确信号：买入 / 卖出 / 观望
6. 给出 0-100 的置信度
7. 用 100 字内说明散户心理判断，必须给出具体的散户/主力净流向对照

【极其重要】你必须只输出一个合法的 JSON 对象，不要任何前后说明、markdown 代码块或额外文字。
正确示例（严格复制此格式，仅替换值）：
{"signal": "买入", "confidence": 78, "reason": "散户净流出12亿而主力净流入8亿，典型底部洗盘特征，后续看涨", "evidence": [{"type": "fund_flow", "claim": "主力净流入8亿 / 散户净流出12亿", "data_date": "2026-05-16"}], "invalid_if": "散户由流出转为大幅流入且主力同步流出", "risks": ["板块整体情绪转弱"]}
{"signal": "观望", "confidence": 55, "reason": "散户与主力同向小幅流入，趋势不明确，建议观望", "evidence": [{"type": "fund_flow", "claim": "主力/散户同向流入但量级有限", "data_date": "2026-05-16"}], "invalid_if": "出现明显的主力-散户反向信号", "risks": ["市场情绪不确定"]}

你现在只输出这一个 JSON 对象：""",
    },
}


# ============== Agent 配置工具函数 ==============


def get_default_agent_configs(include_chairman: bool = False) -> List[dict]:
    """从硬编码默认 Agent 生成可编辑配置列表。"""
    keys = ["fundamental", "technical", "sentiment", "risk", "retail"]
    if include_chairman:
        keys.append("chairman")
    configs = []
    for key in keys:
        if key == "chairman":
            vendor, model = AGENT_MODEL_CONFIG.get("chairman", FALLBACK_VENDOR_MODEL)
            configs.append(
                asdict(
                    AgentConfig(
                        key="chairman",
                        name="🎩 投资委员会主席",
                        avatar="🎩",
                        role="你是一位严谨克制的投资委员会主席，注重风控与可执行性。",
                        instruction="综合所有 Agent 观点，输出最终投资建议、支持论据、风险和操作计划。",
                        provider=vendor,
                        model=model,
                        inherit_global_key=True,
                        enabled=True,
                        card_style="value",
                    )
                )
            )
            continue
        prompt = AGENT_PROMPTS[key]
        vendor, model = AGENT_MODEL_CONFIG.get(key, FALLBACK_VENDOR_MODEL)
        configs.append(
            asdict(
                AgentConfig(
                    key=key,
                    name=prompt.get("name", key),
                    avatar=str(prompt.get("name", "🤖"))[:2].strip() or "🤖",
                    role=prompt.get("role", ""),
                    instruction=prompt.get("instruction", ""),
                    provider=vendor,
                    model=model,
                    enabled=True,
                    card_style={
                        "fundamental": "value",
                        "technical": "technical",
                        "sentiment": "growth",
                        "risk": "risk",
                        "retail": "macro",
                    }.get(key, "default"),
                )
            )
        )
    return configs


def _agent_config_from_dict(raw: dict) -> AgentConfig:
    return AgentConfig(
        key=(raw.get("key") or "custom_agent").strip().replace(" ", "_"),
        name=raw.get("name", "自定义 Agent"),
        avatar=raw.get("avatar", "🤖"),
        role=raw.get("role", "你是一位专业投资分析 Agent。"),
        instruction=raw.get(
            "instruction", "请基于市场简报输出投资信号、置信度和理由。"
        ),
        provider=raw.get("provider", "deepseek"),
        model=raw.get("model", "deepseek-chat"),
        api_key=raw.get("api_key", ""),
        base_url=raw.get("base_url", ""),
        inherit_global_key=bool(raw.get("inherit_global_key", True)),
        enabled=bool(raw.get("enabled", True)),
        card_style=raw.get("card_style", "default"),
    )


def _resolve_agent_ai_config(
    cfg: AgentConfig, global_ai_settings: Optional[dict] = None
) -> Tuple[str, str, str, str]:
    global_ai_settings = global_ai_settings or {}
    if cfg.inherit_global_key and global_ai_settings.get("use_unified_key", True):
        return (
            global_ai_settings.get("provider") or cfg.provider,
            global_ai_settings.get("model") or cfg.model,
            global_ai_settings.get("api_key", ""),
            global_ai_settings.get("base_url", ""),
        )
    return cfg.provider, cfg.model, cfg.api_key, cfg.base_url


def _strict_json_messages(messages: list) -> list:
    return messages + [
        {
            "role": "user",
            "content": (
                "重要：请只返回一个合法 JSON 对象，不要 Markdown，不要解释，不要代码块。"
                "字段必须包含 signal、confidence、reason；可选包含 evidence(数组,每项 {type,claim,data_date})、"
                "invalid_if(字符串,失效条件)、risks(字符串数组)。"
            ),
        }
    ]
