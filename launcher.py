"""
AI-Finance 启动器

PyInstaller 打包入口。负责：
1. 设置 Python 路径（将打包的 backend/ 加入 sys.path）
2. 创建运行时目录（cache/, reports/）
3. 初始化 .env 文件
4. 启动 Streamlit 服务
"""

import os
import sys
import shutil
from pathlib import Path


def setup_environment():
    """设置运行时环境"""
    # 确定项目根目录
    if getattr(sys, "frozen", False):
        # PyInstaller 打包模式
        root = Path(sys.executable).parent
        meipass = Path(getattr(sys, "_MEIPASS", root))
        # 将打包的 backend/ 加入 sys.path
        backend_in_bundle = meipass / "backend"
        if backend_in_bundle.exists():
            sys.path.insert(0, str(backend_in_bundle))
        # 也加入根目录（开发模式兼容）
        sys.path.insert(0, str(root))
    else:
        # 开发模式
        root = Path(__file__).parent
        sys.path.insert(0, str(root / "backend"))
        sys.path.insert(0, str(root))

    # Streamlit 环境变量
    os.environ["STREAMLIT_SERVER_FILE_WATCHER_TYPE"] = "none"
    os.environ["STREAMLIT_SERVER_HEADLESS"] = "true"
    os.environ["STREAMLIT_BROWSER_GATHER_USAGE_STATS"] = "false"
    os.environ["STREAMLIT_SERVER_PORT"] = "8501"
    os.environ["STREAMLIT_SERVER_ADDRESS"] = "localhost"

    return root


def ensure_directories(root: Path):
    """确保运行时目录存在"""
    dirs = [
        root / "cache",
        root / "data" / "db",
        root / "data" / "cache",
        root / "data" / "cache" / "fundamentals",
        root / "data" / "cache" / "chroma_db",
        root / "data" / "reports",
        root / "data" / "reports" / "archive",
        root / "data" / "uploads",
        root / "data" / "logs",
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)


def ensure_env_file(root: Path):
    """如果 .env 不存在，从 .env.example 复制"""
    env_file = root / ".env"
    env_example = root / ".env.example"

    if not env_file.exists():
        if env_example.exists():
            shutil.copy2(env_example, env_file)
            print(f"[AI-Finance] 已创建 .env 配置文件: {env_file}")
            print("[AI-Finance] 请编辑 .env 文件，填入您的 API Key")
        else:
            # 创建最小 .env
            env_file.write_text(
                "# AI-Finance API Keys\n"
                "# 请填入您的 API Key\n"
                "DEEPSEEK_API_KEY=\n"
                "CLAUDE_API_KEY=\n"
                "GPT_API_KEY=\n"
                "MIMO_API_KEY=\n"
                "SENSENOVA_API_KEY=\n",
                encoding="utf-8",
            )
            print(f"[AI-Finance] 已创建 .env 模板: {env_file}")


def main():
    """主入口"""
    print("=" * 50)
    print("  AI-Finance - 金融 AI 分析工作台")
    print("  Multi-Agent Financial Analysis Workbench")
    print("=" * 50)
    print()

    root = setup_environment()
    ensure_directories(root)
    ensure_env_file(root)

    print(f"[AI-Finance] 项目目录: {root}")
    print("[AI-Finance] 正在启动...")
    print()

    # 构建 Streamlit 启动参数
    # 在 frozen 模式下，dashboard.py 在 _MEIPASS 里
    if getattr(sys, "frozen", False):
        meipass = Path(getattr(sys, "_MEIPASS", root))
        dashboard_path = meipass / "frontend" / "dashboard.py"
    else:
        dashboard_path = root / "frontend" / "dashboard.py"

    if not dashboard_path.exists():
        print(f"[错误] 找不到 dashboard.py: {dashboard_path}")
        input("按 Enter 键退出...")
        sys.exit(1)

    # 启动 Streamlit
    sys.argv = [
        "streamlit",
        "run",
        str(dashboard_path),
        "--server.port=8501",
        "--server.headless=true",
        "--browser.gatherUsageStats=false",
        "--server.fileWatcherType=none",
    ]

    try:
        import streamlit.web.cli as st_cli

        st_cli.main()
    except (ImportError, AttributeError):
        import streamlit

        streamlit.run()
    except KeyboardInterrupt:
        print("\n[AI-Finance] 已停止")
    except Exception as e:
        print(f"\n[错误] 启动失败: {e}")
        input("按 Enter 键退出...")
        sys.exit(1)


if __name__ == "__main__":
    main()
