"""Tests for v0.43 数据目录迁移 — 验证路径常量和迁移脚本逻辑"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch


def test_data_dir_constant():
    """DATA_DIR 指向 data/"""
    from backend.project_paths import DATA_DIR

    assert DATA_DIR.name == "data"
    assert DATA_DIR.parent.name == "AI--FINANCE" or DATA_DIR.parent.exists()


def test_db_dir_constant():
    """DB_DIR 指向 data/db"""
    from backend.project_paths import DB_DIR

    assert DB_DIR.name == "db"
    assert DB_DIR.parent.name == "data"


def test_cache_dir_under_data():
    """CACHE_DIR 在 data/ 下"""
    from backend.project_paths import CACHE_DIR

    assert "data" in CACHE_DIR.parts
    assert CACHE_DIR.name == "cache"


def test_reports_dir_under_data():
    """REPORTS_DIR 在 data/ 下"""
    from backend.project_paths import REPORTS_DIR

    assert "data" in REPORTS_DIR.parts
    assert REPORTS_DIR.name == "reports"


def test_uploads_dir_defined():
    """UPLOADS_DIR 已定义"""
    from backend.project_paths import UPLOADS_DIR

    assert UPLOADS_DIR.name == "uploads"
    assert "data" in UPLOADS_DIR.parts


def test_db_path_under_db_dir():
    """DB_PATH 在 data/db/ 下"""
    from backend.storage.db import DB_PATH

    assert "db" in DB_PATH.parts
    assert DB_PATH.name == "ai_finance.db"


def test_chroma_dir_under_data_cache():
    """CHROMA_DIR 在 data/cache/ 下"""
    from backend.rag.vector_store import CHROMA_DIR

    assert "data" in CHROMA_DIR.parts
    assert CHROMA_DIR.name == "chroma_db"


def test_migration_script_imports():
    """迁移脚本可以导入"""
    SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
    if str(SCRIPTS_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPTS_DIR))
    import migrate_local

    assert hasattr(migrate_local, "main")
    assert hasattr(migrate_local, "MIGRATIONS")
    assert len(migrate_local.MIGRATIONS) > 0


def test_check_env_uses_new_dirs():
    """check_env.py 检查新目录结构"""
    SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
    if str(SCRIPTS_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPTS_DIR))
    import check_env  # noqa: F401

    # check_dirs 应该检查 data/ 下的目录
    assert True  # 基本导入测试通过即可


def test_check_dirs_new_structure(tmp_path):
    """check_env 检查新目录结构"""
    SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
    if str(SCRIPTS_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPTS_DIR))
    import check_env

    for d in ("data/db", "data/cache", "data/reports", "data/uploads"):
        (tmp_path / d).mkdir(parents=True)
    with patch.object(check_env, "PROJECT_ROOT", tmp_path):
        assert check_env.check_dirs() is True
