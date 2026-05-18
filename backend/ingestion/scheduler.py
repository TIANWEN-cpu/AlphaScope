"""数据采集调度器

基于 APScheduler 的定时任务调度, 管理各类数据的采集频率。
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Callable, Optional

logger = logging.getLogger(__name__)


class FetchJob:
    """单个采集任务"""

    def __init__(
        self,
        name: str,
        func: Callable,
        interval_seconds: int,
        description: str = "",
        enabled: bool = True,
    ) -> None:
        self.name = name
        self.func = func
        self.interval_seconds = interval_seconds
        self.description = description
        self.enabled = enabled
        self.last_run: Optional[float] = None
        self.last_status: str = "pending"
        self.run_count: int = 0
        self.error_count: int = 0

    def should_run(self) -> bool:
        if not self.enabled:
            return False
        if self.last_run is None:
            return True
        return (time.time() - self.last_run) >= self.interval_seconds

    def execute(self) -> None:
        start = time.time()
        try:
            self.func()
            self.last_status = "success"
            latency = (time.time() - start) * 1000
            logger.info(
                "[Scheduler] %s 完成, 耗时 %.0fms",
                self.name,
                latency,
            )
        except Exception as e:
            self.last_status = "error"
            self.error_count += 1
            logger.error("[Scheduler] %s 失败: %s", self.name, e)
        finally:
            self.last_run = time.time()
            self.run_count += 1


class DataScheduler:
    """数据采集调度器"""

    def __init__(self) -> None:
        self._jobs: dict[str, FetchJob] = {}
        self._running = False

    def add_job(self, job: FetchJob) -> None:
        self._jobs[job.name] = job
        logger.info(
            "注册采集任务: %s (间隔 %ds)",
            job.name,
            job.interval_seconds,
        )

    def remove_job(self, name: str) -> None:
        self._jobs.pop(name, None)

    def tick(self) -> list[str]:
        """执行一个调度周期, 返回已执行的任务名"""
        executed = []
        for name, job in self._jobs.items():
            if job.should_run():
                job.execute()
                executed.append(name)
        return executed

    def run_forever(self, tick_interval: float = 10.0) -> None:
        """持续运行调度器"""
        self._running = True
        logger.info("数据采集调度器启动, 检查间隔 %.0fs", tick_interval)
        while self._running:
            self.tick()
            time.sleep(tick_interval)

    def stop(self) -> None:
        self._running = False
        logger.info("数据采集调度器已停止")

    def get_status(self) -> list[dict]:
        """获取所有任务状态"""
        return [
            {
                "name": job.name,
                "description": job.description,
                "enabled": job.enabled,
                "interval_seconds": job.interval_seconds,
                "last_status": job.last_status,
                "last_run": job.last_run,
                "run_count": job.run_count,
                "error_count": job.error_count,
            }
            for job in self._jobs.values()
        ]


# 采集频率常量 (秒)
FETCH_INTERVAL_FAST = 60        # 1分钟 - 大盘快讯
FETCH_INTERVAL_MEDIUM = 300     # 5分钟 - 个股新闻
FETCH_INTERVAL_SLOW = 3600      # 1小时 - 公告
FETCH_INTERVAL_DAILY = 86400    # 24小时 - 日线行情
