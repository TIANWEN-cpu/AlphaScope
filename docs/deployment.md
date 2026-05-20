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
# 编辑 .env，至少配置 DEEPSEEK_API_KEY

# 启动全部服务 (Streamlit + FastAPI + Redis)
docker-compose up -d

# 仅启动 Streamlit (port 8501)
docker-compose up -d app

# 仅启动 FastAPI API (port 8000)
docker-compose up -d api

# 启动 Streamlit + FastAPI
docker-compose up -d app api
```

服务说明：

| 服务 | 端口 | 说明 |
|------|------|------|
| `app` | 8501 | Streamlit 界面（传统 UI） |
| `api` | 8000 | FastAPI REST API（27 端点） |
| `redis` | 6379 | Redis 缓存 |

健康检查：
```bash
docker-compose ps                    # 查看服务状态
curl http://localhost:8501/_stcore/health  # Streamlit
curl http://localhost:8000/health          # FastAPI
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

GitHub Actions 自动运行 3 个 job：

```yaml
jobs:
  lint-and-test:    # Python 3.11 + 3.12
    - ruff check + format check
    - pytest tests/ -v (355 tests)

  web-build:        # Node.js 20
    - npm ci
    - npm run build
    - npm run lint

  docker-build:     # 依赖 lint-and-test + web-build
    - docker build -t ai-finance:test .
    - docker run --rm ai-finance:test python -c "import backend"
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
