# K线图视觉分析

v0.55 正式版。上传K线图 → 识别 → 解读 → 交叉验证 → 结构化报告。

## 分析流程

```
上传图片 → 图表识别 → K线解读 → 真实行情交叉验证 → 结构化报告
```

1. **图表识别**：LLM 识别图表类型、ticker、周期、市场
2. **K线解读**：趋势判断、支撑压力位、形态识别、技术指标描述
3. **交叉验证**：获取真实行情数据，验证趋势和价位一致性
4. **报告生成**：结构化 Markdown 报告（含风险提示）

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/vision/analyze` | 分析K线图 |
| POST | `/api/vision/report` | 生成结构化报告 |

## 使用示例

### 分析K线图

```bash
curl -X POST http://localhost:8000/api/vision/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "image_base64": "<base64编码>",
    "mime_type": "image/png",
    "ticker": "600519"
  }'
```

### 生成结构化报告

```bash
curl -X POST http://localhost:8000/api/vision/report \
  -H "Content-Type: application/json" \
  -d '{
    "image_base64": "<base64编码>",
    "mime_type": "image/png"
  }'
```

## 报告结构

```markdown
# K线视觉分析报告 — 贵州茅台(600519)

## 图表识别
- 图表类型: kline
- 标的代码: 600519
- 周期: 日线
- 识别置信度: 85%

## K线分析

### 趋势判断: 📈 上升趋势

### 关键价位
| 类型 | 价位 |
|------|------|
| 支撑位 | 1750 |
| 压力位 | 1850 |

### 形态识别
- 双底

### 综合判断
整体呈上升趋势

## 交叉验证
- 最新收盘价: 1800.00
- ✅ 视觉趋势与真实行情一致

## 风险提示
以上分析仅基于K线图形观察...
```

## 增强功能（v0.55）

- **市场推断**：从 ticker 自动推断 CN/HK/US
- **置信度门控**：低置信度时标注警告
- **结构化报告**：Markdown 格式，含表格/图标/分节
- **报告端点**：独立的 `/api/vision/report` 端点
