# 安全文档

## 已实现的安全措施

### 1. API Key 保护

- **输出脱敏**: `compliance.sanitize_output()` 检测并替换输出中的 API Key 模式（OpenAI-style `sk-*`、AWS-style `AKIA*`、Bearer token）
- **日志脱敏**: 日志中不输出完整 API Key
- **配置隔离**: API Key 存储在 `.env` 文件中，不提交到 Git

### 2. Prompt Injection 防护

- **输入清洗**: `validators.sanitize_prompt_input()` 移除零宽字符、控制字符，限制输入长度
- **stock_data 清洗**: `validators.sanitize_stock_data_for_prompt()` 清洗注入到 prompt 中的数据

### 3. 金融合规

- **禁用词检查**: `compliance.check_forbidden_words()` 检测并替换确定性投资建议用语
  - 禁用词: 必涨、稳赚、无风险、保证收益、满仓、确定买入
  - 替代表达: 倾向、可能、需要验证、风险点包括
- **风险提示**: 所有分析模式（standard/deep/expert）自动追加合规声明
- **免责声明**: "以上分析仅供参考，不构成任何投资建议"

### 4. 文件上传限制

- **格式白名单**: .png, .jpg, .jpeg, .gif, .webp, .bmp, .pdf, .csv, .xlsx
- **大小限制**: 20MB
- **哈希校验**: MD5 文件哈希用于去重

### 5. CORS 配置

- 当前 `allow_origins=["*"]`（开发模式）
- 生产环境应限制为具体域名

### 6. Provider 健康追踪

- 每个 Provider 连续 3 次失败后标记为 UNHEALTHY
- 健康状态通过 `GET /api/providers/health` 暴露
- 自动降级到备用 Provider

## 待改进

| 项目 | 当前状态 | 建议 |
|------|----------|------|
| CORS | 全开放 | 生产环境限制域名 |
| Auth | 无 | 添加 API Key 或 OAuth |
| Rate Limiting | 无 | 添加请求频率限制 |
| Input Validation | 基础 | 增强 Pydantic 验证规则 |
| Audit Logging | 基础 | 记录所有 API 调用 |
