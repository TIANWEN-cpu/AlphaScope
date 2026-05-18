"""标准化新闻数据模型"""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class NewsItem(BaseModel):
    """统一新闻条目模型"""

    id: str = Field(default="", description="唯一ID, 自动生成")
    title: str = Field(description="新闻标题")
    summary: str = Field(default="", description="摘要")
    content: str = Field(default="", description="正文或摘要")
    source: str = Field(description="数据来源标识: cls/eastmoney/sina/caixin/rss")
    upstream: str = Field(default="", description="上游来源: eastmoney/cninfo/sina")
    source_url: str = Field(default="", description="原始链接")
    published_at: Optional[datetime] = Field(default=None, description="发布时间")
    fetched_at: datetime = Field(default_factory=datetime.now, description="抓取时间")
    symbols: list[str] = Field(default_factory=list, description="关联股票代码")
    industries: list[str] = Field(default_factory=list, description="关联行业")
    event_type: str = Field(
        default="",
        description="事件类型: policy/earnings/litigation/macro/sector",
    )
    sentiment: float = Field(default=0.0, ge=-1.0, le=1.0, description="情绪分值")
    importance: float = Field(default=0.5, ge=0.0, le=1.0, description="重要度")
    confidence: float = Field(default=0.6, ge=0.0, le=1.0, description="可信度")
    license_level: str = Field(
        default="research_only",
        description="许可级别: public/research_only/restricted",
    )
    tags: list[str] = Field(default_factory=list, description="标签")

    def model_post_init(self, __context) -> None:
        if not self.id:
            raw = f"{self.source}_{self.title}_{self.published_at}"
            self.id = f"news_{self.source}_{hashlib.md5(raw.encode()).hexdigest()[:12]}"


class NewsQuery(BaseModel):
    """新闻查询参数"""

    symbols: list[str] = Field(default_factory=list)
    keywords: str = Field(default="")
    sources: list[str] = Field(default_factory=list)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    event_type: str = ""
    limit: int = Field(default=50, ge=1, le=500)
