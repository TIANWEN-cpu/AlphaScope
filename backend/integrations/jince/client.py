"""Jince HTTP 客户端 — 与 jin-ce-zhi-suan 服务通信"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from .errors import JinceConnectionError, JinceError, JinceTimeoutError

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 30.0


class JinceClient:
    """Jince HTTP 客户端

    通过 HTTP API 与 jin-ce-zhi-suan 服务通信。
    所有方法在连接失败时抛出 JinceConnectionError。
    """

    def __init__(
        self, base_url: str = "http://localhost:8888", timeout: float = DEFAULT_TIMEOUT
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(self.timeout),
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        try:
            client = await self._get_client()
            resp = await client.request(method, path, **kwargs)
            resp.raise_for_status()
            return resp.json()
        except httpx.ConnectError:
            raise JinceConnectionError()
        except httpx.TimeoutException:
            raise JinceTimeoutError()
        except httpx.HTTPStatusError as e:
            raise JinceError(
                f"外部回测服务 HTTP {e.response.status_code}: {e.response.text}",
                code="JINCE_HTTP_ERROR",
            )
        except JinceError:
            raise
        except Exception as e:
            raise JinceError(f"外部回测服务请求异常: {e}")

    # ---- 公开 API ----

    async def get_status(self) -> dict[str, Any]:
        """获取 Jince 服务状态"""
        return await self._request("GET", "/api/status")

    async def list_strategies(self) -> list[dict[str, Any]]:
        """获取策略列表"""
        data = await self._request("GET", "/api/strategies")
        return data.get("strategies", data) if isinstance(data, dict) else data

    async def reload_strategies(self) -> dict[str, Any]:
        """重载策略"""
        return await self._request("POST", "/api/strategies/reload")

    async def run_backtest(
        self,
        strategy_id: str,
        symbol: str,
        start_date: str,
        end_date: str,
        initial_capital: float = 1000000.0,
        params: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """发起回测"""
        payload = {
            "strategy_id": strategy_id,
            "symbol": symbol,
            "start_date": start_date,
            "end_date": end_date,
            "initial_capital": initial_capital,
        }
        if params:
            payload["params"] = params
        return await self._request("POST", "/api/backtest", json=payload)

    async def start_live(
        self,
        strategy_id: str,
        symbol: str,
        params: Optional[dict[str, Any]] = None,
        capital: float = 1000000.0,
    ) -> dict[str, Any]:
        """启动实盘"""
        payload = {
            "strategy_id": strategy_id,
            "symbol": symbol,
            "capital": capital,
        }
        if params:
            payload["params"] = params
        return await self._request("POST", "/api/live/start", json=payload)

    async def stop_live(self, run_id: str) -> dict[str, Any]:
        """停止实盘"""
        return await self._request("POST", f"/api/live/{run_id}/stop")

    async def list_runs(self) -> list[dict[str, Any]]:
        """获取运行记录"""
        data = await self._request("GET", "/api/runs")
        return data.get("runs", data) if isinstance(data, dict) else data

    async def get_run(self, run_id: str) -> dict[str, Any]:
        """获取运行详情"""
        return await self._request("GET", f"/api/runs/{run_id}")
