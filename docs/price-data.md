# 行情数据标准化

v0.51 新增功能。统一 K 线数据的存储、查询、校验。

## 功能概述

| 功能 | 说明 |
|------|------|
| 代码标准化 | 600519/600519.SH/sh.600519 → 600519 |
| 市场推断 | 根据代码自动判断 CN/HK/US |
| 数据校验 | OHLCV 合法性检查 |
| K 线 CRUD | save/get/delete price bars |
| 批量写入 | save_price_bars 一次写入多条 |
| Provider 拉取 | /api/prices/{symbol}/fetch |

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/prices/normalize/{symbol}` | 代码标准化结果 |
| GET | `/api/prices/{symbol}` | 查询 K 线（支持 frequency/start/end/limit） |
| GET | `/api/prices/{symbol}/latest` | 最新价格 |
| POST | `/api/prices/{symbol}/fetch` | 从 Provider 拉取并存储 |

## 使用示例

### 查询 K 线

```bash
curl "http://localhost:8000/api/prices/600519?frequency=1d&limit=30"
```

### 拉取并存储

```bash
curl -X POST "http://localhost:8000/api/prices/600519/fetch?days=30"
```

### 代码标准化

```bash
curl "http://localhost:8000/api/prices/normalize/600519.SH"
# {"normalized": "600519", "market": "CN"}
```

## 代码标准化规则

| 输入 | 输出 | 市场 |
|------|------|------|
| 600519 | 600519 | CN |
| 600519.SH | 600519 | CN |
| sh.600519 | 600519 | CN |
| SH600519 | 600519 | CN |
| 000001.SZ | 000001 | CN |
| 00700.HK | 00700 | HK |

## 数据质量校验

校验规则：
- OHLC > 0
- high >= low
- high >= open, high >= close
- low <= open, low <= close
- volume >= 0

## 数据源

| Provider | 优先级 | 市场 | 说明 |
|----------|--------|------|------|
| Tushare | 85 | CN | 需要 token |
| OpenBB | 75 | US/HK | yfinance 后端 |
| AkShare | 60 | CN | 免费，默认 |
| BaoStock | 50 | CN | 免费，备用 |
