# 部署文档

## 快速启动

### 方式一：本地开发

```bash
# 1. 克隆项目
git clone https://github.com/TIANWEN-cpu/AI--FINANCE.git
cd AI--FINANCE

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置 API Key
cp .env.example .env
# 编辑 .env，至少配置 DEEPSEEK_API_KEY

# 4. 启动 Streamlit 界面
python -m streamlit run frontend/dashboard.py --server.port 8501

# 5. (可选) 启动 FastAPI 后端
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000

# 6. (可选) 启动 Next.js 前端
cd apps/web && npm install && npm run dev
```

### 方式二：Docker Compose

```bash
cp .env.example .env
# 编辑 .env

docker-compose up -d
# Streamlit: http://localhost:8501
```

### 方式三：Windows .exe

```bash
pip install pyinstaller
python build.py
# 输出: dist/AI-Finance/AI-Finance.exe

# 制作安装包: 用 Inno Setup 打开 installer/setup.iss
```

## 依赖分层

| 文件 | 内容 | 用途 |
|------|------|------|
| `requirements-core.txt` | 核心运行时 | Streamlit, pandas, akshare, openai |
| `requirements-api.txt` | FastAPI | fastapi, uvicorn |
| `requirements-rag.txt` | RAG | chromadb (可选) |
| `requirements-dev.txt` | 开发 | pytest, ruff |
| `requirements.txt` | 聚合 | core + api + dev |

```bash
pip install -r requirements.txt           # 默认安装
pip install -r requirements-rag.txt       # 添加 RAG 支持
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | 是 | DeepSeek API Key |
| `CLAUDE_API_KEY` | 否 | Claude API Key |
| `OPENAI_API_KEY` | 否 | OpenAI API Key |
| `TAVILY_API_KEY` | 否 | 联网搜索 |
| `FINNHUB_API_KEY` | 否 | 美股数据 |
| `TUSHARE_TOKEN` | 否 | Tushare Pro Token |

## CI/CD

GitHub Actions 自动运行：

```yaml
# .github/workflows/ci.yml
on:
  push: [main, develop]
  pull_request: [main]

jobs:
  lint-and-test:
    - ruff check + format check
    - pytest tests/ -v
  docker-build:
    - docker build -t ai-finance:test .
```

## Makefile 命令

```bash
make install     # 安装依赖
make test        # 运行测试
make lint        # 代码检查
make format      # 代码格式化
make run         # 启动 Streamlit
make api         # 启动 FastAPI
make web-build   # 构建 Next.js
make docker-up   # Docker 启动
make check       # lint + test
```
