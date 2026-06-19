"""B-full · 投资人 persona 一键组队(桥接为 agent + 建团)API 测试。"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi.testclient import TestClient

from backend.api.main import app
import backend.storage.db as db_mod

client = TestClient(app)


@pytest.fixture
def tmp_db(monkeypatch):
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    tmp = Path(path)
    monkeypatch.setattr(db_mod, "DB_PATH", tmp)
    db_mod.Database._instance = None
    yield tmp
    db_mod.Database._instance = None
    try:
        os.unlink(tmp)
    except OSError:
        pass


def test_create_team_from_personas(tmp_db):
    resp = client.post(
        "/api/experts/team",
        json={"member_ids": ["buffett", "duan", "__nope__"], "name": "价值团"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    # 无效 persona 被过滤,避免悬空成员
    assert set(data["members"]) == {"buffett", "duan"}

    from backend.agent_store import get_agent, get_team

    # persona 已桥接登记为 agent
    bf = get_agent("buffett")
    assert bf is not None and bf.get("system_prompt")
    # 团队已创建且含 2 名成员
    team = get_team(data["team_id"])
    assert team is not None
    assert len(team["members"]) == 2


def test_create_team_no_valid(tmp_db):
    resp = client.post("/api/experts/team", json={"member_ids": ["__nope__"]})
    assert resp.status_code == 200
    assert resp.json()["success"] is False
