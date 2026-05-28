"""Jince 适配层错误定义"""


class JinceError(Exception):
    """Jince 基础错误"""

    def __init__(self, message: str, code: str = "JINCE_ERROR"):
        self.code = code
        super().__init__(message)


class JinceConnectionError(JinceError):
    """连接失败"""

    def __init__(self, message: str = "无法连接到外部回测服务"):
        super().__init__(message, code="JINCE_CONNECTION_ERROR")


class JinceTimeoutError(JinceError):
    """请求超时"""

    def __init__(self, message: str = "外部回测服务请求超时"):
        super().__init__(message, code="JINCE_TIMEOUT")


class JinceStrategyNotFoundError(JinceError):
    """策略不存在"""

    def __init__(self, strategy_id: str):
        super().__init__(f"策略不存在: {strategy_id}", code="JINCE_STRATEGY_NOT_FOUND")


class JinceBacktestError(JinceError):
    """回测失败"""

    def __init__(self, message: str = "回测执行失败"):
        super().__init__(message, code="JINCE_BACKTEST_ERROR")
