"""
Team Loader: 从 YAML 加载专家团配置。

职责：
- 加载 experts.yaml 中的团队定义
- 解析团队成员配置
- 提供团队列表和成员查询接口
"""

import yaml
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

try:
    from project_paths import CONFIG_DIR
except ImportError:
    from backend.project_paths import CONFIG_DIR


EXPERTS_YAML_PATH = CONFIG_DIR / "experts.yaml"


@dataclass
class ExpertMember:
    """单个专家成员配置"""

    id: str
    name: str
    name_en: str = ""
    role: str = "member"
    provider: str = "deepseek"
    model: str = "deepseek-chat"
    prompt_file: str = ""
    focus_dims: List[str] = field(default_factory=list)
    stop_loss_style: str = ""
    output_schema: Dict[str, Any] = field(default_factory=dict)
    enabled: bool = True


@dataclass
class ExpertTeam:
    """专家团配置"""

    id: str
    name: str
    name_en: str = ""
    description: str = ""
    members: List[ExpertMember] = field(default_factory=list)
    workflow: str = "parallel_then_debate"
    max_rounds: int = 2
    require_citations: bool = True
    require_risk_review: bool = True


def load_teams(config_path: Optional[str] = None) -> Dict[str, ExpertTeam]:
    """从 experts.yaml 加载所有专家团配置"""
    p = Path(config_path) if config_path else EXPERTS_YAML_PATH
    if not p.exists():
        return {}
    try:
        raw = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}

    teams = {}
    for team_raw in raw.get("teams", []):
        if team_raw.get("expertType") != "team":
            continue
        team_id = team_raw.get("id", "")
        members = []
        for m in team_raw.get("members", []):
            members.append(
                ExpertMember(
                    id=m.get("id", ""),
                    name=m.get("name", ""),
                    name_en=m.get("nameEn", ""),
                    role=m.get("role", "member"),
                    provider=m.get("provider", "deepseek"),
                    model=m.get("model", "deepseek-chat"),
                    prompt_file=m.get("promptFile", ""),
                    focus_dims=m.get("focusDims", []),
                    stop_loss_style=m.get("stopLossStyle", ""),
                    enabled=m.get("enabled", True),
                )
            )
        teams[team_id] = ExpertTeam(
            id=team_id,
            name=team_raw.get("name", team_id),
            name_en=team_raw.get("nameEn", ""),
            description=team_raw.get("description", ""),
            members=members,
        )
    return teams


def get_team(team_id: str, config_path: Optional[str] = None) -> Optional[ExpertTeam]:
    """获取指定专家团配置"""
    teams = load_teams(config_path)
    return teams.get(team_id)


def list_team_names(config_path: Optional[str] = None) -> List[Dict[str, str]]:
    """返回所有团队的 id/name 列表，供 UI 选择"""
    teams = load_teams(config_path)
    return [{"id": t.id, "name": t.name, "name_en": t.name_en} for t in teams.values()]
