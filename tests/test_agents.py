"""Agent/专家团配置测试"""

from __future__ import annotations


def test_team_loader_loads_teams():
    """load_teams() 能从 experts.yaml 加载团队"""
    from backend.teams.team_loader import load_teams

    teams = load_teams()
    assert len(teams) >= 1, "至少应有 1 个团队"
    assert "stock-partner" in teams, "应包含 stock-partner 团队"


def test_team_loader_member_count():
    """stock-partner 团队应有 10 名成员"""
    from backend.teams.team_loader import get_team

    team = get_team("stock-partner")
    assert team is not None
    assert len(team.members) == 10, f"应有 10 名成员，实际 {len(team.members)}"
    member_ids = [m.id for m in team.members]
    expected = [
        "buffett",
        "lynch",
        "chanlun",
        "macro",
        "risk_officer",
        "sentiment",
        "fund_flow",
        "devil",
        "compliance",
        "summarizer",
    ]
    for eid in expected:
        assert eid in member_ids, f"缺少成员: {eid}"


def test_team_loader_member_fields():
    """成员应有完整的多语言字段"""
    from backend.teams.team_loader import get_team

    team = get_team("stock-partner")
    buffett = next(m for m in team.members if m.id == "buffett")
    assert buffett.name == "巴菲特派"
    assert buffett.name_en == "Buffett School"
    assert buffett.profession == "价值投资专家"
    assert buffett.provider == "claude"
    assert buffett.model == "claude-sonnet-4-5"
    assert buffett.role == "lead"
    assert "护城河" in buffett.focus_dims


def test_team_loader_nonexistent():
    """不存在的团队返回 None"""
    from backend.teams.team_loader import get_team

    assert get_team("nonexistent") is None


def test_list_team_names():
    """list_team_names 返回正确格式"""
    from backend.teams.team_loader import list_team_names

    names = list_team_names()
    assert len(names) >= 1
    assert all("id" in t and "name" in t for t in names)


def test_agent_schemas_import():
    """backend.schemas.agents 可正常导入"""
    from backend.schemas.agents import (
        AgentConfig,
    )

    # 验证基本实例化
    agent = AgentConfig(key="test", name="Test Agent")
    assert agent.key == "test"
    assert agent.provider == "deepseek"
    assert agent.enabled is True


def test_workflow_mode_enum():
    """WorkflowMode 枚举值正确"""
    from backend.schemas.agents import WorkflowMode

    assert WorkflowMode.SINGLE_AGENT == "single_agent"
    assert WorkflowMode.PARALLEL_EXPERTS == "parallel_experts"
    assert WorkflowMode.DEBATE == "debate"
    assert WorkflowMode.ROUNDTABLE == "roundtable"


def test_agent_output_defaults():
    """AgentOutput 默认值正确"""
    from backend.schemas.agents import AgentOutput

    out = AgentOutput()
    assert out.signal == "观望"
    assert out.confidence == 50.0
    assert out.reason == "无明确观点"
    assert out.evidence == []


def test_expert_output_defaults():
    """ExpertOutput 默认值正确"""
    from backend.schemas.agents import ExpertOutput

    out = ExpertOutput()
    assert out.action == "观望"
    assert out.position == 0
    assert out.risks == []


def test_analysis_summary():
    """AnalysisSummary 计算正确"""
    from backend.schemas.agents import AnalysisSummary

    s = AnalysisSummary(buy=3, sell=1, hold=1, avg_confidence=72.5, total_agents=5)
    assert s.final == "观望"  # 默认值，需要外部逻辑设置
    assert s.buy == 3
    assert s.total_agents == 5


def test_team_config_from_dict():
    """TeamConfig 可从字典构建"""
    from backend.schemas.agents import TeamConfig, ExpertMemberConfig, WorkflowMode

    team = TeamConfig(
        id="test-team",
        name="测试团队",
        workflow=WorkflowMode.DEBATE,
        members=[
            ExpertMemberConfig(id="a", name="专家A", provider="deepseek"),
            ExpertMemberConfig(id="b", name="专家B", provider="claude"),
        ],
    )
    assert team.id == "test-team"
    assert team.workflow == WorkflowMode.DEBATE
    assert len(team.members) == 2
    assert team.members[0].provider == "deepseek"


def test_tool_permission():
    """ToolPermission 模型正确"""
    from backend.schemas.agents import ToolPermission

    tp = ToolPermission(name="market_data", tool_type="data_source", provider="akshare")
    assert tp.name == "market_data"
    assert tp.enabled is True
    assert tp.rate_limit == ""


def test_model_config():
    """ModelConfig 模型正确"""
    from backend.schemas.agents import ModelConfig

    mc = ModelConfig(provider="deepseek", model="deepseek-chat", max_tokens=600)
    assert mc.provider == "deepseek"
    assert mc.temperature == 0.3  # 默认值
