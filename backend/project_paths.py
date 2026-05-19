"""Project-local path helpers.

Keep runtime files relative to the repository root so a cloned copy works from
any directory and does not expose machine-specific paths.
"""

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
CONFIG_DIR = PROJECT_ROOT / "config"
REPORTS_DIR = PROJECT_ROOT / "reports"
CACHE_DIR = PROJECT_ROOT / "cache"
ENV_FILE = PROJECT_ROOT / ".env"
