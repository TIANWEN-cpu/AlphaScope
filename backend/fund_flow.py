"""
资金流向数据模块
- 个股每日资金流向（主力/超大单/大单/中单/小单）
- 大盘资金流向（上证/深证 + 主力分布）
"""
import warnings
warnings.filterwarnings("ignore")

import akshare as ak
import pandas as pd
from typing import Dict, Any, Optional


def infer_market(symbol: str) -> str:
    """根据股票代码推断市场前缀（用于 stock_individual_fund_flow）"""
    if symbol.startswith(("60", "68", "9")):
        return "sh"
    if symbol.startswith(("00", "30", "20")):
        return "sz"
    if symbol.startswith(("8", "4")):
        return "bj"
    return "sh"


def _safe(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception:
        return None


def fetch_individual_fund_flow(symbol: str, days: int = 30) -> Optional[pd.DataFrame]:
    """个股每日资金流向（akshare 默认返回近 120 日）"""
    market = infer_market(symbol)
    df = _safe(ak.stock_individual_fund_flow, stock=symbol, market=market)
    if df is None or len(df) == 0:
        return None
    df = df.copy()
    df["日期"] = pd.to_datetime(df["日期"])
    df = df.sort_values("日期").tail(days).reset_index(drop=True)
    return df


def fetch_market_fund_flow(days: int = 30) -> Optional[pd.DataFrame]:
    """大盘资金流向"""
    df = _safe(ak.stock_market_fund_flow)
    if df is None or len(df) == 0:
        return None
    df = df.copy()
    df["日期"] = pd.to_datetime(df["日期"])
    df = df.sort_values("日期").tail(days).reset_index(drop=True)
    return df


def summarize_fund_flow(df: pd.DataFrame, recent_days: int = 5) -> Dict[str, Any]:
    """汇总最近 N 日资金流向（用于卡片+LLM）"""
    if df is None or len(df) == 0:
        return {}
    recent = df.tail(recent_days)

    def to_yi(x):
        return float(x) / 1e8

    last = df.iloc[-1]

    return {
        "recent_days": recent_days,
        "main_total_yi": to_yi(recent["主力净流入-净额"].sum()),
        "super_total_yi": to_yi(recent["超大单净流入-净额"].sum()),
        "large_total_yi": to_yi(recent["大单净流入-净额"].sum()),
        "medium_total_yi": to_yi(recent["中单净流入-净额"].sum()),
        "small_total_yi": to_yi(recent["小单净流入-净额"].sum()),
        "last_date": str(last["日期"].date()) if hasattr(last["日期"], "date") else str(last["日期"]),
        "last_main_yi": to_yi(last["主力净流入-净额"]),
        "last_main_pct": float(last["主力净流入-净占比"]),
        "inflow_days": int((recent["主力净流入-净额"] > 0).sum()),
        "outflow_days": int((recent["主力净流入-净额"] < 0).sum()),
    }


def build_fund_flow_brief_for_llm(summary: Dict[str, Any], kind: str = "个股") -> str:
    """构造给 LLM 看的资金流向简报（红涨绿跌，正数=流入=利好）"""
    if not summary:
        return ""

    days = summary.get("recent_days", 5)
    main = summary.get("main_total_yi", 0)
    super_ = summary.get("super_total_yi", 0)
    large = summary.get("large_total_yi", 0)
    medium = summary.get("medium_total_yi", 0)
    small = summary.get("small_total_yi", 0)
    inflow_days = summary.get("inflow_days", 0)
    outflow_days = summary.get("outflow_days", 0)
    last_main = summary.get("last_main_yi", 0)
    last_pct = summary.get("last_main_pct", 0)

    direction = "净流入" if main > 0 else "净流出"

    return f"""【{kind}近{days}日资金流向】
- 主力合计{direction}: {main:+.2f}亿元（流入{inflow_days}天/流出{outflow_days}天）
- 超大单: {super_:+.2f}亿 | 大单: {large:+.2f}亿
- 中单: {medium:+.2f}亿 | 小单: {small:+.2f}亿（散户）
- 最新交易日（{summary.get('last_date', '')}）: 主力{last_main:+.2f}亿（占比 {last_pct:+.2f}%）"""


if __name__ == "__main__":
    print("=" * 70)
    print("个股资金流向 (600519, 近 10 日)")
    print("=" * 70)
    df = fetch_individual_fund_flow("600519", days=10)
    if df is not None:
        print(df[["日期", "收盘价", "涨跌幅", "主力净流入-净额", "主力净流入-净占比"]].to_string())
        s = summarize_fund_flow(df, recent_days=5)
        print("\n--- 5 日汇总 ---")
        for k, v in s.items():
            print(f"  {k}: {v}")
        print("\n--- LLM brief ---")
        print(build_fund_flow_brief_for_llm(s, kind="贵州茅台"))

    print("\n" + "=" * 70)
    print("大盘资金流向 (近 5 日)")
    print("=" * 70)
    df_m = fetch_market_fund_flow(days=10)
    if df_m is not None:
        s_m = summarize_fund_flow(df_m, recent_days=5)
        print(build_fund_flow_brief_for_llm(s_m, kind="大盘"))
