"""Pre-commit 格式化脚本 — 提交前自动运行 ruff format + check"""

from __future__ import annotations

import subprocess
import sys


def main() -> int:
    dirs = ["backend/", "frontend/", "tests/", "scripts/"]

    # 1. 自动格式化
    print("ruff format ...")
    subprocess.run(["ruff", "format"] + dirs, check=False)

    # 2. 检查
    print("ruff check ...")
    result = subprocess.run(["ruff", "check"] + dirs, check=False)
    if result.returncode != 0:
        print("\nruff check 失败，请修复后再提交。")
        return 1

    # 3. 格式验证
    print("ruff format --check ...")
    result = subprocess.run(["ruff", "format", "--check"] + dirs, check=False)
    if result.returncode != 0:
        print("\nruff format 不一致，请重新运行。")
        return 1

    print("\n格式检查通过！")
    return 0


if __name__ == "__main__":
    sys.exit(main())
