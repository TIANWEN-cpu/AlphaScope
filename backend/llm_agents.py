"""
真实 LLM 多 Agent 金融分析模块（多供应商异构版本 v2.0）

策略：每个 Agent 使用最适合其任务的模型，避免单一模型偏见。
- 🏛️ 基本面 → Claude Sonnet 4.5（深度推理 + 中文友好）
- 📐 技术 → GPT-5.2（结构化模式识别）
- 💬 舆情/情绪 → DeepSeek Chat（中文原生 + 大量新闻处理性价比）
- ⚠️ 风险 → SenseNova DeepSeek-V4-Flash（不同推理引擎，避免同源偏见）
- 🏪 散户行为 → Mimo v2.5-Pro（小米自研，提供差异化视角）
- 🎩 主席 → Claude Opus 4.7（顶级综合判断）

v2.0 新增：
- Provider 化架构（参考 CherryStudio）
- 支持从 providers.yaml 加载配置
- 支持细粒度 API Key（每个 agent 可单独配置）
- 向后兼容旧的 VENDORS 配置
"""
import os
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, Tuple, Optional, List
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
import yaml

from project_paths import CONFIG_DIR, ENV_FILE

load_dotenv(ENV_FILE)

# v0.8: 统一 schema 校验。若校验模块缺失,使用恒等函数兜底,保持向后兼容。
try:
    from validators import validate_agent_output as _validate_agent_output  # type: ignore
except Exception:  # pragma: no cover
    def _validate_agent_output(data):  # type: ignore[no-redef]
        if not isinstance(data, dict):
            return {}
        return data


# ============== Provider 配置加载 ==============
def _resolve_env(value: str) -> str:
    """解析环境变量占位符 ${VAR_NAME}"""
    if not value or not isinstance(value, str):
        return value
    import re
    def replacer(m):
        var_name = m.group(1)
        return os.getenv(var_name, "")
    return re.sub(r'\$\{([^}]+)\}', replacer, value)


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
            # 确保 api_host 以 /v1 结尾（OpenAI 兼容格式）
            if api_host and not api_host.endswith("/v1"):
                api_host = api_host.rstrip("/") + "/v1"
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
        "base_url": (os.getenv("CLAUDE_BASE_URL", "") + "/v1") if os.getenv("CLAUDE_BASE_URL") else None,
        "supports_json_mode": False,  # 第三方代理不一定支持，统一走文本+正则解析更稳
        "label": "Claude",
    },
    "gpt": {
        "api_key": os.getenv("GPT_API_KEY"),
        "base_url": (os.getenv("GPT_BASE_URL", "") + "/v1") if os.getenv("GPT_BASE_URL") else None,
        "supports_json_mode": True,
        "label": "GPT",
    },
    "mimo": {
        "api_key": os.getenv("MIMO_API_KEY"),
        "base_url": (os.getenv("MIMO_BASE_URL", "") + "/v1") if os.getenv("MIMO_BASE_URL") else None,
        "supports_json_mode": False,
        "label": "Mimo",
    },
    "sensenova": {
        "api_key": os.getenv("SENSENOVA_API_KEY"),
        "base_url": os.getenv("SENSENOVA_BASE_URL"),
        "supports_json_mode": False,
        "label": "SenseNova",
    },
    # v0.7 新增：Kimi（Moonshot），仅供 AI 咨询切换使用，不进入 5 Agent 模型映射
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


# ============== 细粒度 API Key 支持 ==============
def get_vendor_config(vendor: str, api_key: Optional[str] = None, base_url: Optional[str] = None) -> Dict[str, Any]:
    """
    获取供应商配置。
    如果提供了 api_key/base_url，则创建临时配置（细粒度 Key / 自定义 OpenAI-compatible Base URL）。
    """
    base = VENDORS.get(vendor) or VENDORS.get("deepseek")
    if not base:
        return None
    if api_key or base_url:
        normalized_base_url = (base_url or base.get("base_url") or "").strip().rstrip("/")
        if normalized_base_url and not normalized_base_url.endswith("/v1"):
            normalized_base_url += "/v1"
        return {
            **base,
            "api_key": api_key or base.get("api_key"),
            "base_url": normalized_base_url,
        }
    return base


