"""
Cost Tracker: Token 用量与成本追踪。

职责：
- 记录每次 LLM 调用的 token 用量
- 按 agent/mode/model 维度统计
- 提供成本估算
"""

import json
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from collections import defaultdict

try:
    from project_paths import CACHE_DIR
except ImportError:
    from backend.project_paths import CACHE_DIR

COST_LOG_PATH = CACHE_DIR / "cost_log.jsonl"

# 每 1000 token 的成本（美元）
COST_PER_1K_TOKENS = {
    "deepseek-chat": {"input": 0.00014, "output": 0.00028},
    "claude-sonnet-4-5": {"input": 0.003, "output": 0.015},
    "claude-opus-4-7": {"input": 0.015, "output": 0.075},
    "gpt-5.2": {"input": 0.002, "output": 0.008},
    "mimo-v2.5-pro": {"input": 0.0001, "output": 0.0002},
    "deepseek-v4-flash": {"input": 0.00007, "output": 0.00014},
}


@dataclass
class CallRecord:
    """单次 LLM 调用记录"""

    timestamp: float
    agent_key: str
    model: str
    vendor: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    mode: str = ""
    conversation_id: str = ""


class CostTracker:
    """Token 成本追踪器"""

    def __init__(self):
        self._records: List[CallRecord] = []
        self._log_path = COST_LOG_PATH

    def record_call(
        self,
        agent_key: str,
        model: str,
        vendor: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        mode: str = "",
        conversation_id: str = "",
    ):
        """记录一次 LLM 调用"""
        cost = self._estimate_cost(model, input_tokens, output_tokens)
        record = CallRecord(
            timestamp=time.time(),
            agent_key=agent_key,
            model=model,
            vendor=vendor,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            mode=mode,
            conversation_id=conversation_id,
        )
        self._records.append(record)
        self._append_to_log(record)

    def _estimate_cost(
        self, model: str, input_tokens: int, output_tokens: int
    ) -> float:
        """估算成本（美元）"""
        rates = COST_PER_1K_TOKENS.get(model, {"input": 0.001, "output": 0.002})
        return (input_tokens * rates["input"] + output_tokens * rates["output"]) / 1000

    def _append_to_log(self, record: CallRecord):
        """追加到日志文件"""
        try:
            self._log_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self._log_path, "a", encoding="utf-8") as f:
                f.write(
                    json.dumps(
                        {
                            "ts": record.timestamp,
                            "agent": record.agent_key,
                            "model": record.model,
                            "vendor": record.vendor,
                            "in_tok": record.input_tokens,
                            "out_tok": record.output_tokens,
                            "cost": record.cost_usd,
                            "mode": record.mode,
                            "conv": record.conversation_id,
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass

    def get_summary(self, mode: Optional[str] = None) -> Dict[str, Any]:
        """获取成本摘要"""
        records = self._records
        if mode:
            records = [r for r in records if r.mode == mode]

        total_cost = sum(r.cost_usd for r in records)
        total_input = sum(r.input_tokens for r in records)
        total_output = sum(r.output_tokens for r in records)

        by_agent = defaultdict(float)
        by_model = defaultdict(float)
        for r in records:
            by_agent[r.agent_key] += r.cost_usd
            by_model[r.model] += r.cost_usd

        return {
            "total_calls": len(records),
            "total_cost_usd": round(total_cost, 6),
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "by_agent": dict(by_agent),
            "by_model": dict(by_model),
        }

    def get_session_cost(self) -> float:
        """获取当前会话总成本"""
        return sum(r.cost_usd for r in self._records)


# 单例
_tracker: Optional[CostTracker] = None


def get_cost_tracker() -> CostTracker:
    """获取全局成本追踪器"""
    global _tracker
    if _tracker is None:
        _tracker = CostTracker()
    return _tracker
