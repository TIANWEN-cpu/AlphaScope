"""环境检查脚本 — 验证本地运行所需条件"""

from __future__ import annotations

import socket
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
REQUIRED_PYTHON = (3, 11)
REQUIRED_NODE = 18

# Windows 终端 ANSI 颜色支持
if sys.platform == "win32":
    import os

    os.system("")  # 启用 ANSI 转义序列


def _check(name: str, ok: bool, detail: str = "") -> bool:
    tag = "\033[32m[OK]\033[0m" if ok else "\033[31m[FAIL]\033[0m"
    msg = f"  {tag} {name}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    return ok


def _cmd_version(cmd: str) -> str | None:
    try:
        r = subprocess.run(
            [cmd, "--version"],
            capture_output=True,
            text=True,
            timeout=10,
            shell=sys.platform == "win32",
        )
        return r.stdout.strip()
    except Exception:
        return None


def _port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def check_python() -> bool:
    v = sys.version_info
    ok = v >= REQUIRED_PYTHON
    return _check(
        "Python",
        ok,
        f"{v.major}.{v.minor}.{v.micro} (需要 >= {REQUIRED_PYTHON[0]}.{REQUIRED_PYTHON[1]})",
    )


def check_node() -> bool:
    ver = _cmd_version("node")
    if not ver:
        return _check("Node.js", False, "未安装")
    try:
        # node --version 输出格式: "v24.15.0"
        version_str = ver.lstrip("v").split()[0]
        major = int(version_str.split(".")[0])
    except (IndexError, ValueError):
        major = 0
    ok = major >= REQUIRED_NODE
    return _check("Node.js", ok, f"{ver} (需要 >= {REQUIRED_NODE})")


def check_npm() -> bool:
    ver = _cmd_version("npm")
    ok = ver is not None
    return _check("npm", ok, ver or "未安装")


def check_deps() -> bool:
    missing = []
    for mod in ("fastapi", "streamlit", "openai", "uvicorn"):
        try:
            __import__(mod)
        except ImportError:
            missing.append(mod)
    ok = len(missing) == 0
    detail = f"缺少: {', '.join(missing)}" if missing else "已安装"
    return _check("Python 依赖", ok, detail)


def check_env_file() -> bool:
    env = PROJECT_ROOT / ".env"
    example = PROJECT_ROOT / ".env.example"
    if env.exists():
        return _check(".env 文件", True, "存在")
    if example.exists():
        return _check(".env 文件", False, "不存在，请执行: copy .env.example .env")
    return _check(".env 文件", False, "不存在且无 .env.example 模板")


def check_ports() -> bool:
    ports = [3000, 8000, 8501]
    blocked = [p for p in ports if not _port_free(p)]
    ok = len(blocked) == 0
    detail = f"被占用: {blocked}" if blocked else f"{ports} 均可用"
    return _check("端口", ok, detail)


def check_dirs() -> bool:
    required = ["cache", "reports", "uploads"]
    missing = [d for d in required if not (PROJECT_ROOT / d).is_dir()]
    ok = len(missing) == 0
    detail = f"缺少: {', '.join(missing)}" if missing else "齐全"
    return _check("数据目录", ok, detail)


def main() -> int:
    print("AI-Finance 环境检查\n")
    checks = [
        check_python(),
        check_node(),
        check_npm(),
        check_deps(),
        check_env_file(),
        check_ports(),
        check_dirs(),
    ]
    passed = sum(checks)
    total = len(checks)
    print(f"\n结果: {passed}/{total} 通过")
    if all(checks):
        print("\033[32m可以启动！\033[0m")
        return 0
    print("\033[31m请先修复上述问题再启动。\033[0m")
    return 1


if __name__ == "__main__":
    sys.exit(main())
