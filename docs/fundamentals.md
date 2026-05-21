# 基本面分析

v0.53 新增功能。估值指标、盈利质量、现金流、资产负债、综合评分。

## 分析维度

| 维度 | 函数 | 指标 |
|------|------|------|
| 估值 | `calc_valuation_metrics` | PE/PB/PS/PEG/EV-EBITDA/估值水平 |
| 盈利质量 | `assess_earnings_quality` | 经营现金流/净利润比、扣非占比、质量评分 |
| 现金流 | `analyze_cash_flow` | 自由现金流、覆盖比、现金流模式 |
| 资产负债 | `analyze_balance_sheet` | 资产负债率、流动比率、ROA、健康度 |
| 综合评分 | `compute_fundamental_score` | 加权评分 0-100、A/B/C/D 评级 |

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/fundamentals/{symbol}` | 综合基本面分析 |
| GET | `/api/fundamentals/{symbol}/valuation` | 估值指标 |
| GET | `/api/fundamentals/{symbol}/peers` | 行业对比 |
| GET | `/api/fundamentals/{symbol}/shareholders` | 股东结构 |

## 使用示例

### 综合基本面

```bash
curl http://localhost:8000/api/fundamentals/600519
```

返回：
```json
{
  "success": true,
  "data": {
    "symbol": "600519",
    "financial_periods": [
      {"period": "2024-09-30", "revenue_yi": 1200, "net_profit_yi": 600, "roe_pct": 30}
    ],
    "valuation": {"pe": 25, "pb": 8, "ps": 12, "valuation_level": "合理"},
    "earnings_quality": {"quality_score": 80, "quality_level": "优秀"},
    "cashflow": {"free_cash_flow": 500, "cf_pattern": "成熟型"},
    "balance_sheet": {"health_score": 85, "health_level": "优秀"},
    "fundamental_score": {"total_score": 78, "grade": "B"}
  }
}
```

## 估值水平判断

| PE 范围 | 水平 |
|---------|------|
| < 15 | 低估 |
| 15-30 | 合理 |
| 30-60 | 偏高 |
| > 60 | 高估 |

## 现金流模式

| 模式 | 经营 | 投资 | 融资 | 说明 |
|------|------|------|------|------|
| 成长型 | + | - | + | 扩张期 |
| 成熟型 | + | - | - | 稳定期 |
| 收缩型 | + | + | — | 回收期 |
| 预警型 | - | — | — | 经营失血 |

## 综合评分权重

- 估值：25%
- 盈利质量：25%
- 现金流：25%
- 资产负债：25%

评级：A(≥80) / B(≥65) / C(≥50) / D(<50)
