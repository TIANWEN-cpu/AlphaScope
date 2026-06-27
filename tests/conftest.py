"""Make backend importable from inside tests/.

Two import styles are used across the suite:
- ``from backend.foo import bar`` (needs the repo root on sys.path)
- ``from foo import bar``        (needs the backend/ dir on sys.path)

We insert both so collection succeeds regardless of how pytest is invoked
(``pytest`` vs ``python -m pytest``) or which subdirectory a test lives in.
"""

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
_BACKEND = _REPO_ROOT / "backend"
for _p in (_REPO_ROOT, _BACKEND):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))