def create_client(vendor: str, api_key: Optional[str] = None, base_url: Optional[str] = None) -> OpenAI:
    """创建 OpenAI 兼容客户端，支持细粒度 API Key 与自定义 Base URL"""
    cfg = get_vendor_config(vendor, api_key, base_url)
    if not cfg or not cfg["api_key"] or not cfg["base_url"]:
        raise RuntimeError(f"供应商 {vendor} 未配置完整")
    return OpenAI(
        api_key=cfg["api_key"],
        base_url=cfg["base_url"],
        timeout=60.0,
    )


# ============== 客户端缓存 ==============
_client_cache: Dict[str, OpenAI] = {}


def get_client(vendor: str, api_key: Optional[str] = None, base_url: Optional[str] = None) -> OpenAI:
    """
    获取客户端。
    如果提供了 api_key/base_url，则创建独立客户端（不走缓存，避免 Key/URL 混淆）。
    """
    if api_key or base_url:
        return create_client(vendor, api_key, base_url)
    
    cache_key = vendor
    if cache_key in _client_cache:
        return _client_cache[cache_key]
    
    client = create_client(vendor)
    _client_cache[cache_key] = client
    return client


def clear_client_cache():
    """清理客户端缓存（热重载后调用）"""
    global _client_cache
    _client_cache = {}


# ============== Agent → 模型映射 ==============
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
    "technical":   ("gpt", "gpt-5.2"),
    "sentiment":   ("deepseek", "deepseek-chat"),
    "risk":        ("sensenova", "deepseek-v4-flash"),
    "retail":      ("mimo", "mimo-v2.5-pro"),
    "chairman":    ("claude", "claude-opus-4-7"),
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


def build_market_brief(stock_data: Dict[str, Any]) -> str:
    """把数据打包成一段简洁的市场简报"""
    base = f"""
【标的】{stock_data['name']} ({stock_data['symbol']})

【价格信息】
- 最新价: ¥{stock_data['close']:.2f}
- 当日涨跌: {stock_data['day_change']:+.2f}%
- 区间涨跌（{stock_data['days']}日）: {stock_data['period_change']:+.2f}%
- 区间最高/最低: ¥{stock_data['period_high']:.2f} / ¥{stock_data['period_low']:.2f}

【技术指标】
- MA5: {stock_data.get('ma5', 'N/A')}
- MA20: {stock_data.get('ma20', 'N/A')}
- MA60: {stock_data.get('ma60', 'N/A')}
- MACD: {stock_data.get('macd', 'N/A')}
- DIF/DEA: {stock_data.get('dif', 'N/A')} / {stock_data.get('dea', 'N/A')}
- RSI(14): {stock_data.get('rsi', 'N/A')}

【量价数据】
- 当日成交量: {stock_data['volume']:,.0f} 手
- 区间成交额: {stock_data['total_amount']:.1f} 亿元
- 当日换手率: {stock_data.get('turnover', 0):.2f}%
- 近5日量比: {stock_data.get('vol_ratio', 1):.2f}
- 日波动率: {stock_data.get('volatility', 0):.2f}%

【基本面摘要】
{stock_data.get('fundamentals', '暂无')}
"""
    if stock_data.get("related_news_brief"):
        base += f"\n【个股相关资讯（最近）】\n{stock_data['related_news_brief']}\n"
    if stock_data.get("announcements_brief"):
        # v0.10:个股公告往往比新闻更硬,放在新闻之前能拉高其权重
        base += f"\n【个股近 30 天公告(已分类)】\n{stock_data['announcements_brief']}\n"
    if stock_data.get("industry_news_brief"):
        base += f"\n【行业相关动态】\n{stock_data['industry_news_brief']}\n"
    if stock_data.get("concepts_brief"):
        base += f"\n【关联概念与板块动态】\n{stock_data['concepts_brief']}\n"
    if stock_data.get("market_news_brief"):
        base += f"\n【大盘宏观资讯】\n{stock_data['market_news_brief']}\n"
    if stock_data.get("research_brief"):
        base += f"\n【机构研报评级】\n{stock_data['research_brief']}\n"
    if stock_data.get("stock_fund_brief"):
        base += f"\n{stock_data['stock_fund_brief']}\n"
    if stock_data.get("market_fund_brief"):
        base += f"\n{stock_data['market_fund_brief']}\n"
    return base


def _extract_json(text: str) -> dict:
    """从 LLM 返回的文本里稳健地提取 JSON 对象，兼容 Mimo 等模型的说明文字/尾逗号。"""
    if not text:
        return {}

    def _loads(candidate: str) -> dict:
        candidate = (candidate or "").strip()
        candidate = candidate.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
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
    # 3) 抓第一个 { ... } 平衡块
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        try:
            return _loads(m.group(0))
        except Exception:
            pass
    return {}


