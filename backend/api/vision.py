"""视觉分析 API — K线图分析 + 结构化报告"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.schemas.api import ApiResponse

router = APIRouter(prefix="/api/vision", tags=["vision"])


class VisionAnalyzeRequest(BaseModel):
    image_base64: str = Field(description="图片 base64 编码")
    mime_type: str = Field(default="image/png", description="MIME 类型")
    user_context: str = Field(default="", description="用户上下文")
    vendor: str = Field(default="deepseek", description="视觉模型供应商")
    model: str = Field(default="deepseek-chat", description="模型名称")
    ticker: str = Field(default="", description="股票代码（可选）")


@router.post("/analyze")
async def analyze_vision(req: VisionAnalyzeRequest):
    """分析K线图/金融图片"""
    from backend.vision.vision_agent import analyze_image

    result = analyze_image(
        image_base64=req.image_base64,
        mime_type=req.mime_type,
        user_context=req.user_context,
        vendor=req.vendor,
        model=req.model,
        ticker=req.ticker,
    )

    # 构建响应
    data = {
        "analysis": result.summary,
        "ticker": result.detection.ticker if result.detection else "",
        "ticker_name": result.detection.ticker_name if result.detection else "",
        "chart_type": result.detection.chart_type if result.detection else "",
        "period": result.detection.period if result.detection else "",
        "is_chart": result.detection.is_chart if result.detection else False,
        "needs_more_info": result.needs_more_info,
        "missing_info": result.missing_info,
    }

    if result.real_data and result.real_data.data_available:
        data["real_data"] = {
            "latest_close": result.real_data.latest_close,
            "real_trend": result.real_data.real_trend,
            "trend_consistent": result.real_data.trend_consistent,
            "conflicts": result.real_data.conflicts,
            "data_source": result.real_data.data_source,
        }

    if result.kline_analysis:
        data["kline"] = {
            "trend": result.kline_analysis.trend,
            "support_levels": result.kline_analysis.support_levels,
            "resistance_levels": result.kline_analysis.resistance_levels,
            "patterns": result.kline_analysis.patterns,
            "summary": result.kline_analysis.summary,
        }

    return ApiResponse(success=result.ok, data=data)


@router.post("/report")
async def generate_report(req: VisionAnalyzeRequest):
    """生成结构化视觉分析报告"""
    from backend.vision.vision_agent import analyze_image
    from backend.vision.report_generator import generate_vision_report

    result = analyze_image(
        image_base64=req.image_base64,
        mime_type=req.mime_type,
        user_context=req.user_context,
        vendor=req.vendor,
        model=req.model,
        ticker=req.ticker,
    )

    report = generate_vision_report(result)

    return ApiResponse(
        success=result.ok,
        data={
            "report": report,
            "ticker": result.detection.ticker if result.detection else "",
            "is_chart": result.detection.is_chart if result.detection else False,
        },
    )
