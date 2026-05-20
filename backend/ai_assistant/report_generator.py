"""AI 对话报告生成器

将对话历史和分析结果导出为 Markdown 研究报告。
"""

from __future__ import annotations

from typing import List

from .compliance import wrap_with_disclaimer


def generate_report(
    conversation: dict,
    messages: List[dict],
    include_evidence: bool = True,
) -> str:
    """生成完整 Markdown 研究报告

    结构：
    - 标题：对话标题、日期、股票、模式、模型
    - 对话记录
    - 证据链（如有）
    - 合规免责声明
    """
    lines = []

    # 标题
    title = conversation.get("title", "AI 分析对话")
    stock_symbol = conversation.get("stock_symbol", "")
    stock_name = conversation.get("stock_name", "")
    mode = conversation.get("mode", "free")
    provider = conversation.get("provider", "")
    model = conversation.get("model", "")
    created_at = conversation.get("created_at", "")

    mode_labels = {
        "free": "自由问答",
        "standard": "标准分析",
        "deep": "深度分析",
        "expert": "专家团圆桌",
    }

    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"> 创建时间: {created_at}  ")
    if stock_symbol:
        lines.append(f"> 标的: {stock_name}({stock_symbol})  ")
    lines.append(f"> 分析模式: {mode_labels.get(mode, mode)}  ")
    lines.append(f"> 模型: {provider} / `{model}`  ")
    lines.append(f"> 对话轮次: {sum(1 for m in messages if m.get('role') == 'user')}")
    lines.append("")
    lines.append("---")
    lines.append("")

    # 对话记录
    lines.append("## 对话记录")
    lines.append("")

    all_evidence = []
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")
        timestamp = msg.get("timestamp", "")
        meta = msg.get("metadata", {})
        if isinstance(meta, str):
            import json

            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}

        if role == "system":
            continue
        elif role == "user":
            lines.append(f"### 用户  `{timestamp}`")
            lines.append("")
            lines.append(content)
            lines.append("")
        elif role == "assistant":
            msg_mode = meta.get("mode", mode)
            mode_badge = mode_labels.get(msg_mode, msg_mode)
            lines.append(f"### 助手 [{mode_badge}]  `{timestamp}`")
            lines.append("")
            lines.append(content)
            lines.append("")
            # 收集证据
            if include_evidence and meta.get("evidence"):
                all_evidence.extend(meta["evidence"])
        elif role == "analysis":
            lines.append(f"### 分析结果  `{timestamp}`")
            lines.append("")
            lines.append(content)
            lines.append("")
            if include_evidence and meta.get("evidence"):
                all_evidence.extend(meta["evidence"])

        lines.append("---")
        lines.append("")

    # 证据链
    if all_evidence:
        lines.append("## 证据链")
        lines.append("")
        for i, ev in enumerate(all_evidence, 1):
            claim = ev.get("claim", ev.get("title", ""))
            source = ev.get("source", ev.get("source_name", ""))
            ev_type = ev.get("type", ev.get("evidence_type", ""))
            conf = ev.get("confidence", "")
            lines.append(f"{i}. **[{ev_type}]** {claim}")
            if source:
                lines.append(f"   - 来源: {source}")
            if conf:
                lines.append(f"   - 置信度: {conf}")
            lines.append("")

    # 免责声明
    mode_val = conversation.get("mode", "free")
    full_text = "\n".join(lines)
    full_text = wrap_with_disclaimer(full_text, mode_val)

    return full_text


def generate_summary(messages: List[dict]) -> str:
    """从对话消息中提取关键结论摘要"""
    summaries = []
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")
        meta = msg.get("metadata", {})
        if isinstance(meta, str):
            import json

            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}

        if role == "assistant" and meta.get("mode") in (
            "standard",
            "deep",
            "expert",
        ):
            # 提取前 200 字作为摘要
            summary = content[:200].strip()
            if len(content) > 200:
                summary += "..."
            summaries.append(summary)

    if not summaries:
        return "暂无分析摘要"

    return "\n\n".join(f"- {s}" for s in summaries)
