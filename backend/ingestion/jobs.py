"""数据采集任务定义

定义各类数据的采集任务, 通过 DataScheduler 调度执行。
"""

from __future__ import annotations

import logging
from datetime import datetime

from .scheduler import (
    DataScheduler,
    FetchJob,
    FETCH_INTERVAL_MEDIUM,
    FETCH_INTERVAL_SLOW,
    FETCH_INTERVAL_DAILY,
)

logger = logging.getLogger(__name__)


def _is_cn_trading_hour() -> bool:
    """判断当前是否为 A 股交易时段 (9:15-15:00, 周一至周五)"""
    now = datetime.now()
    if now.weekday() >= 5:  # 周末
        return False
    hour_min = now.hour * 100 + now.minute
    return 915 <= hour_min <= 1500


def _is_us_trading_hour() -> bool:
    """判断当前是否为美股交易时段 (21:30-04:00 北京时间, 周一至周五)"""
    now = datetime.now()
    if now.weekday() >= 5:
        return False
    hour_min = now.hour * 100 + now.minute
    # 美东 9:30-16:00 ≈ 北京 21:30-04:00
    return hour_min >= 2130 or hour_min <= 400


# ---- 采集任务函数 ----


def fetch_cn_news():
    """采集 A 股新闻/快讯"""
    from backend.pipeline import get_pipeline

    pipeline = get_pipeline()
    items = pipeline.ingest_news(market="CN", limit=50)
    logger.info("[Job] CN 新闻采集: %d 条", len(items))


def fetch_cn_reports():
    """采集 A 股研报 (热门个股)"""
    from backend.pipeline import get_pipeline

    pipeline = get_pipeline()
    # 对热门个股采集研报
    hot_symbols = ["600519", "000001", "300750", "601318", "000858"]
    total = 0
    for sym in hot_symbols:
        items = pipeline.ingest_reports(symbol=sym, limit=10)
        total += len(items)
    logger.info("[Job] CN 研报采集: %d 条 (共 %d 只)", total, len(hot_symbols))


def fetch_cn_announcements():
    """采集 A 股公告"""
    from backend.pipeline import get_pipeline

    pipeline = get_pipeline()
    hot_symbols = ["600519", "000001", "300750", "601318", "000858"]
    total = 0
    for sym in hot_symbols:
        items = pipeline.ingest_announcements(symbol=sym, limit=20)
        total += len(items)
    logger.info("[Job] CN 公告采集: %d 条", total)


def fetch_market_snapshot():
    """采集大盘快照行情"""
    from backend.pipeline import get_pipeline

    pipeline = get_pipeline()
    # 主要指数
    for idx in ["000001", "399001", "399006"]:
        pipeline.ingest_prices(symbol=idx, market="CN")
    logger.info("[Job] 大盘快照采集完成")


def fetch_us_filings():
    """采集美股 SEC filings"""
    from backend.pipeline import get_pipeline

    pipeline = get_pipeline()
    us_symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"]
    total = 0
    for sym in us_symbols:
        items = pipeline.ingest_announcements(symbol=sym, market="US", limit=5)
        total += len(items)
    logger.info("[Job] US SEC filings 采集: %d 条", total)


def fetch_cn_prices():
    """采集 A 股日线行情 (收盘后)"""
    from backend.pipeline import get_pipeline

    pipeline = get_pipeline()
    hot_symbols = ["600519", "000001", "300750", "601318", "000858"]
    total = 0
    for sym in hot_symbols:
        items = pipeline.ingest_prices(symbol=sym, market="CN")
        total += len(items)
    logger.info("[Job] CN 行情采集: %d 条", total)


# ---- 调度器工厂 ----


def create_default_scheduler() -> DataScheduler:
    """创建默认数据采集调度器

    任务列表:
    - CN 新闻: 每 5 分钟 (交易时段)
    - CN 研报: 每小时
    - CN 公告: 每小时
    - 大盘快照: 每小时
    - CN 行情: 每日
    - US SEC: 每 15 分钟 (交易时段)
    """
    scheduler = DataScheduler()

    scheduler.add_job(
        FetchJob(
            name="cn_news",
            func=fetch_cn_news,
            interval_seconds=FETCH_INTERVAL_MEDIUM,
            description="A 股新闻/快讯 (每 5 分钟)",
        )
    )

    scheduler.add_job(
        FetchJob(
            name="cn_reports",
            func=fetch_cn_reports,
            interval_seconds=FETCH_INTERVAL_SLOW,
            description="A 股研报 (每小时)",
        )
    )

    scheduler.add_job(
        FetchJob(
            name="cn_announcements",
            func=fetch_cn_announcements,
            interval_seconds=FETCH_INTERVAL_SLOW,
            description="A 股公告 (每小时)",
        )
    )

    scheduler.add_job(
        FetchJob(
            name="market_snapshot",
            func=fetch_market_snapshot,
            interval_seconds=FETCH_INTERVAL_SLOW,
            description="大盘快照 (每小时)",
        )
    )

    scheduler.add_job(
        FetchJob(
            name="cn_prices",
            func=fetch_cn_prices,
            interval_seconds=FETCH_INTERVAL_DAILY,
            description="A 股日线行情 (每日)",
        )
    )

    scheduler.add_job(
        FetchJob(
            name="us_filings",
            func=fetch_us_filings,
            interval_seconds=FETCH_INTERVAL_MEDIUM * 3,  # 15 分钟
            description="美股 SEC filings (每 15 分钟)",
        )
    )

    logger.info("默认调度器已创建, 共 %d 个任务", len(scheduler._jobs))
    return scheduler
