# 新闻/公告/事件分析

v0.54 新增功能。新闻存储、公告查询、事件影响分析。

## 功能概述

| 功能 | 说明 |
|------|------|
| 新闻列表 | 按股票/事件类型过滤 |
| 新闻搜索 | 关键词全文搜索 |
| 公告列表 | 按股票/分类过滤 |
| 事件摘要 | 事件类型分布 + 情绪趋势 |
| 事件影响 | 事件前后股价变动 + 相关性 |

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/news` | 新闻列表（symbol/event_type 过滤） |
| GET | `/api/news/{id}` | 新闻详情 |
| POST | `/api/news/search` | 搜索新闻 |
| GET | `/api/news/announcements` | 公告列表（symbol/category 过滤） |
| GET | `/api/news/events/{symbol}` | 事件摘要 |
| GET | `/api/news/impact/{symbol}` | 事件影响分析 |

## 使用示例

### 新闻列表

```bash
curl "http://localhost:8000/api/news?symbol=600519&event_type=earnings"
```

### 事件影响分析

```bash
curl "http://localhost:8000/api/news/impact/600519?days=30&window=5"
```

返回：
```json
{
  "success": true,
  "data": {
    "symbol": "600519",
    "events": [
      {
        "title": "茅台Q3业绩超预期",
        "event_type": "earnings",
        "sentiment": 0.8,
        "impact": {
          "event_date": "2025-01-10",
          "pre_change_pct": 2.5,
          "post_change_pct": 5.3,
          "impact_level": "强正面"
        }
      }
    ],
    "correlation": {
      "correlation": 0.72,
      "event_count": 15,
      "consistent_direction": 11
    }
  }
}
```

## 事件类型

| 类型 | 说明 |
|------|------|
| earnings | 业绩/财报 |
| dividend | 分红/送转 |
| mna | 并购重组 |
| financing | 融资/增发 |
| litigation | 诉讼/处罚 |
| policy | 政策/监管 |
| supply_chain | 供应链 |
| insider | 内部人交易 |
| macro | 宏观/行业 |

## 影响程度

| 后续涨跌幅 | 级别 |
|-----------|------|
| > 3% | 强正面 |
| 1%-3% | 正面 |
| -1%-1% | 中性 |
| -3%--1% | 负面 |
| < -3% | 强负面 |
