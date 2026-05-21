"""
AI-Finance 一键构建脚本

将项目打包成 Windows 可执行文件。

使用方式:
    python build.py

输出:
    dist/AI-Finance/  — 可独立运行的程序目录
    dist/AI-Finance/AI-Finance.exe  — 主程序

后续步骤（可选）:
    用 Inno Setup 编译 installer/setup.iss 生成安装包
"""

import sys
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent
DIST_DIR = ROOT / "dist" / "AI-Finance"


def check_pyinstaller():
    """检查 PyInstaller 是否安装"""
    try:
        import PyInstaller  # noqa: F401

        print(f"[OK] PyInstaller {PyInstaller.__version__}")
        return True
    except ImportError:
        print("[错误] PyInstaller 未安装")
        print("  请运行: pip install pyinstaller")
        return False


def clean_build():
    """清理旧的构建文件"""
    for d in [ROOT / "build", ROOT / "dist"]:
        if d.exists():
            print(f"[清理] 删除 {d}")
            shutil.rmtree(d, ignore_errors=True)


def run_pyinstaller():
    """执行 PyInstaller 打包"""
    spec_file = ROOT / "ai_finance.spec"
    if not spec_file.exists():
        print(f"[错误] 找不到 spec 文件: {spec_file}")
        return False

    print("[构建] 正在打包...")
    print(f"[构建] spec: {spec_file}")
    print()

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        str(spec_file),
        "--clean",
        "--noconfirm",
        "--log-level=WARN",
    ]

    result = subprocess.run(cmd, cwd=str(ROOT))
    if result.returncode != 0:
        print(f"\n[错误] PyInstaller 打包失败 (exit code: {result.returncode})")
        return False

    return True


def copy_runtime_files():
    """复制运行时文件到输出目录"""
    if not DIST_DIR.exists():
        print(f"[错误] 输出目录不存在: {DIST_DIR}")
        return False

    # 复制 .env.example
    env_example = ROOT / ".env.example"
    if env_example.exists():
        shutil.copy2(env_example, DIST_DIR / ".env.example")
        print(f"[复制] .env.example → {DIST_DIR}")

    # 创建运行时目录
    for d in [
        "data",
        "data/db",
        "data/cache",
        "data/cache/fundamentals",
        "data/cache/chroma_db",
        "data/reports",
        "data/reports/archive",
        "data/uploads",
        "data/logs",
    ]:
        (DIST_DIR / d).mkdir(parents=True, exist_ok=True)
    print("[创建] 运行时目录 (data/db, data/cache, data/reports, data/uploads, data/logs)")

    # 创建 README
    readme = DIST_DIR / "使用说明.txt"
    readme.write_text(
        "AI-Finance - 金融 AI 分析工作台\n"
        "================================\n\n"
        "首次使用:\n"
        "1. 双击 AI-Finance.exe 启动\n"
        "2. 程序会自动打开浏览器\n"
        "3. 编辑 .env 文件填入您的 API Key\n\n"
        "API Key 配置:\n"
        "  DEEPSEEK_API_KEY=sk-xxx   (必需，最低配置)\n"
        "  CLAUDE_API_KEY=sk-xxx     (可选)\n"
        "  GPT_API_KEY=sk-xxx        (可选)\n"
        "  MIMO_API_KEY=xxx          (可选)\n"
        "  SENSENOVA_API_KEY=xxx     (可选)\n\n"
        "访问地址:\n"
        "  http://localhost:8501\n\n"
        "数据目录:\n"
        "  data/db/       — SQLite 数据库\n"
        "  data/cache/    — 缓存数据\n"
        "  data/reports/  — 分析报告\n"
        "  data/uploads/  — 上传文件\n",
        encoding="utf-8",
    )
    print("[创建] 使用说明.txt")

    return True


def print_summary():
    """打印构建摘要"""
    exe_path = DIST_DIR / "AI-Finance.exe"
    size_mb = 0
    if exe_path.exists():
        size_mb = sum(f.stat().st_size for f in DIST_DIR.rglob("*") if f.is_file()) / (
            1024 * 1024
        )

    print()
    print("=" * 50)
    print("  构建完成!")
    print("=" * 50)
    print(f"  输出目录: {DIST_DIR}")
    print(f"  总大小:   {size_mb:.1f} MB")
    print(f"  主程序:   {exe_path}")
    print()
    print("  测试运行:")
    print(f"    双击 {exe_path}")
    print()
    print("  制作安装包 (可选):")
    print("    1. 安装 Inno Setup: https://jrsoftware.org/isinfo.php")
    print("    2. 打开 installer/setup.iss")
    print("    3. 点击 编译 → 生成安装包")
    print()


def main():
    print()
    print("=" * 50)
    print("  AI-Finance 构建脚本")
    print("=" * 50)
    print()

    # Step 1: 检查依赖
    if not check_pyinstaller():
        sys.exit(1)

    # Step 2: 清理
    clean_build()

    # Step 3: 打包
    if not run_pyinstaller():
        sys.exit(1)

    # Step 4: 复制运行时文件
    if not copy_runtime_files():
        sys.exit(1)

    # Step 5: 完成
    print_summary()


if __name__ == "__main__":
    main()
