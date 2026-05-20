"""Custom Provider Template

Copy this file, rename it (without the _ prefix), and implement your data fetching logic.
The file must be in custom_providers/ and the class must inherit from BaseProvider.

Example:
    1. cp custom_providers/_template.py custom_providers/my_source.py
    2. Edit my_source.py: change class name, name attribute, and implement methods
    3. Add config in config/data_sources.yaml under the relevant {data_type}_providers section
    4. Restart the application -- your provider is auto-discovered

Note: Files starting with _ are skipped by the auto-discovery scanner.
"""

from __future__ import annotations

import logging

from backend.providers.base import BaseProvider

logger = logging.getLogger(__name__)


class MyCustomProvider(BaseProvider):
    """TODO: Describe your data source here"""

    name = "my_custom"  # Unique identifier (must match config key)
    markets = ["CN"]  # CN, HK, US, ALL, GLOBAL
    data_types = ["news"]  # news, reports, announcements, prices, fundamentals, fund_flow
    priority = 50  # 0-100, higher = preferred
    license_level = "research_only"  # public, research_only, restricted, commercial
    data_class = "fundamental"  # price, fundamental, sentiment, macro, event, alternative
    freshness = "daily"  # realtime, intraday, daily, weekly, monthly
    cost_tier = "free"  # free, freemium, paid
    rate_limit = {"per_minute": 60, "per_day": None}
    requires_key = False  # Set to True if you need an API key

    @classmethod
    def is_available(cls) -> bool:
        """Return False if dependencies are missing (e.g., API key not set)."""
        # Example: check for API key
        # import os
        # return bool(os.getenv("MY_CUSTOM_API_KEY"))
        return True

    def get_news(self, query: dict, **kwargs) -> list[dict]:
        """Fetch news data.

        Args:
            query: {"market": "CN", "symbol": "600519", "limit": 30, ...}

        Returns:
            List of dicts with keys: source, title, summary, datetime, url
        """
        raise NotImplementedError

    # Uncomment and implement as needed:
    # def get_reports(self, query: dict, **kwargs) -> list[dict]:
    #     raise NotImplementedError
    #
    # def get_announcements(self, query: dict, **kwargs) -> list[dict]:
    #     raise NotImplementedError
    #
    # def get_prices(self, query: dict, **kwargs) -> list[dict]:
    #     raise NotImplementedError
    #
    # def get_fundamentals(self, query: dict, **kwargs) -> dict:
    #     raise NotImplementedError
    #
    # def get_fund_flow(self, query: dict, **kwargs) -> list[dict]:
    #     raise NotImplementedError
