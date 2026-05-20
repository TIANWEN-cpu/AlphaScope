"""合规与风险提示层

为投资分析输出添加风险提示、免责声明和脱敏处理。
"""

from __future__ import annotations

import logging
import re
from datetime import datetime

logger = logging.getLogger(__name__)

INVESTMENT_DISCLAIMER = """
---
**风险提示**: 以上分析仅供参考，不构成任何投资建议。投资有风险，入市需谨慎。
AI 分析基于历史数据和模型推断，可能存在偏差。请结合自身情况独立判断。
数据来源: 公开市场数据，分析日期: {date}
"""

# 需要免责声明的分析模式
_DISCLAIMER_MODES = {"standard", "deep", "expert"}

# 金融禁用词 — 确定性投资建议
FORBIDDEN_WORDS = [
    "必涨",
    "稳赚",
    "无风险",
    "保证收益",
    "满仓",
    "确定买入",
    "一定涨",
    "包赚",
]

# 替代表达
REPLACEMENTS = {
    "必涨": "倾向上涨",
    "稳赚": "有盈利潜力",
    "无风险": "风险较低",
    "保证收益": "预期收益",
    "满仓": "适当仓位",
    "确定买入": "考虑买入",
    "一定涨": "可能上涨",
    "包赚": "有获利空间",
}

# API key 模式（用于脱敏）
_API_KEY_PATTERNS = [
    re.compile(r"(sk-[a-zA-Z0-9]{20,})"),  # OpenAI-style
    re.compile(r"(AKIA[A-Z0-9]{16})"),  # AWS-style
    re.compile(r"(Bearer\s+[a-zA-Z0-9._\-]{20,})", re.IGNORECASE),
]


def needs_disclaimer(mode: str) -> bool:
    """判断分析模式是否需要免责声明"""
    return mode in _DISCLAIMER_MODES


def wrap_with_disclaimer(content: str, mode: str) -> str:
    """追加免责声明（幂等，不重复追加）"""
    if not needs_disclaimer(mode):
        return content
    if "风险提示" in content[-300:]:
        return content
    return content + INVESTMENT_DISCLAIMER.format(
        date=datetime.now().strftime("%Y-%m-%d")
    )


def sanitize_output(content: str) -> str:
    """移除输出中可能泄露的 API key"""
    result = content
    for pattern in _API_KEY_PATTERNS:
        result = pattern.sub("[REDACTED]", result)
    return result


def check_forbidden_words(content: str) -> tuple[str, list[str]]:
    """检查并替换金融禁用词。

    Returns:
        (替换后的内容, 检测到的禁用词列表)
    """
    found = []
    result = content
    for word in FORBIDDEN_WORDS:
        if word in result:
            found.append(word)
            replacement = REPLACEMENTS.get(word, "****")
            result = result.replace(word, replacement)
            logger.warning("合规: 检测到禁用词 '%s'，已替换为 '%s'", word, replacement)
    return result, found


def validate_analysis_output(data: dict) -> dict:
    """校验分析输出结构，确保包含必要的风险字段"""
    if not isinstance(data, dict):
        return data

    # 确保 signal 字段标准化
    signal = data.get("signal", data.get("action", ""))
    signal_map = {
        "买入": "buy",
        "卖出": "sell",
        "观望": "hold",
        "减持": "reduce",
        "增持": "increase",
        "buy": "buy",
        "sell": "sell",
        "hold": "hold",
        "reduce": "reduce",
    }
    if signal:
        data["signal"] = signal_map.get(signal, signal)

    # 确保 confidence 在合理范围
    conf = data.get("confidence", 50)
    try:
        conf = float(conf)
    except (ValueError, TypeError):
        conf = 50
    data["confidence"] = max(0, min(100, conf))

    # 确保 risks 是列表
    risks = data.get("risks", [])
    if isinstance(risks, str):
        data["risks"] = [risks]
    elif not isinstance(risks, list):
        data["risks"] = []

    # 确保 evidence 是列表
    evidence = data.get("evidence", [])
    if isinstance(evidence, str):
        data["evidence"] = [{"claim": evidence}]
    elif not isinstance(evidence, list):
        data["evidence"] = []

    return data
