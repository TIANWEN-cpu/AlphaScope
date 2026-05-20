"""Tests for scripts/check_env.py — 环境检查逻辑"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

# 将 scripts/ 加入 sys.path 以便导入
SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import check_env


def test_check_python_pass():
    """当前 Python 版本应通过检查"""
    assert check_env.check_python() is True


def test_check_python_fail():
    """Python 版本过低应失败"""
    from unittest.mock import MagicMock

    mock_ver = MagicMock()
    mock_ver.__ge__ = lambda self, other: False
    mock_ver.major = 3
    mock_ver.minor = 10
    mock_ver.micro = 0
    with patch.object(sys, "version_info", mock_ver):
        assert check_env.check_python() is False


def test_check_env_file_missing(tmp_path):
    """缺少 .env 文件应失败"""
    with patch.object(check_env, "PROJECT_ROOT", tmp_path):
        assert check_env.check_env_file() is False


def test_check_env_file_exists(tmp_path):
    """存在 .env 文件应通过"""
    (tmp_path / ".env").write_text("DEEPSEEK_API_KEY=test")
    with patch.object(check_env, "PROJECT_ROOT", tmp_path):
        assert check_env.check_env_file() is True


def test_check_env_file_no_example(tmp_path):
    """无 .env 也无 .env.example 应失败"""
    with patch.object(check_env, "PROJECT_ROOT", tmp_path):
        assert check_env.check_env_file() is False


def test_check_ports_all_free():
    """所有端口空闲应通过"""
    with patch("check_env._port_free", return_value=True):
        assert check_env.check_ports() is True


def test_check_ports_blocked():
    """有端口被占用应失败"""
    with patch("check_env._port_free", return_value=False):
        assert check_env.check_ports() is False


def test_check_dirs_missing(tmp_path):
    """缺少必要目录应失败"""
    with patch.object(check_env, "PROJECT_ROOT", tmp_path):
        assert check_env.check_dirs() is False


def test_check_dirs_complete(tmp_path):
    """所有目录齐全应通过"""
    for d in ("cache", "reports", "uploads"):
        (tmp_path / d).mkdir()
    with patch.object(check_env, "PROJECT_ROOT", tmp_path):
        assert check_env.check_dirs() is True


def test_main_all_pass(capsys):
    """所有检查通过时 main 返回 0"""
    with (
        patch.object(check_env, "check_python", return_value=True),
        patch.object(check_env, "check_node", return_value=True),
        patch.object(check_env, "check_npm", return_value=True),
        patch.object(check_env, "check_deps", return_value=True),
        patch.object(check_env, "check_env_file", return_value=True),
        patch.object(check_env, "check_ports", return_value=True),
        patch.object(check_env, "check_dirs", return_value=True),
    ):
        assert check_env.main() == 0


def test_main_has_failure(capsys):
    """有检查失败时 main 返回 1"""
    with (
        patch.object(check_env, "check_python", return_value=True),
        patch.object(check_env, "check_node", return_value=False),
        patch.object(check_env, "check_npm", return_value=True),
        patch.object(check_env, "check_deps", return_value=True),
        patch.object(check_env, "check_env_file", return_value=True),
        patch.object(check_env, "check_ports", return_value=True),
        patch.object(check_env, "check_dirs", return_value=True),
    ):
        assert check_env.main() == 1
