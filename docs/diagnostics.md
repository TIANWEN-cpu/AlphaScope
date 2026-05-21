# 日志与诊断

v0.68 新增功能。工具调用日志、模型调用日志、健康历史、汇总统计。

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/diagnostics/traces` | 最近 trace/span 统计 |
| GET | `/api/diagnostics/tool-calls` | 工具调用日志 |
| GET | `/api/diagnostics/model-calls` | 模型调用日志（支持 model 过滤） |
| GET | `/api/diagnostics/health-history` | 数据源健康历史 |
| GET | `/api/diagnostics/errors` | 错误日志 |
| GET | `/api/diagnostics/summary` | 汇总统计 |

## 使用示例

### 汇总统计

```bash
curl http://localhost:8000/api/diagnostics/summary
```

返回：
```json
{
  "success": true,
  "data": {
    "tool_calls": {"total": 150, "errors": 3, "avg_latency_ms": 245.5},
    "cost_records": {"total": 89, "total_cost_usd": 0.1234, "total_input_tokens": 50000},
    "health": {"total_checks": 200, "ok": 195, "errors": 5}
  }
}
```

### 工具调用日志

```bash
curl http://localhost:8000/api/diagnostics/tool-calls?limit=20
```

### 模型调用日志

```bash
curl http://localhost:8000/api/diagnostics/model-calls?model=deepseek-chat
```

### 错误日志

```bash
curl http://localhost:8000/api/diagnostics/errors
```

## 数据存储

| 表 | 说明 |
|------|------|
| `tool_calls` | 工具调用记录（名称/输入/输出/状态/延迟） |
| `cost_records` | 模型调用记录（模型/token数/成本/模式） |
| `source_fetch_logs` | 数据源健康历史（来源/状态/延迟/条目数） |
