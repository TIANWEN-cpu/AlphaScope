"""
Context Builder: 市场简报与上下文构建。

职责：
- build_market_brief() - 把股票数据打包成市场简报
- fetch_evidence_context() - 从 RAG 检索相关证据
- fetch_factor_context() - 生成量化因子摘要

从 llm_agents.py 拆分而来。
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


def fetch_evidence_context(symbol: str, stock_name: str = "", limit: int = 8) -> str:
    """从 RAG 检索相关证据, 格式化为简报上下文 (v0.40)

    每条证据包含编号、来源、时间、URL，供 Agent 引用。
    """
    try:
        from backend.pipeline import search_evidence

        query = f"{stock_name} {symbol} 投资分析"
        results = search_evidence(query, symbol=symbol, n_results=limit)
        if not results:
            return ""
        lines = ["【可用证据 (来自数据源平台)】"]
        lines.append("请在分析中引用证据编号 [1] [2] ...，以支撑你的观点。")
        for i, r in enumerate(results, 1):
            meta = r.get("metadata", {})
            doc_type = meta.get("doc_type", "unknown")
            source = meta.get("source", "unknown")
            source_url = meta.get("source_url", "")
            published = meta.get("published_at", "")
            text_preview = r.get("text", "")[:120]
            type_icon = {"news": "📰", "report": "📊", "announcement": "📋"}.get(
                doc_type, "📄"
            )
            url_part = f" | 来源: {source_url}" if source_url else ""
            lines.append(
                f"  [{i}] {type_icon} [{source}] {published}{url_part} — {text_preview}..."
            )
        lines.append(f"\n共检索到 {len(results)} 条相关证据, 覆盖新闻/研报/公告。")
        return "\n".join(lines)
    except Exception as e:
        logger.debug("RAG 证据检索失败: %s", e)
        return ""


def fetch_factor_context(symbol: str, stock_name: str = "", days: int = 30) -> str:
    """生成量化因子摘要, 注入 Agent 简报 (v0.12)"""
    try:
        from backend.factors import get_factor_generator
        from backend.factors.generator import format_factor_summary

        gen = get_factor_generator()
        report = gen.generate(symbol, stock_name, days=days, include_signals=True)
        if (
            report.news_count == 0
            and report.event_count == 0
            and report.report_count == 0
        ):
            return ""
        return format_factor_summary(report)
    except Exception as e:
        logger.debug("因子分析失败: %s", e)
        return ""


def build_market_brief(
    stock_data: Dict[str, Any], evidence_context: str = "", factor_context: str = ""
) -> str:
    """把数据打包成一段简洁的市场简报"""
    name = stock_data.get("name") or "未知标的"
    symbol = stock_data.get("symbol") or ""
    close = float(stock_data.get("close") or 0)
    day_change = float(
        stock_data.get("day_change", stock_data.get("change_pct", 0)) or 0
    )
    days = int(stock_data.get("days") or 0)
    period_change = float(stock_data.get("period_change") or 0)
    period_high = float(stock_data.get("period_high") or 0)
    period_low = float(stock_data.get("period_low") or 0)
    volume = float(stock_data.get("volume") or 0)
    total_amount = float(
        stock_data.get("total_amount", stock_data.get("amount", 0)) or 0
    )
    price_note = ""
    if close <= 0:
        price_note = "\n- 行情状态: 暂无可用价格数据，请结合数据源状态判断。"
    base = f"""
【标的】{name} ({symbol})

【价格信息】
- 最新价: ¥{close:.2f}
- 当日涨跌: {day_change:+.2f}%
- 区间涨跌（{days}日）: {period_change:+.2f}%
- 区间最高/最低: ¥{period_high:.2f} / ¥{period_low:.2f}{price_note}

【技术指标】
- MA5: {stock_data.get("ma5", "N/A")}
- MA20: {stock_data.get("ma20", "N/A")}
- MA60: {stock_data.get("ma60", "N/A")}
- MACD: {stock_data.get("macd", "N/A")}
- DIF/DEA: {stock_data.get("dif", "N/A")} / {stock_data.get("dea", "N/A")}
- RSI(14): {stock_data.get("rsi", "N/A")}

【量价数据】
- 当日成交量: {volume:,.0f} 手
- 区间成交额: {total_amount:.1f} 亿元
- 当日换手率: {stock_data.get("turnover", 0):.2f}%
- 近5日量比: {stock_data.get("vol_ratio", 1):.2f}
- 日波动率: {stock_data.get("volatility", 0):.2f}%

【基本面摘要】
{stock_data.get("fundamentals", "暂无")}
"""
    if stock_data.get("related_news_brief"):
        base += f"\n【个股相关资讯（最近）】\n{stock_data['related_news_brief']}\n"
    if stock_data.get("announcements_brief"):
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
    if factor_context:
        base += f"\n{factor_context}\n"
    if evidence_context:
        base += f"\n{evidence_context}\n"
    return base
