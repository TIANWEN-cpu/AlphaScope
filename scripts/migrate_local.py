"""数据迁移脚本 — 将旧目录结构迁移到 data/ 统一目录"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# 新目录结构
NEW_DIRS = [
    "data",
    "data/db",
    "data/cache",
    "data/reports",
    "data/uploads",
    "data/logs",
]

# 迁移映射：(旧路径, 新路径, 类型)
MIGRATIONS = [
    ("cache/ai_finance.db", "data/db/ai_finance.db", "file"),
    ("cache/chroma_db", "data/cache/chroma_db", "dir"),
    ("cache/fundamentals", "data/cache/fundamentals", "dir"),
    ("cache/backtest_tracking.jsonl", "data/cache/backtest_tracking.jsonl", "file"),
    ("cache/traces.jsonl", "data/cache/traces.jsonl", "file"),
    ("cache/cost_log.jsonl", "data/cache/cost_log.jsonl", "file"),
    ("reports", "data/reports", "dir"),
    ("uploads", "data/uploads", "dir"),
]


def _migrate_file(src: Path, dst: Path) -> bool:
    """迁移单个文件"""
    if not src.exists():
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        print(f"  [跳过] {dst} 已存在")
        return False
    shutil.move(str(src), str(dst))
    return True


def _migrate_dir(src: Path, dst: Path) -> bool:
    """迁移整个目录"""
    if not src.exists() or not any(src.iterdir()):
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        # 合并：将源目录内容移动到目标目录
        for item in src.iterdir():
            target = dst / item.name
            if target.exists():
                print(f"  [跳过] {target} 已存在")
                continue
            shutil.move(str(item), str(target))
    else:
        shutil.move(str(src), str(dst))
    return True


def main() -> int:
    print("AI-Finance 数据迁移")
    print("=" * 40)
    print(f"项目根目录: {PROJECT_ROOT}\n")

    # 1. 创建新目录
    print("创建新目录结构:")
    for d in NEW_DIRS:
        path = PROJECT_ROOT / d
        path.mkdir(parents=True, exist_ok=True)
        print(f"  [OK] {d}/")

    # 2. 执行迁移
    print("\n迁移数据:")
    migrated = 0
    for src_rel, dst_rel, mtype in MIGRATIONS:
        src = PROJECT_ROOT / src_rel
        dst = PROJECT_ROOT / dst_rel
        if mtype == "file":
            if _migrate_file(src, dst):
                print(f"  [移动] {src_rel} → {dst_rel}")
                migrated += 1
        else:
            if _migrate_dir(src, dst):
                print(f"  [移动] {src_rel}/ → {dst_rel}/")
                migrated += 1

    # 3. 清理旧的空 cache 目录中的残留
    cache_dir = PROJECT_ROOT / "cache"
    if cache_dir.exists():
        remaining = list(cache_dir.iterdir())
        if remaining:
            print(f"\n旧 cache/ 目录仍有 {len(remaining)} 个文件/目录未迁移:")
            for item in remaining:
                print(f"  - {item.name}")
        else:
            # 空目录，删除
            cache_dir.rmdir()
            print("\n旧 cache/ 目录已删除（空目录）")

    # 4. 迁移报告
    print(f"\n迁移完成: {migrated} 项")
    print("\n新目录结构:")
    for d in NEW_DIRS:
        path = PROJECT_ROOT / d
        count = len(list(path.iterdir())) if path.exists() else 0
        print(f"  {d}/ ({count} 项)")

    if migrated > 0:
        print("\n建议: 确认数据无误后，可手动删除旧的 cache/ 和 reports/ 目录")

    return 0


if __name__ == "__main__":
    sys.exit(main())
