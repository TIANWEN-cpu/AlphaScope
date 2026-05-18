"""标准化行情和资金流数据模型"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PriceBar(BaseModel):
    """统一K线条目模型"""

    symbol: str = Field(description="股票代码")
    market: str = Field(default="CN", description="市场: CN/HK/US")
    frequency: str = Field(default="1d", description="频率: 1m/5m/15m/30m/60m/1d/1w/1M")
    date: str = Field(description="日期, 格式 YYYY-MM-DD")
    open: float = Field(description="开盘价")
    high: float = Field(description="最高价")
    low: float = Field(description="最低价")
    close: float = Field(description="收盘价")
    volume: float = Field(default=0, description="成交量")
    amount: float = Field(default=0, description="成交额")
    turnover: float = Field(default=0, description="换手率")
    amplitude: float = Field(default=0, description="振幅")
    change_pct: float = Field(default=0, description="涨跌幅")
    adjust: str = Field(default="hfq", description="复权类型: hfq/qfq/none")
    source: str = Field(default="akshare", description="数据来源")
    fetched_at: datetime = Field(default_factory=datetime.now)


class FundFlow(BaseModel):
    """统一资金流模型"""

    symbol: str = Field(description="股票代码")
    date: str = Field(description="日期")
    main_net_inflow: float = Field(default=0, description="主力净流入")
    super_large_net_inflow: float = Field(default=0, description="超大单净流入")
    large_net_inflow: float = Field(default=0, description="大单净流入")
    medium_net_inflow: float = Field(default=0, description="中单净流入")
    small_net_inflow: float = Field(default=0, description="小单净流入")
    close: float = Field(default=0, description="收盘价")
    change_pct: float = Field(default=0, description="涨跌幅")
    source: str = Field(default="eastmoney", description="数据来源")
    fetched_at: datetime = Field(default_factory=datetime.now)


class MarketSnapshot(BaseModel):
    """大盘快照"""

    index_name: str = Field(description="指数名称")
    index_code: str = Field(description="指数代码")
    current: float = Field(description="当前点位")
    change_pct: float = Field(default=0, description="涨跌幅")
    volume: float = Field(default=0, description="成交量")
    amount: float = Field(default=0, description="成交额")
    timestamp: datetime = Field(default_factory=datetime.now)
    source: str = Field(default="akshare")
