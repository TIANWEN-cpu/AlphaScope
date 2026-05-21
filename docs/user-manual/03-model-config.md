# 模型接入配置

AI-FINANCE 支持多家 LLM 提供商，可配置多个模型用于不同 Agent。

---

## 支持的 LLM 提供商

| 提供商 | 模型 | 特点 | 价格 |
|--------|------|------|------|
| DeepSeek | deepseek-chat | 性价比高、中文优秀 | 极低 |
| Anthropic | claude-sonnet-4-5 | 推理能力强 | 中等 |
| Anthropic | claude-opus-4-7 | 最高质量 | 较高 |
| OpenAI | gpt-5.2 | 综合能力强 | 中等 |
| Mimo | mimo-v2.5-pro | 低成本、速度快 | 极低 |
| SenseNova | deepseek-v4-flash | 快速推理 | 极低 |

---

## 配置方式

### 方式一：通过界面配置（推荐）

1. 打开 http://localhost:3000
2. 点击左侧 **设置**
3. 选择 **模型配置**
4. 点击 **添加 Provider**

填写信息：

| 字段 | 说明 | 示例 |
|------|------|------|
| 名称 | Provider 标识 | DeepSeek |
| Base URL | API 地址 | https://api.deepseek.com |
| API Key | 你的密钥 | sk-xxx... |
| 模型列表 | 支持的模型 | deepseek-chat |

5. 点击 **测试连接** 验证配置
6. 点击 **保存**

### 方式二：编辑 .env 文件

```env
# DeepSeek（推荐入门）
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_BASE_URL=https://api.anthropic.com

# OpenAI
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com

# Mimo
MOONSHOT_API_KEY=sk-xxx
MOONSHOT_BASE_URL=https://api.mimo.ai

# SenseNova
SENSENOVA_API_KEY=xxx
SENSENOVA_BASE_URL=https://api.sensenova.cn
```

---

## 获取 API Key

### DeepSeek（推荐入门）

1. 访问 [platform.deepseek.com](https://platform.deepseek.com/)
2. 注册账号
3. 进入 **API Keys** 页面
4. 点击 **创建 API Key**
5. 复制 Key 到配置

### Anthropic Claude

1. 访问 [console.anthropic.com](https://console.anthropic.com/)
2. 注册账号
3. 进入 **API Keys** 页面
4. 点击 **Create Key**
5. 复制 Key 到配置

### OpenAI

1. 访问 [platform.openai.com](https://platform.openai.com/)
2. 注册账号
3. 进入 **API Keys** 页面
4. 点击 **Create new secret key**
5. 复制 Key 到配置

---

## 模型分配配置

编辑 `config/models.yaml` 可自定义每个 Agent 使用的模型：

```yaml
modes:
  deep:
    agents:
      - key: fundamental
        provider: claude
        model: claude-sonnet-4-5
      - key: technical
        provider: gpt
        model: gpt-5.2
      - key: sentiment
        provider: deepseek
        model: deepseek-chat
      - key: risk
        provider: sensenova
        model: deepseek-v4-flash
      - key: retail
        provider: mimo
        model: mimo-v2.5-pro
    critic:
      provider: claude
      model: claude-opus-4-7
    chairman:
      provider: claude
      model: claude-opus-4-7
```

---

## 测试连接

配置完成后，测试连接：

### 通过界面

1. 进入 **设置** > **模型配置**
2. 点击对应 Provider 的 **测试连接** 按钮
3. 看到 **连接成功** 表示配置正确

### 通过命令行

```bash
# 测试 DeepSeek
curl https://api.deepseek.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"

# 测试 Anthropic
curl https://api.anthropic.com/v1/models \
  -H "x-api-key: YOUR_API_KEY" \
  -H "anthropic-version: 2023-06-01"
```

---

## 降级与兜底

当主模型不可用时，系统自动降级到兜底模型：

```yaml
# config/models.yaml
fallback:
  provider: deepseek
  model: deepseek-chat
```

降级场景：
- API 调用失败
- 响应超时
- Token 限额耗尽
- 网络不可达

界面会显示黄色 ● 标记表示使用了兜底模型。

---

## 常见问题

### Q: 测试连接失败怎么办？

1. 检查 API Key 是否正确
2. 检查网络是否可达
3. 检查账户余额是否充足
4. 检查 Base URL 是否正确

### Q: 可以只配置一个 Provider 吗？

可以。只需配置 DeepSeek 即可使用标准模式。深入模式需要配置更多 Provider。

### Q: 如何查看 Token 用量？

1. 点击左侧 **成本统计**
2. 查看按 Agent/模型/模式的用量统计

---

## 下一步

- [数据源接入](04-data-sources.md) - 配置行情和新闻数据源
- [专家团使用](05-expert-panel.md) - 自定义 Agent 和专家团
