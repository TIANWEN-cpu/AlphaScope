# 安装指南

## 环境准备

### 1. 安装 Python

访问 [python.org](https://www.python.org/downloads/) 下载 Python 3.10 或更高版本。

安装时勾选 "Add Python to PATH"。

验证安装：
```bash
python --version
# 应显示 Python 3.10.x 或更高
```

### 2. 安装 Node.js

访问 [nodejs.org](https://nodejs.org/) 下载 LTS 版本（18+）。

验证安装：
```bash
node --version
# 应显示 v18.x.x 或更高

npm --version
# 应显示 9.x.x 或更高
```

### 3. 安装 Git（可选）

如需获取最新代码：
- Windows: [git-scm.com](https://git-scm.com/)
- macOS: `brew install git`
- Ubuntu: `sudo apt install git`

---

## 安装研策中枢 AlphaScope

### 方式一：一键安装（推荐）

1. 下载项目并解压
2. 双击 `AI-Finance-Setup.bat`
3. 按提示完成安装
4. 桌面会出现 "AI-Finance" 快捷方式
5. 以后双击快捷方式即可启动

### 方式二：下载发布包

1. 前往 [GitHub Releases](https://github.com/TIANWEN-cpu/AI--FINANCE/releases)
2. 下载最新版本的压缩包
3. 解压到任意目录

### 方式三：Git 克隆

```bash
git clone https://github.com/TIANWEN-cpu/AI--FINANCE.git
cd AI--FINANCE
```

---

## 安装依赖

### 后端依赖

```bash
# 在项目根目录
pip install -e .
```

### 前端依赖

```bash
cd apps/web
npm install
cd ../..
```

---

## 初始化配置

### 1. 创建环境文件

```bash
# 复制示例配置
cp .env.example .env
```

### 2. 编辑 .env 文件

用文本编辑器打开 `.env`，填入你的 API Key：

```env
# 至少配置一个 LLM 提供商
DEEPSEEK_API_KEY=your_deepseek_key_here

# 可选：其他 LLM 提供商
ANTHROPIC_API_KEY=your_claude_key_here
OPENAI_API_KEY=your_openai_key_here
MOONSHOT_API_KEY=your_mimo_key_here
SENSENOVA_API_KEY=your_sensenova_key_here

# 可选：数据源
TUSHARE_TOKEN=your_tushare_token_here
TAVILY_API_KEY=your_tavily_key_here
FINNHUB_API_KEY=your_finnhub_key_here
```

### 3. 初始化数据目录

```bash
python scripts/init_local.py
```

这会创建：
- `data/uploads/` - 上传文件
- `data/reports/` - 分析报告
- `data/cache/` - 缓存数据
- `data/logs/` - 运行日志
- `data/db/` - 本地数据库

---

## 启动服务

### Windows

双击 `scripts/start_local.bat`

或在 PowerShell 中：
```powershell
.\scripts\start_local.ps1
```

### macOS / Linux

```bash
# 启动后端
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 &

# 启动前端
cd apps/web && npm run dev &
```

### 验证启动

浏览器访问：
- 前端界面: http://localhost:3000
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

---

## 停止服务

### Windows

双击 `scripts/stop_local.ps1`

或关闭所有终端窗口。

### macOS / Linux

```bash
# 查找并终止进程
pkill -f "uvicorn backend.api.main"
pkill -f "vite"
```

---

## 下一步

安装完成后，请继续阅读[快速开始](02-quickstart.md)了解首次使用流程。

