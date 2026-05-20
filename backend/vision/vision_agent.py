"""
Vision Agent: 视觉分析编排。

职责：
- 编排完整的K线图分析流程
- 图片检测 → K线解读 → 行情验证 → 综合分析
- 处理用户追问和缺失信息补充
"""

from typing import Optional
from dataclasses import dataclass, field

from backend.vision.image_loader import load_image
from backend.vision.chart_detector import detect_chart, ChartDetectionResult
from backend.vision.kline_interpreter import interpret_kline, KlineAnalysis


@dataclass
class VisionAnalysisResult:
    """视觉分析完整结果"""

    detection: Optional[ChartDetectionResult] = None
    kline_analysis: Optional[KlineAnalysis] = None
    needs_more_info: bool = False
    missing_info: list = field(default_factory=list)
    disclaimer: str = ""
    summary: str = ""
    ok: bool = False


# 需要用户补充的信息清单
REQUIRED_INFO = {
    "ticker": "请提供股票代码（如 600519、AAPL）",
    "market": "请确认市场（A股/港股/美股）",
    "period": "请确认分析周期（日线/周线/月线）",
}


def analyze_image(
    image_base64: str,
    mime_type: str = "image/png",
    user_context: str = "",
    vendor: str = "deepseek",
    model: str = "deepseek-chat",
) -> VisionAnalysisResult:
    """
    完整的图片分析流程。

    Args:
        image_base64: 图片 base64 编码
        mime_type: MIME 类型
        user_context: 用户提供的额外上下文
        vendor: 视觉模型供应商
        model: 视觉模型名称

    Returns:
        VisionAnalysisResult 完整分析结果
    """
    # Step 1: 检测图片类型
    detection = detect_chart(image_base64, mime_type, vendor, model)

    if not detection.is_chart:
        return VisionAnalysisResult(
            detection=detection,
            summary="图片未识别为金融图表。请上传K线图、行情截图等金融相关图片。",
            ok=False,
        )

    # Step 2: 检查缺失信息
    missing = []
    if not detection.ticker and "ticker" not in user_context.lower():
        missing.append(REQUIRED_INFO["ticker"])
    if not detection.period:
        missing.append(REQUIRED_INFO["period"])

    # Step 3: K线解读
    context_parts = []
    if detection.ticker:
        context_parts.append(f"标的: {detection.ticker} ({detection.ticker_name})")
    if detection.period:
        context_parts.append(f"周期: {detection.period}")
    if user_context:
        context_parts.append(user_context)
    context = " | ".join(context_parts) if context_parts else ""

    kline = interpret_kline(image_base64, mime_type, context, vendor, model)

    # Step 4: 组装结果
    disclaimer = (
        "注意：以上分析仅基于K线图形观察，可能与实际行情存在偏差。"
        "请结合实时行情数据验证关键价位。本分析不构成投资建议。"
    )

    summary_parts = []
    if kline.trend:
        summary_parts.append(f"趋势判断: {kline.trend}")
    if kline.summary:
        summary_parts.append(kline.summary)
    if missing:
        summary_parts.append(f"需要补充: {', '.join(missing)}")

    return VisionAnalysisResult(
        detection=detection,
        kline_analysis=kline,
        needs_more_info=bool(missing),
        missing_info=missing,
        disclaimer=disclaimer,
        summary="\n".join(summary_parts),
        ok=True,
    )


def analyze_uploaded_file(
    file_path: str,
    user_context: str = "",
    vendor: str = "deepseek",
    model: str = "deepseek-chat",
) -> VisionAnalysisResult:
    """分析上传的图片文件"""
    img = load_image(file_path)
    if not img:
        return VisionAnalysisResult(
            summary="无法加载图片文件。请确保文件格式为 PNG/JPG/GIF/WebP，大小不超过 20MB。",
            ok=False,
        )
    return analyze_image(img.base64_data, img.mime_type, user_context, vendor, model)
