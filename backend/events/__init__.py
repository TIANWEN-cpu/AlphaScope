"""事件抽取模块 (v0.12)

从新闻和公告中抽取结构化事件, 用于因子生成和 Agent 分析。
"""

from .extractor import (
    EventExtractor,
    Event,
    extract_events_from_news,
    extract_events_from_announcements,
)