def _call_with(vendor: str, model: str, messages: list, json_mode: bool = False, max_tokens: int = 400, temperature: float = 0.3, api_key: Optional[str] = None, base_url: Optional[str] = None) -> str:
    """
    统一调用接口，支持细粒度 API Key 与 Base URL。
    自动处理 json_mode 不支持的情况。
    """
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
    return resp.choices[0].message.content or ""


# ============== 自定义 Agent 配置 ==============
def get_default_agent_configs(include_chairman: bool = False) -> List[dict]:
    """从硬编码默认 Agent 生成可编辑配置列表。"""
    keys = ["fundamental", "technical", "sentiment", "risk", "retail"]
    if include_chairman:
        keys.append("chairman")
    configs = []
    for key in keys:
        if key == "chairman":
            vendor, model = AGENT_MODEL_CONFIG.get("chairman", FALLBACK_VENDOR_MODEL)
            configs.append(asdict(AgentConfig(
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
            )))
            continue
        prompt = AGENT_PROMPTS[key]
        vendor, model = AGENT_MODEL_CONFIG.get(key, FALLBACK_VENDOR_MODEL)
        configs.append(asdict(AgentConfig(
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
        )))
    return configs


def _agent_config_from_dict(raw: dict) -> AgentConfig:
    return AgentConfig(
        key=(raw.get("key") or "custom_agent").strip().replace(" ", "_"),
        name=raw.get("name", "自定义 Agent"),
        avatar=raw.get("avatar", "🤖"),
        role=raw.get("role", "你是一位专业投资分析 Agent。"),
        instruction=raw.get("instruction", "请基于市场简报输出投资信号、置信度和理由。"),
        provider=raw.get("provider", "deepseek"),
        model=raw.get("model", "deepseek-chat"),
        api_key=raw.get("api_key", ""),
        base_url=raw.get("base_url", ""),
        inherit_global_key=bool(raw.get("inherit_global_key", True)),
        enabled=bool(raw.get("enabled", True)),
        card_style=raw.get("card_style", "default"),
    )


def _resolve_agent_ai_config(cfg: AgentConfig, global_ai_settings: Optional[dict] = None) -> Tuple[str, str, str, str]:
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
    return messages + [{
        "role": "user",
        "content": (
            "重要：请只返回一个合法 JSON 对象，不要 Markdown，不要解释，不要代码块。"
            "字段必须包含 signal、confidence、reason；可选包含 evidence(数组,每项 {type,claim,data_date})、"
            "invalid_if(字符串,失效条件)、risks(字符串数组)。"
        ),
    }]


