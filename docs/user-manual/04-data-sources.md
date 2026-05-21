# 数据源接入

AI-FINANCE 支持 20+ 数据源，涵盖行情、新闻、公告、资金流等。

---

## 数据源总览

| 数据源 | 数据类型 | 市场 | 需要 API Key | 默认状态 |
|--------|----------|------|--------------|----------|
| AKShare | 行情、资金流 | A股 | 否 | 启用 |
| 东方财富 | 新闻、公告 | A股 | 否 | 启用 |
| 财联社 | 快讯 | A股 | 否 | 启用 |
| 新浪财经 | 快讯 | A股 | 否 | 启用 |
| 巨潮资讯 | 公告 | A股 | 否 | 启用 |
| Tushare Pro | 行情、研报 | A股 | 是 | 可选 |
| Finnhub | 新闻、行情 | 美股 | 是 | 可选 |
| FRED | 宏观数据 | 全球 | 是 | 可选 |
| SEC EDGAR | SEC 文件 | 美股 | 否 | 启用 |
| Reddit | 舆情 | 美股 | 否 | 可选 |
| Google Trends | 搜索趋势 | 全球 | 否 | 可选 |
| Tavily | 网页搜索 | 全球 | 是 | 可选 |

---

## 默认数据源（无需配置）

以下数据源开箱即用，无需 API Key：

### AKShare
- 提供：A股行情、资金流向、基本面数据
- 特点：免费、数据全面
- 限制：频率限制

### 东方财富
- 提供：新闻快讯、个股新闻、公告
- 特点：实时性好
- 限制：仅 A 股

### 财联社
- 提供：电报快讯
- 特点：速度快
- 限制：仅 A 股

### 巨潮资讯
- 提供：上市公司公告
- 特点：官方来源
- 限制：仅 A 股

---

## 可选数据源配置

### Tushare Pro

提供更高质量的行情和研报数据。

1. 访问 [tushare.pro](https://tushare.pro/)
2. 注册账号并获取 Token
3. 编辑 `.env`：
   ```env
   TUSHARE_TOKEN=your_token_here
   ```
4. 重启服务

### Tavily

提供网页搜索能力，用于获取最新资讯。

1. 访问 [tavily.com](https://tavily.com/)
2. 注册账号并获取 API Key
3. 编辑 `.env`：
   ```env
   TAVILY_API_KEY=your_key_here
   ```
4. 重启服务

### Finnhub

提供美股新闻和行情数据。

1. 访问 [finnhub.io](https://finnhub.io/)
2. 注册账号并获取 API Key
3. 编辑 `.env`：
   ```env
   FINNHUB_API_KEY=your_key_here
   ```
4. 重启服务

### FRED

提供宏观经济数据（美联储）。

1. 访问 [fred.stlouisfed.org](https://fred.stlouisfed.org/)
2. 注册账号并获取 API Key
3. 编辑 `.env`：
   ```env
   FRED_API_KEY=your_key_here
   ```
4. 重启服务

---

## 数据源健康监控

### 查看数据源状态

1. 点击左侧 **数据源健康**
2. 查看各数据源状态：
   - 🟢 健康 - 正常工作
   - 🟡 降级 - 部分失败
   - 🔴 不可用 - 完全失败

### 状态指标

| 指标 | 说明 |
|------|------|
| 状态 | healthy / degraded / unhealthy |
| 连续失败次数 | 连续请求失败的次数 |
| 平均延迟 | 请求平均响应时间 |
| 最后错误 | 最近一次错误信息 |

### API 端点

```bash
# 查看所有数据源健康状态
curl http://localhost:8000/api/providers/health
```

---

## 数据源优先级

编辑 `config/data_sources.yaml` 可调整数据源优先级：

```yaml
providers:
  news:
    priority: [eastmoney, cls, sina]
    timeout: 10
    retry: 3

  prices:
    priority: [akshare, baostock]
    timeout: 15
    retry: 2

  announcements:
    priority: [cninfo, eastmoney]
    timeout: 20
    retry: 3
```

---

## 无数据源降级

当数据源不可用时，系统会：

1. 自动切换到备用数据源
2. 在界面显示警告提示
3. 继续完成分析（使用已有数据）

不会因为数据源缺失而崩溃。

---

## 常见问题

### Q: 数据源显示不可用怎么办？

1. 检查网络连接
2. 检查 API Key 是否配置
3. 检查是否触发频率限制
4. 等待几分钟后重试

### Q: 如何添加自定义数据源？

参考 `backend/providers/base.py` 实现 `BaseProvider` 接口，然后在 `config/data_sources.yaml` 中注册。

### Q: 数据更新频率是多少？

| 数据类型 | 更新频率 |
|----------|----------|
| 实时行情 | 5 分钟 |
| 新闻快讯 | 5 分钟 |
| 研报公告 | 1 小时 |
| 资金流向 | 5 分钟 |
| 宏观数据 | 每日 |

---

## 下一步

- [专家团使用](05-expert-panel.md) - 使用和自定义专家团
- [K 线图分析](06-kline-analysis.md) - 上传图片进行视觉分析
