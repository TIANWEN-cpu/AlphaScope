"""Project-local path helpers.

Keep runtime files relative to the repository root so a cloned copy works from
any directory and does not expose machine-specific paths.

Supports PyInstaller frozen mode: when packaged as .exe, PROJECT_ROOT resolves
to the directory containing the executable (where config/, prompts/, cache/ etc.
are placed by the installer).
"""

import sys
from pathlib import Path

# PyInstaller frozen mode detection
if getattr(sys, "frozen", False):
    # 打包后：exe 所在目录作为项目根目录
    PROJECT_ROOT = Path(sys.executable).parent
else:
    # 开发模式：backend/ 的上级目录
    PROJECT_ROOT = Path(__file__).resolve().parents[1]

BACKEND_DIR = PROJECT_ROOT / "backend"
CONFIG_DIR = PROJECT_ROOT / "config"
REPORTS_DIR = PROJECT_ROOT / "reports"
CACHE_DIR = PROJECT_ROOT / "cache"
ENV_FILE = PROJECT_ROOT / ".env"
