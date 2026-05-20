"""
Chart Detector: 图表类型检测。

职责：
- 判断图片是否为 K 线图
- 识别图表周期（日线/周线/分钟线）
- 提取可见的标的名称/代码
"""

from dataclasses import dataclass

from backend.models.provider_gateway import _call_with, _extract_json


@dataclass
class ChartDetectionResult:
    """图表检测结果"""

    is_chart: bool = False
    chart_type: str = ""  # kline, line, bar, candlestick, table, other
    ticker: str = ""  # 识别到的股票代码
    ticker_name: str = ""  # 识别到的股票名称
    market: str = ""  # CN, US, HK
    period: str = ""  # daily, weekly, monthly, minute
    confidence: float = 0.0
    raw_response: str = ""


def detect_chart(
    image_base64: str,
    mime_type: str = "image/png",
    vendor: str = "deepseek",
    model: str = "deepseek-chat",
) -> ChartDetectionResult:
    """
    使用视觉模型检测图片是否为金融图表。

    Args:
        image_base64: 图片的 base64 编码
        mime_type: 图片 MIME 类型
        vendor: LLM 供应商
        model: 模型名称

    Returns:
        ChartDetectionResult 包含检测结果
    """
    messages = [
        {
            "role": "system",
            "content": "你是一个金融图表识别专家。分析图片内容，判断是否为金融图表并提取关键信息。",
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime_type};base64,{image_base64}"},
                },
                {
                    "type": "text",
                    "text": """请分析这张图片，用 JSON 返回以下信息：
{
  "is_chart": true/false,
  "chart_type": "kline/candlestick/line/bar/table/other",
  "ticker": "股票代码（如果可见）",
  "ticker_name": "股票名称（如果可见）",
  "market": "CN/US/HK/unknown",
  "period": "daily/weekly/monthly/minute/unknown",
  "confidence": 0.0-1.0
}

只返回 JSON，不要其他文字。""",
                },
            ],
        },
    ]

    try:
        text = _call_with(vendor, model, messages, max_tokens=300, temperature=0.1)
        data = _extract_json(text)
        return ChartDetectionResult(
            is_chart=bool(data.get("is_chart", False)),
            chart_type=data.get("chart_type", "other"),
            ticker=data.get("ticker", ""),
            ticker_name=data.get("ticker_name", ""),
            market=data.get("market", ""),
            period=data.get("period", ""),
            confidence=float(data.get("confidence", 0)),
            raw_response=text,
        )
    except Exception as e:
        return ChartDetectionResult(
            is_chart=False,
            raw_response=f"检测失败: {e}",
        )
