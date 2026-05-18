"""标准化公告数据模型"""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class Announcement(BaseModel):
    """统一公告条目模型"""

    id: str = Field(default="", description="唯一ID")
    symbol: str = Field(description="股票代码, 如 600519.SH")
    company_name: str = Field(default="", description="公司名称")
    title: str = Field(description="公告标题")
    category: str = Field(
        default="",
        description="公告类别: dividend/earnings/mna/litigation/financing/other",
    )
    published_at: Optional[datetime] = Field(default=None, description="公告日期")
    fetched_at: datetime = Field(default_factory=datetime.now, description="抓取时间")
    source: str = Field(description="数据来源: cninfo/tushare/eastmoney/exchange")
    source_url: str = Field(default="", description="原始链接")
    pdf_url: str = Field(default="", description="PDF下载链接")
    pdf_hash: str = Field(default="", description="PDF文件SHA256哈希")
    parsed_text_path: str = Field(default="", description="解析后文本路径")
    importance: float = Field(default=0.5, ge=0.0, le=1.0, description="重要度")
    confidence: float = Field(default=0.9, ge=0.0, le=1.0, description="可信度")

    def model_post_init(self, __context) -> None:
        if not self.id:
            raw = f"{self.source}_{self.symbol}_{self.title}_{self.published_at}"
            self.id = f"ann_{self.source}_{hashlib.md5(raw.encode()).hexdigest()[:12]}"


class AnnouncementQuery(BaseModel):
    """公告查询参数"""

    symbols: list[str] = Field(default_factory=list)
    category: str = ""
    keywords: str = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    limit: int = Field(default=50, ge=1, le=500)