def run_custom_agent(agent_raw: dict, market_brief: str, api_key: Optional[str] = None, global_ai_settings: Optional[dict] = None) -> Dict[str, Any]:
    """运行单个页面自定义 Agent。"""
    cfg = _agent_config_from_dict(agent_raw)
    resolved_provider, resolved_model, resolved_key, resolved_base_url = _resolve_agent_ai_config(cfg, global_ai_settings)
    if api_key:
        resolved_key = api_key
    messages = [
        {"role": "system", "content": cfg.role},
        {"role": "user", "content": (
            f"{cfg.instruction}\n\n{market_brief}\n\n"
            "【输出要求】请用 JSON 返回,字段:\n"
            "- signal: 买入|卖出|观望\n"
            "- confidence: 0-100 整数\n"
            "- reason: 100 字内核心理由\n"
            "- evidence: 数组,每条 {type, claim, data_date},type 取自 fund_flow/technical/fundamental/news/research/macro/sentiment/shareholder/other\n"
            "- invalid_if: 简短的失效条件\n"
            "- risks: 1-3 条主要风险(字符串数组)\n"
        )},
    ]
    primary_vendor = resolved_provider
    last_err = None
    for vd, md, bu in [(resolved_provider, resolved_model, resolved_base_url), (FALLBACK_VENDOR_MODEL[0], FALLBACK_VENDOR_MODEL[1], "")]:
        try:
            mtokens = 2048 if vd == "mimo" else 500
            call_messages = _strict_json_messages(messages) if vd == "mimo" else messages
            text = _call_with(vd, md, call_messages, json_mode=True, max_tokens=mtokens, temperature=0.3, api_key=resolved_key, base_url=bu)
            data = _extract_json(text)
            if not data or not data.get("signal"):
                retry_messages = messages + [
                    {"role": "assistant", "content": text or ""},
                    {"role": "user", "content": "请只输出 JSON：{\"signal\": \"买入|卖出|观望\", \"confidence\": 75, \"reason\": \"理由\", \"evidence\": [], \"invalid_if\": \"\", \"risks\": []}"},
                ]
                if vd == "mimo":
                    retry_messages = _strict_json_messages(retry_messages)
                text = _call_with(vd, md, retry_messages, json_mode=True, max_tokens=mtokens, temperature=0.1, api_key=resolved_key, base_url=bu)
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
                "primary_vendor": VENDORS.get(primary_vendor, {}).get("label", primary_vendor),
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
    """并行运行任意数量的页面自定义 Agent;并可选地批量调用 Critic 审稿。

    Args:
        enable_critic: 默认 True;Critic 失败不会影响主流程,只会在结果里返回 critic.ok=False。
                       想完全关闭审稿(例如 CI 单测、低成本回归)传 False。
    """
    brief = build_market_brief(stock_data)
    api_keys = api_keys or {}
    active = [_agent_config_from_dict(a) for a in agent_configs if bool(a.get("enabled", True))]
    if not active:
        return {
            "agents": {},
            "summary": {"final": "建议观望", "buy": 0, "sell": 0, "hold": 0, "avg_confidence": 0},
            "brief": brief,
            "agent_order": [],
            "critic": None,
        }
    results = {}
    with ThreadPoolExecutor(max_workers=len(active)) as ex:
        futures = {ex.submit(run_custom_agent, asdict(cfg), brief, api_keys.get(cfg.key), global_ai_settings): cfg.key for cfg in active}
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

    # v0.9: 批量审稿。只有当至少一个 agent 调用成功(ok=True)时才跑,否则会浪费一次调用。
    critic_block = None
    if enable_critic and any(r.get("ok") for r in results.values()):
        try:
            from critic import run_batch_critic  # 延迟导入,避免循环依赖
            critic_settings = (global_ai_settings or {}).get("critic") or {}
            inherit = bool(critic_settings.get(
                "inherit_global_key",
                (global_ai_settings or {}).get("use_unified_key", True),
            ))
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
            # 把 review 摊回到每个 agent 的结果上,方便归档与渲染
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
        "summary": {"final": final, "buy": buy, "sell": sell, "hold": hold, "avg_confidence": avg_conf},
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
        rows.append((cfg.key, cfg.name, VENDORS.get(cfg.provider, {}).get("label", cfg.provider), cfg.model))
    return rows


# v0.7 公共别名：所有新模块统一通过 call_llm 调用，保留 _call_with 兼容旧代码
call_llm = _call_with


