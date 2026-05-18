"""量化因子生成模块 (v0.12)

从新闻情绪、公告事件、研报评级、资金流向、价格动量等维度
生成标准化因子分值, 用于辅助投资决策和 Agent 分析。
"""

from .generator import FactorGenerator, FactorReport, get_factor_generator
