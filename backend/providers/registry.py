"""Provider Registry - 数据源自动发现、优先级选择和故障降级"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import yaml

from .base import BaseProvider

logger = logging.getLogger(__name__)

# 项目根目录
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_DATA_SOURCES_CONFIG = _PROJECT_ROOT / "config" / "data_sources.yaml"


class ProviderRegistry:
    """数据源注册中心

    功能:
    - 注册/注销 Provider 实例
    - 按 data_type + market 自动选择最优 Provider
    - 故障降级: 主源失败自动尝试下一优先级
    - 从 config/data_sources.yaml 读取配置
    """

    def __init__(self) -> None:
        self._providers: dict[str, BaseProvider] = {}
        self._config: dict = {}
        self._load_config()

    def _load_config(self) -> None:
        """加载数据源配置"""
        if _DATA_SOURCES_CONFIG.exists():
            try:
                with open(_DATA_SOURCES_CONFIG, "r", encoding="utf-8") as f:
                    self._config = yaml.safe_load(f) or {}
                logger.info("已加载数据源配置: %s", _DATA_SOURCES_CONFIG)
            except Exception as e:
                logger.warning("加载数据源配置失败: %s", e)
                self._config = {}

    def register(self, provider: BaseProvider) -> None:
        """注册一个 Provider"""
        self._providers[provider.name] = provider
        logger.info(
            "已注册 Provider: %s (markets=%s, types=%s, priority=%d)",
            provider.name,
            provider.markets,
            provider.data_types,
            provider.priority,
        )

    def unregister(self, name: str) -> None:
        """注销一个 Provider"""
        self._providers.pop(name, None)

    def get_provider(self, name: str) -> Optional[BaseProvider]:
        """按名称获取 Provider"""
        return self._providers.get(name)

    def list_providers(self) -> list[dict]:
        """列出所有已注册 Provider"""
        return [
            {
                "name": p.name,
                "markets": p.markets,
                "data_types": p.data_types,
                "priority": p.priority,
                "status": p.health.status.value,
            }
            for p in self._providers.values()
        ]

    def get(
        self,
        data_type: str,
        market: str = "CN",
        symbol: str = "",
        **query_kwargs,
    ) -> list:
        """自动选择 Provider 获取数据

        Args:
            data_type: 数据类型 (news/report/announcement/price/fundamental/fund_flow)
            market: 市场 (CN/HK/US)
            symbol: 股票代码 (可选, 用于判断市场)
            **query_kwargs: 传递给 Provider 的查询参数

        Returns:
            Provider 返回的数据列表
        """
        # 按优先级排序的候选 Provider
        candidates = self._get_candidates(data_type, market)
        if not candidates:
            logger.warning(
                "没有可用的 Provider: data_type=%s, market=%s", data_type, market
            )
            return []

        query = {"market": market, "symbol": symbol, **query_kwargs}
        last_error = None

        for provider in candidates:
            try:
                method = getattr(provider, f"get_{data_type}", None)
                if method is None:
                    continue
                result = method(query)
                if result:
                    logger.info(
                        "[Registry] %s.%s 返回 %d 条数据",
                        provider.name,
                        data_type,
                        len(result) if isinstance(result, list) else 1,
                    )
                    return result
            except NotImplementedError:
                continue
            except Exception as e:
                last_error = e
                logger.warning(
                    "[Registry] %s.%s 失败: %s, 尝试下一源",
                    provider.name,
                    data_type,
                    e,
                )
                continue

        logger.error(
            "[Registry] 所有 Provider 均失败: data_type=%s, market=%s, last_error=%s",
            data_type,
            market,
            last_error,
        )
        return []

    def _get_candidates(self, data_type: str, market: str) -> list[BaseProvider]:
        """获取符合条件的候选 Provider, 按优先级降序排列"""
        candidates = []
        for provider in self._providers.values():
            # 检查是否支持该数据类型
            if data_type not in provider.data_types:
                continue
            # 检查是否支持该市场
            if market not in provider.markets and "ALL" not in provider.markets:
                continue
            # 检查是否在配置中被禁用
            if not self._is_enabled(provider.name, data_type):
                continue
            candidates.append(provider)

        # 按优先级降序排列 (配置优先级 > Provider 默认优先级)
        candidates.sort(
            key=lambda p: self._get_config_priority(p.name, data_type) or p.priority,
            reverse=True,
        )
        return candidates

    def _is_enabled(self, provider_name: str, data_type: str) -> bool:
        """检查 Provider 在配置中是否启用"""
        config_key = f"{data_type}_providers"
        provider_config = self._config.get(config_key, {}).get(provider_name, {})
        return provider_config.get("enabled", True)

    def _get_config_priority(self, provider_name: str, data_type: str) -> Optional[int]:
        """从配置中获取 Provider 优先级"""
        config_key = f"{data_type}_providers"
        provider_config = self._config.get(config_key, {}).get(provider_name, {})
        return provider_config.get("priority")

    def get_all_health(self) -> list[dict]:
        """获取所有 Provider 的健康状态"""
        return [p.health_check() for p in self._providers.values()]

    def get_source_trust_level(self, source: str) -> str:
        """获取数据源的可信度等级 (S/A/B/C/D)"""
        trust_levels = self._config.get("source_trust_levels", {})
        for level, sources in trust_levels.items():
            if source in sources:
                return level
        return "D"


# 全局单例
_registry: Optional[ProviderRegistry] = None


def get_registry() -> ProviderRegistry:
    """获取全局 ProviderRegistry 单例"""
    global _registry
    if _registry is None:
        _registry = ProviderRegistry()
        _auto_register_providers(_registry)
    return _registry


def _auto_register_providers(registry: ProviderRegistry) -> None:
    """自动发现并注册所有已安装的 Provider"""
    provider_classes = []

    # 按依赖可用性动态导入
    try:
        from .akshare_provider import AkShareProvider

        provider_classes.append(AkShareProvider)
    except ImportError:
        logger.debug("AkShare Provider 未安装, 跳过")

    try:
        from .eastmoney_provider import EastMoneyProvider

        provider_classes.append(EastMoneyProvider)
    except ImportError:
        logger.debug("EastMoney Provider 未安装, 跳过")

    try:
        from .cls_provider import CLSProvider

        provider_classes.append(CLSProvider)
    except ImportError:
        logger.debug("CLS Provider 未安装, 跳过")

    try:
        from .cninfo_provider import CNInfoProvider

        provider_classes.append(CNInfoProvider)
    except ImportError:
        logger.debug("CNInfo Provider 未安装, 跳过")

    try:
        from .tushare_provider import TushareProvider

        provider_classes.append(TushareProvider)
    except ImportError:
        logger.debug("Tushare Provider 未安装, 跳过")

    try:
        from .baostock_provider import BaoStockProvider

        provider_classes.append(BaoStockProvider)
    except ImportError:
        logger.debug("BaoStock Provider 未安装, 跳过")

    try:
        from .openbb_provider import OpenBBProvider

        provider_classes.append(OpenBBProvider)
    except ImportError:
        logger.debug("OpenBB Provider 未安装, 跳过")

    try:
        from .sec_provider import SECProvider

        provider_classes.append(SECProvider)
    except ImportError:
        logger.debug("SEC Provider 未安装, 跳过")

    try:
        from .hkex_provider import HKEXProvider

        provider_classes.append(HKEXProvider)
    except ImportError:
        logger.debug("HKEX Provider 未安装, 跳过")

    for cls in provider_classes:
        try:
            registry.register(cls())
        except Exception as e:
            logger.warning("注册 Provider %s 失败: %s", cls.__name__, e)

    logger.info("自动注册完成, 共 %d 个 Provider", len(registry.list_providers()))