def run_one_agent(agent_key: str, market_brief: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    运行单个 Agent,含 fallback 与稳健 JSON 解析。
    支持细粒度 API Key。
    """
    cfg = AGENT_PROMPTS[agent_key]
    vendor, model = AGENT_MODEL_CONFIG.get(agent_key, FALLBACK_VENDOR_MODEL)
    primary_vendor = vendor  # 记录主厂商,用于判断是否走了兜底

    messages = [
        {"role": "system", "content": cfg["role"]},
        {"role": "user", "content": f"{cfg['instruction']}\n\n{market_brief}"},
    ]

    last_err = None
    for vd, md in [(vendor, model), FALLBACK_VENDOR_MODEL]:
        try:
            # Mimo 模型需要更大的 max_tokens,避免输出被截断导致 JSON 解析失败
            mtokens = 2048 if vd == "mimo" else 600
            text = _call_with(vd, md, messages, json_mode=True, max_tokens=mtokens, temperature=0.3, api_key=api_key)
            data = _extract_json(text)
            if not data or not data.get("signal"):
                # 同一供应商再补一次以纯 JSON 回复
                retry_tokens = 2048 if vd == "mimo" else 400
                text = _call_with(vd, md, messages + [
                    {"role": "assistant", "content": text},
                    {"role": "user", "content": "请只输出符合格式的 JSON 对象,不要任何前后说明。"},
                ], json_mode=True, max_tokens=retry_tokens, temperature=0.1, api_key=api_key)
                data = _extract_json(text)

            # 如果当前供应商两次都没拿到信号,且不是兜底供应商,尝试切换到兜底
            if (not data or not data.get("signal")) and (vd, md) != FALLBACK_VENDOR_MODEL:
                last_err = f"{VENDORS[vd]['label']} 未返回有效 JSON"
                continue  # 下一个 vendor

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
                "vendor": VENDORS[vd]["label"],
                "model": md,
                "primary_vendor": VENDORS[primary_vendor]["label"],
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


def run_all_agents(stock_data: Dict[str, Any], include_retail: bool = True, api_keys: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    并行调用全部 Agent（4 核心 + 可选散户行为）。
    api_keys: {agent_key: api_key} 细粒度 API Key 映射。
    """
    brief = build_market_brief(stock_data)
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

    # 决策规则：相对多数；含散户共 5 票，需要 ≥3 票
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


def summarize_with_chairman(results: Dict[str, Any], stock_name: str, api_key: Optional[str] = None) -> str:
    """
    主席角色：综合所有 Agent 给出最终投资建议（用 Claude Opus 顶级模型）。
    支持细粒度 API Key。
    """
    agents_text = "\n\n".join([
        f"【{r['name']} · {r.get('vendor','?')}/{r.get('model','?')}】信号: {r['signal']} | 置信度: {r['confidence']}%\n理由: {r['reason']}"
        for r in results["agents"].values()
    ])

    prompt = f"""你是投资委员会主席。下面是分析师团队对 {stock_name} 的独立观点（每位使用不同模型，避免同质化偏见）：

{agents_text}

汇总投票: 买入 {results['summary']['buy']} / 卖出 {results['summary']['sell']} / 观望 {results['summary']['hold']}

请综合所有观点，输出一份**专业、克制、可执行**的最终建议，包括：
1. 一句话核心结论
2. 主要支持论据（2-3 点）
3. 主要风险与反对意见（1-2 点）
4. 操作建议（仓位、止损位、关注信号）

字数控制在 280 字以内，使用 markdown 格式。"""

    vendor, model = AGENT_MODEL_CONFIG["chairman"]
    messages = [
        {"role": "system", "content": "你是一位严谨克制的投资委员会主席，注重风控与可执行性。"},
        {"role": "user", "content": prompt},
    ]
    for vd, md in [(vendor, model), FALLBACK_VENDOR_MODEL]:
        try:
            return _call_with(vd, md, messages, json_mode=False, max_tokens=700, temperature=0.4, api_key=api_key)
        except Exception as e:
            last = f"主席总结生成失败 ({VENDORS[vd]['label']}/{md}): {e}"
            continue
    return last


def get_agent_model_table() -> list:
    """供 UI 显示：返回 [(agent_name, vendor_label, model)] """
    rows = []
    for key, (vendor, model) in AGENT_MODEL_CONFIG.items():
        if key == "chairman":
            name = "🎩 投资委员会主席"
        else:
            name = AGENT_PROMPTS[key]["name"]
        rows.append((key, name, VENDORS[vendor]["label"], model))
    return rows


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
        {"id": m_id, "name": m.get("name", m_id), "contextWindow": m.get("contextWindow", "未知")}
        for m_id, m in prov.get("models", {}).items()
    ]


if __name__ == "__main__":
    print("=" * 70)
    print("Agent 模型分配：")
    for k, name, vendor, model in get_agent_model_table():
        print(f"  {name:<28} → {vendor}/{model}")
    print("=" * 70)

    sample = {
        "name": "贵州茅台", "symbol": "600519",
        "close": 1680.50, "day_change": 1.25, "period_change": 8.6,
        "period_high": 1750, "period_low": 1520, "days": 120,
        "ma5": "1665.30", "ma20": "1640.20", "ma60": "1620.10",
        "macd": "5.2", "dif": "12.3", "dea": "7.1", "rsi": "62.5",
        "volume": 28500, "total_amount": 350.5, "turnover": 0.23,
        "vol_ratio": 1.35, "volatility": 1.85,
        "fundamentals": "白酒龙头, 高端市占第一, 毛利率 91%, ROE 30%",
    }
    import time
    t0 = time.time()
    res = run_all_agents(sample, include_retail=True)
    print(f"\n[5 Agent 并行] 用时 {time.time()-t0:.1f}s\n")
    for r in res["agents"].values():
        flag = "OK" if r["ok"] else "FAIL"
        print(f"{r['name']:<24} [{r['vendor']}/{r['model']}] {flag}")
        print(f"  → {r['signal']} ({r['confidence']}%)  {r['reason'][:80]}")
    s = res["summary"]
    print(f"\n[投票] 买{s['buy']}/卖{s['sell']}/观{s['hold']} → {s['final']} | 均值 {s['avg_confidence']:.0f}%")
    print("\n[主席总结]")
    print(summarize_with_chairman(res, sample["name"]))
