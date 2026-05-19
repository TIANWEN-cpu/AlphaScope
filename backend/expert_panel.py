"""
专家圆桌服务层（v2.0 重构）

参考 workbuddy 专家团 manifest 格式，支持：
- 团队-成员层级（expertType: "team"）
- 角色区分（lead/member）
- promptFile 指向独立 Markdown 角色设定
- 多语言名称（zh/en）
- 细粒度 API Key（每个成员可单独配置）

依赖:
- config/experts.yaml (v2.0 teams 配置 + v1.0 兼容)
- config/providers.yaml (Provider 化架构)
- llm_agents.call_llm / VENDORS / FALLBACK_VENDOR_MODEL
- llm_agents._extract_json
"""

import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import llm_agents as _llm_agents  # noqa: E402
from project_paths import CONFIG_DIR, PROJECT_ROOT  # noqa: E402

# Streamlit 热重载时 sys.modules 里可能残留旧版 llm_agents(无 call_llm 别名)。
# 这里做运行时兜底,避免专家团组件因导入别名失败而不加载。
call_llm = getattr(_llm_agents, "call_llm", _llm_agents._call_with)
VENDORS = _llm_agents.VENDORS
FALLBACK_VENDOR_MODEL = _llm_agents.FALLBACK_VENDOR_MODEL
_extract_json = _llm_agents._extract_json

# v0.8: 统一 schema 校验,失败时退回恒等函数保持向后兼容
try:
    from validators import validate_expert_output as _validate_expert_output  # type: ignore
except Exception:  # pragma: no cover

    def _validate_expert_output(data):  # type: ignore[no-redef]
        return data if isinstance(data, dict) else {}


# ============== 配置路径 ==============
EXPERTS_YAML_PATH = CONFIG_DIR / "experts.yaml"


# ============== v2.0 Dataclass ==============
@dataclass
class ExpertMemberConfig:
    """团队成员配置（workbuddy 风格）"""

    id: str = ""
    display_name: str = ""  # zh 名称
    display_name_en: str = ""  # en 名称
    profession: str = ""  # zh 职业
    profession_en: str = ""  # en 职业
    avatar: str = ""
    prompt_file: str = ""  # Markdown 角色设定文件路径
    role: str = "member"  # "lead" | "member"
    provider: str = "deepseek"
    model: str = "deepseek-chat"
    api_key: str = ""  # 细粒度 API Key（可选）
    base_url: str = ""  # 细粒度 Base URL（可选）
    inherit_global_key: bool = True  # 是否继承统一 AI 设置
    enabled: bool = True  # 页面自定义：是否启用
    card_style: str = "default"  # 页面自定义：卡片样式
    focus_dims: List[str] = field(default_factory=list)
    stop_loss_style: str = "中等"
    system_prompt: str = ""  # 从 prompt_file 加载或内联


@dataclass
class ExpertTeamConfig:
    """团队配置（workbuddy 风格）"""

    id: str = ""
    display_name: str = ""
    display_name_en: str = ""
    description: str = ""
    avatar: str = ""
    prompt_file: str = ""
    output_schema: str = ""
    members: List[ExpertMemberConfig] = field(default_factory=list)


# ============== v1.0 兼容 Dataclass ==============
@dataclass
class ExpertConfig:
    key: str = ""
    name: str = ""
    style: str = ""
    icon: str = ""
    preferred_vendor: str = "deepseek"
    preferred_model: str = "deepseek-chat"
    system_prompt: str = ""
    focus_dims: List[str] = field(default_factory=list)
    stop_loss_style: str = "中等"


@dataclass
class ExpertOpinion:
    expert_key: str = ""
    expert_name: str = ""
    style: str = ""
    icon: str = ""
    view: str = ""
    # v0.8: evidence 升级为 [{type, claim, data_date}, ...];旧归档可能仍是 List[str],渲染层做兼容。
    evidence: List = field(default_factory=list)
    action: str = "观望"
    position: int = 0
    stop_loss: float = 0.0
    invalid_if: str = ""  # v0.8: 失效条件
    risks: List[str] = field(default_factory=list)  # v0.8: 主要风险
    vendor: str = ""
    model: str = ""
    fallback_used: bool = False
    ok: bool = True
    error_msg: str = ""
    role: str = "member"  # v2.0 新增:角色标识
    card_style: str = "default"  # v2.0 新增:前端卡片样式


# ============== Prompt 文件加载 ==============
def load_prompt_file(prompt_path: str) -> str:
    """加载 Markdown 角色设定文件"""
    if not prompt_path:
        return ""
    p = PROJECT_ROOT / prompt_path
    if not p.exists():
        # 尝试直接路径
        p = Path(prompt_path)
    if p.exists():
        return p.read_text(encoding="utf-8").strip()
    return ""


# ============== v2.0 配置加载 ==============
def load_experts_config_v2(yaml_path: Optional[Path] = None) -> List[ExpertTeamConfig]:
    """
    读取 experts.yaml v2.0 格式，返回 ExpertTeamConfig 列表。
    如果找不到 teams 配置，返回空列表（调用方应回退到 v1）。
    """
    p = yaml_path or EXPERTS_YAML_PATH
    if not p.exists():
        raise FileNotFoundError(f"experts.yaml 不存在: {p}")
    raw = yaml.safe_load(p.read_text(encoding="utf-8"))

    teams = []
    for team_raw in raw.get("teams", []):
        members = []
        for m_raw in team_raw.get("members", []):
            # 读取 promptFile
            prompt_file = m_raw.get("promptFile", "")
            system_prompt = load_prompt_file(prompt_file)

            # 多语言名称
            display_name = m_raw.get("displayName", {})
            profession = m_raw.get("profession", {})

            members.append(
                ExpertMemberConfig(
                    id=m_raw.get("id", ""),
                    display_name=display_name.get("zh", "")
                    if isinstance(display_name, dict)
                    else str(display_name),
                    display_name_en=display_name.get("en", "")
                    if isinstance(display_name, dict)
                    else "",
                    profession=profession.get("zh", "")
                    if isinstance(profession, dict)
                    else str(profession),
                    profession_en=profession.get("en", "")
                    if isinstance(profession, dict)
                    else "",
                    avatar=m_raw.get("avatar", ""),
                    prompt_file=prompt_file,
                    role=m_raw.get("role", "member"),
                    provider=m_raw.get("provider", "deepseek"),
                    model=m_raw.get("model", "deepseek-chat"),
                    api_key=m_raw.get("apiKey", ""),
                    base_url=m_raw.get("baseUrl", ""),
                    inherit_global_key=bool(m_raw.get("inheritGlobalKey", True)),
                    enabled=bool(m_raw.get("enabled", True)),
                    card_style=m_raw.get("cardStyle", "default"),
                    focus_dims=list(m_raw.get("focusDims", []) or []),
                    stop_loss_style=m_raw.get("stopLossStyle", "中等"),
                    system_prompt=system_prompt,
                )
            )

        team_display_name = team_raw.get("displayName", {})
        teams.append(
            ExpertTeamConfig(
                id=team_raw.get("id", ""),
                display_name=team_display_name.get("zh", "")
                if isinstance(team_display_name, dict)
                else str(team_display_name),
                display_name_en=team_display_name.get("en", "")
                if isinstance(team_display_name, dict)
                else "",
                description=team_raw.get("description", ""),
                avatar=team_raw.get("avatar", ""),
                prompt_file=team_raw.get("promptFile", ""),
                output_schema=team_raw.get("outputSchema", ""),
                members=members,
            )
        )

    return teams


# ============== v1.0 兼容配置加载 ==============
def load_experts_config(yaml_path: Optional[Path] = None) -> List[ExpertConfig]:
    """读取 experts.yaml v1.0 格式，返回 ExpertConfig 列表"""
    p = yaml_path or EXPERTS_YAML_PATH
    if not p.exists():
        raise FileNotFoundError(f"experts.yaml 不存在: {p}")
    raw = yaml.safe_load(p.read_text(encoding="utf-8"))
    out = []
    for item in raw.get("experts", []):
        out.append(
            ExpertConfig(
                key=item.get("key", ""),
                name=item.get("name", ""),
                style=item.get("style", ""),
                icon=item.get("icon", ""),
                preferred_vendor=item.get("preferred_vendor", "deepseek"),
                preferred_model=item.get("preferred_model", "deepseek-chat"),
                system_prompt=(item.get("system_prompt") or "").strip(),
                focus_dims=list(item.get("focus_dims", []) or []),
                stop_loss_style=item.get("stop_loss_style", "中等"),
            )
        )
    # 缓存 output_schema 全局
    global _OUTPUT_SCHEMA
    _OUTPUT_SCHEMA = (raw.get("output_schema") or "").strip()
    return out


_OUTPUT_SCHEMA = ""  # load_experts_config 时填充


# ============== 单专家调用 ==============
def _build_user_message(cfg, stock_brief: str, stock_name: str) -> str:
    """组装专家的 user message: 关注维度 + 市场简报 + 输出 schema"""
    schema_text = (
        _OUTPUT_SCHEMA
        or """必须严格按 JSON 返回:
{"view": "...", "evidence": ["...", "..."], "action": "买入|观望|减持|卖出", "position": 30, "stop_loss": 1500.0}"""
    )

    # v2.0 兼容
    focus_dims = getattr(cfg, "focus_dims", []) or getattr(cfg, "focusDims", [])
    style = getattr(cfg, "style", "") or getattr(cfg, "stop_loss_style", "中等")

    focus_line = "、".join(focus_dims) if focus_dims else "综合判断"
    stop_loss_style = getattr(cfg, "stop_loss_style", "中等")

    return f"""请基于以下 {stock_name} 的市场简报,从你的【{style}】视角出发分析。

【你的关注维度】{focus_line}
【你的止损风格】{stop_loss_style}

{stock_brief}

{schema_text}
"""


def _validate_opinion(data: dict, cfg) -> dict:
    """对 LLM 返回的 JSON 做合法性校验/兜底,统一委托给 validators.validate_expert_output。"""
    return _validate_expert_output(data)


def _resolve_expert_ai_config(cfg, global_ai_settings: Optional[dict] = None):
    global_ai_settings = global_ai_settings or {}
    preferred_vendor = getattr(cfg, "preferred_vendor", "") or getattr(
        cfg, "provider", "deepseek"
    )
    preferred_model = getattr(cfg, "preferred_model", "") or getattr(
        cfg, "model", "deepseek-chat"
    )
    api_key = getattr(cfg, "api_key", "") or ""
    base_url = getattr(cfg, "base_url", "") or ""
    if getattr(cfg, "inherit_global_key", True) and global_ai_settings.get(
        "use_unified_key", True
    ):
        preferred_vendor = global_ai_settings.get("provider") or preferred_vendor
        preferred_model = global_ai_settings.get("model") or preferred_model
        api_key = global_ai_settings.get("api_key", "") or api_key
        base_url = global_ai_settings.get("base_url", "") or base_url
    return preferred_vendor, preferred_model, api_key, base_url


def run_expert(
    cfg, stock_brief: str, stock_name: str, global_ai_settings: Optional[dict] = None
) -> ExpertOpinion:
    """
    单专家调用,含双层兜底。
    支持 v1.0 ExpertConfig 和 v2.0 ExpertMemberConfig。
    """
    user_msg = _build_user_message(cfg, stock_brief, stock_name)

    # 兼容 v1.0 和 v2.0 的属性访问
    system_prompt = getattr(cfg, "system_prompt", "") or load_prompt_file(
        getattr(cfg, "prompt_file", "")
    )
    preferred_vendor, preferred_model, api_key, base_url = _resolve_expert_ai_config(
        cfg, global_ai_settings
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_msg},
    ]

    primary = (preferred_vendor, preferred_model)
    fallback = FALLBACK_VENDOR_MODEL
    last_err = ""

    for vd, md, bu, key_override in [
        (preferred_vendor, preferred_model, base_url, api_key or None),
        (fallback[0], fallback[1], "", None),
    ]:
        # 检查厂商配置是否完整；自定义 Base URL 时允许使用临时配置。
        cfg_v = VENDORS.get(vd) or {}
        if (
            not bu
            and (not cfg_v.get("api_key") or not cfg_v.get("base_url"))
            and not key_override
        ):
            last_err = f"{vd} 未配置完整"
            continue

        try:
            mtokens = 1500 if vd == "mimo" else 700
            # v2.0 支持细粒度 API Key
            text = call_llm(
                vendor=vd,
                model=md,
                messages=messages,
                json_mode=True,
                max_tokens=mtokens,
                temperature=0.4,
                api_key=key_override,
                base_url=bu or None,
            )
            data = _extract_json(text)
            if not data or not data.get("view"):
                # 同厂商再补一次
                text2 = call_llm(
                    vendor=vd,
                    model=md,
                    messages=messages
                    + [
                        {"role": "assistant", "content": text or ""},
                        {
                            "role": "user",
                            "content": "请只输出符合格式的 JSON 对象,不要任何前后说明。",
                        },
                    ],
                    json_mode=True,
                    max_tokens=mtokens,
                    temperature=0.2,
                    api_key=key_override,
                    base_url=bu or None,
                )
                data = _extract_json(text2)

            if not data or not data.get("view"):
                last_err = f"{vd} 未返回有效 JSON"
                continue

            valid = _validate_opinion(data, cfg)
            return ExpertOpinion(
                expert_key=getattr(cfg, "key", "") or getattr(cfg, "id", ""),
                expert_name=getattr(cfg, "name", "")
                or getattr(cfg, "display_name", ""),
                style=getattr(cfg, "style", "") or getattr(cfg, "profession", ""),
                icon=getattr(cfg, "icon", "") or getattr(cfg, "avatar", ""),
                view=valid["view"],
                evidence=valid["evidence"],
                action=valid["action"],
                position=valid["position"],
                stop_loss=valid["stop_loss"],
                invalid_if=valid.get("invalid_if", ""),
                risks=valid.get("risks", []),
                vendor=VENDORS[vd]["label"],
                model=md,
                fallback_used=(vd != primary[0]),
                ok=True,
                role=getattr(cfg, "role", "member"),
                card_style=getattr(cfg, "card_style", "default"),
            )
        except Exception as e:
            last_err = str(e)[:200]
            continue

    return ExpertOpinion(
        expert_key=getattr(cfg, "key", "") or getattr(cfg, "id", ""),
        expert_name=getattr(cfg, "name", "") or getattr(cfg, "display_name", ""),
        style=getattr(cfg, "style", "") or getattr(cfg, "profession", ""),
        icon=getattr(cfg, "icon", "") or getattr(cfg, "avatar", ""),
        view="(该专家暂不可用)",
        evidence=[],
        action="观望",
        position=0,
        stop_loss=0.0,
        vendor="?",
        model="?",
        fallback_used=True,
        ok=False,
        error_msg=last_err or "未知错误",
        role=getattr(cfg, "role", "member"),
    )


# ============== 团队并行调用 ==============
def load_default_team() -> ExpertTeamConfig:
    """读取默认专家团队；若 v2 配置不可用，则从 v1 experts 兼容生成。"""
    teams = load_experts_config_v2()
    if teams:
        return teams[0]
    experts = load_experts_config()
    return ExpertTeamConfig(
        id="default-team",
        display_name="默认专家团",
        avatar="🎓",
        members=[
            ExpertMemberConfig(
                id=e.key,
                display_name=e.name,
                profession=e.style,
                avatar=e.icon,
                role="member",
                provider=e.preferred_vendor,
                model=e.preferred_model,
                focus_dims=e.focus_dims,
                stop_loss_style=e.stop_loss_style,
                system_prompt=e.system_prompt,
            )
            for e in experts
        ],
    )


def team_to_editable_dict(team: ExpertTeamConfig) -> dict:
    """将 ExpertTeamConfig 转成 Streamlit session_state 友好的可编辑 dict。"""
    return {
        "id": team.id or "custom-team",
        "display_name": team.display_name or "自定义专家团",
        "avatar": team.avatar or "🎓",
        "description": team.description or "",
        "members": [
            {
                "id": m.id,
                "enabled": getattr(m, "enabled", True),
                "name": m.display_name,
                "profession": m.profession,
                "avatar": m.avatar or "🧠",
                "role": m.role or "member",
                "provider": m.provider or "deepseek",
                "model": m.model or "deepseek-chat",
                "base_url": getattr(m, "base_url", ""),
                "api_key": getattr(m, "api_key", ""),
                "inherit_global_key": getattr(m, "inherit_global_key", True),
                "focus_dims": ", ".join(m.focus_dims or []),
                "stop_loss_style": m.stop_loss_style or "中等",
                "system_prompt": m.system_prompt or load_prompt_file(m.prompt_file),
                "card_style": getattr(m, "card_style", "default"),
            }
            for m in team.members
        ],
    }


def editable_dict_to_team(data: dict) -> ExpertTeamConfig:
    """将页面编辑 dict 转回 ExpertTeamConfig，仅使用 enabled=True 的成员运行。"""
    members = []
    seen = set()
    for idx, raw in enumerate(data.get("members", []) or []):
        base_id = (raw.get("id") or f"expert_{idx + 1}").strip().replace(" ", "_")
        member_id = base_id
        suffix = 2
        while member_id in seen:
            member_id = f"{base_id}_{suffix}"
            suffix += 1
        seen.add(member_id)
        focus_raw = raw.get("focus_dims", "")
        if isinstance(focus_raw, str):
            focus_dims = [
                x.strip() for x in focus_raw.replace("，", ",").split(",") if x.strip()
            ]
        else:
            focus_dims = list(focus_raw or [])
        members.append(
            ExpertMemberConfig(
                id=member_id,
                display_name=raw.get("name", member_id),
                profession=raw.get("profession", "自定义专家"),
                avatar=raw.get("avatar", "🧠"),
                role=raw.get("role", "member"),
                provider=raw.get("provider", "deepseek"),
                model=raw.get("model", "deepseek-chat"),
                api_key=raw.get("api_key", ""),
                base_url=raw.get("base_url", ""),
                inherit_global_key=bool(raw.get("inherit_global_key", True)),
                enabled=bool(raw.get("enabled", True)),
                focus_dims=focus_dims,
                stop_loss_style=raw.get("stop_loss_style", "中等"),
                system_prompt=(raw.get("system_prompt") or "").strip(),
                card_style=raw.get("card_style", "default"),
            )
        )
    return ExpertTeamConfig(
        id=data.get("id", "custom-team"),
        display_name=data.get("display_name", "自定义专家团"),
        avatar=data.get("avatar", "🎓"),
        description=data.get("description", ""),
        members=members,
    )


# ============== 团队并行调用 ==============
def run_team_roundtable(
    team: ExpertTeamConfig,
    stock_brief: str,
    stock_name: str,
    global_ai_settings: Optional[dict] = None,
) -> dict:
    """
    v2.0 团队并行调用。返回:
    {
        "opinions": {expert_key: ExpertOpinion, ...},
        "summary": {buy, hold, reduce, sell, avg_position, ...},
        "elapsed": float,
        "team_id": str,
        "team_name": str,
    }
    """
    t0 = time.time()
    if not team.members:
        return {
            "opinions": {},
            "summary": {},
            "elapsed": 0.0,
            "team_id": team.id,
            "team_name": team.display_name,
        }

    opinions: Dict[str, ExpertOpinion] = {}
    active_members = [m for m in team.members if getattr(m, "enabled", True)]
    if not active_members:
        return {
            "opinions": {},
            "summary": {},
            "elapsed": 0.0,
            "team_id": team.id,
            "team_name": team.display_name,
            "member_order": [],
        }

    with ThreadPoolExecutor(max_workers=len(active_members)) as ex:
        futs = {
            ex.submit(
                run_expert, member, stock_brief, stock_name, global_ai_settings
            ): member.id
            for member in active_members
        }
        for fut in as_completed(futs):
            try:
                op = fut.result(timeout=30)
            except Exception as e:
                ek = futs[fut]
                member_match = next((m for m in active_members if m.id == ek), None)
                op = ExpertOpinion(
                    expert_key=ek,
                    expert_name=member_match.display_name if member_match else ek,
                    style=member_match.profession if member_match else "",
                    icon=member_match.avatar if member_match else "",
                    view="(执行异常)",
                    action="观望",
                    ok=False,
                    error_msg=str(e)[:200],
                    role=member_match.role if member_match else "member",
                )
            opinions[op.expert_key] = op

    summary = summarize(opinions)
    return {
        "opinions": opinions,
        "summary": summary,
        "elapsed": round(time.time() - t0, 2),
        "team_id": team.id,
        "team_name": team.display_name,
        "member_order": [m.id for m in active_members],
    }


# ============== v1.0 兼容：5 路并行 ==============
def run_roundtable(
    stock_brief: str, stock_name: str, api_keys: Optional[Dict[str, str]] = None
) -> dict:
    """
    v1.0 兼容：5 专家并行调用。返回:
    {
        "opinions": {expert_key: ExpertOpinion, ...},
        "summary": {buy, hold, reduce, sell, avg_position, ...},
        "elapsed": float,
    }
    """
    t0 = time.time()
    experts = load_experts_config()
    if not experts:
        return {"opinions": {}, "summary": {}, "elapsed": 0.0}

    opinions: Dict[str, ExpertOpinion] = {}
    api_keys = api_keys or {}

    with ThreadPoolExecutor(max_workers=len(experts)) as ex:
        futs = {
            ex.submit(run_expert, cfg, stock_brief, stock_name): cfg.key
            for cfg in experts
        }
        for fut in as_completed(futs):
            try:
                op = fut.result(timeout=30)
            except Exception as e:
                ek = futs[fut]
                cfg_match = next((c for c in experts if c.key == ek), None)
                op = ExpertOpinion(
                    expert_key=ek,
                    expert_name=cfg_match.name if cfg_match else ek,
                    style=cfg_match.style if cfg_match else "",
                    icon=cfg_match.icon if cfg_match else "",
                    view="(执行异常)",
                    action="观望",
                    ok=False,
                    error_msg=str(e)[:200],
                )
            opinions[op.expert_key] = op

    summary = summarize(opinions)
    return {
        "opinions": opinions,
        "summary": summary,
        "elapsed": round(time.time() - t0, 2),
    }


# ============== 投票统计 ==============
def summarize(opinions: Dict[str, ExpertOpinion]) -> dict:
    """统计 buy/hold/reduce/sell + 平均仓位"""
    buy = hold = reduce_ = sell = 0
    total_pos = 0
    n_valid = 0
    for op in opinions.values():
        if not op.ok:
            continue
        n_valid += 1
        if op.action == "买入":
            buy += 1
        elif op.action == "观望":
            hold += 1
        elif op.action == "减持":
            reduce_ += 1
        elif op.action == "卖出":
            sell += 1
        total_pos += op.position

    avg_position = round(total_pos / n_valid, 1) if n_valid else 0.0
    return {
        "buy": buy,
        "hold": hold,
        "reduce": reduce_,
        "sell": sell,
        "avg_position": avg_position,
        "valid_count": n_valid,
        "total_count": len(opinions),
    }


# ============== Markdown 导出 ==============
def export_md(
    opinions: Dict[str, ExpertOpinion],
    summary: dict,
    stock_name: str,
    symbol: str,
    team_name: str = "",
) -> str:
    """三段式纪要"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    today = datetime.now().strftime("%Y-%m-%d")
    team_tag = f" · {team_name}" if team_name else ""

    lines = [
        f"# {stock_name}({symbol}) 专家圆桌纪要",
        "",
        f"> 召开时间: {now}  ",
        f"> 工作台: AI-Finance v2.0{team_tag} · 专家圆桌",
        "",
        "## 投票汇总",
        "",
        f"- **{summary.get('buy', 0)} 买 / {summary.get('hold', 0)} 观 / "
        f"{summary.get('reduce', 0)} 减 / {summary.get('sell', 0)} 卖**",
        f"- 平均建议仓位: **{summary.get('avg_position', 0):.1f}%**",
        f"- 有效专家: {summary.get('valid_count', 0)}/{summary.get('total_count', 0)}",
        "",
        "## 各专家观点",
        "",
    ]

    # 固定顺序展示（兼容 v1.0）
    order = ["buffett", "lynch", "chanlun", "macro", "risk_officer"]
    # 如果有不在固定列表中的 key，也展示出来
    remaining = [k for k in opinions.keys() if k not in order]

    for key in order + remaining:
        op = opinions.get(key)
        if not op:
            continue
        fb_tag = " ⚠️ *降级模型*" if op.fallback_used else ""
        ok_tag = "" if op.ok else " ❌ *该专家本次不可用*"
        role_tag = f" [{op.role}]" if op.role != "member" else ""
        lines += [
            f"### {op.icon} {op.expert_name}({op.style}){role_tag}{ok_tag}",
            "",
            f"> 模型: **{op.vendor}** / `{op.model}`{fb_tag}",
            "",
            f"**核心观点**: {op.view}",
            "",
            "**关键依据**:",
        ]
        if op.evidence:
            for ev in op.evidence:
                if isinstance(ev, dict):
                    parts = [str(ev.get("claim") or "").strip()]
                    etype = ev.get("type")
                    if etype and etype != "other":
                        parts.append(f"[{etype}]")
                    date = ev.get("data_date")
                    if date:
                        parts.append(f"({date})")
                    text = " ".join(p for p in parts if p)
                else:
                    text = str(ev).strip()
                if text:
                    lines.append(f"- {text}")
        else:
            lines.append("- (无)")
        lines += [
            "",
            f"**操作建议**: {op.action} | **建议仓位**: {op.position}% | "
            f"**止损位**: ¥{op.stop_loss:.2f}",
        ]
        if getattr(op, "invalid_if", ""):
            lines += ["", f"**失效条件**: {op.invalid_if}"]
        if getattr(op, "risks", None):
            lines += ["", "**主要风险**:"]
            for r in op.risks:
                lines.append(f"- {r}")
        lines += [
            "",
            "---",
            "",
        ]

    lines += [
        "",
        f"*由 AI-Finance v2.0 专家圆桌模块自动生成,数据来自 akshare {today}*",
    ]
    return "\n".join(lines)


# ============== 命令行自测 ==============
def _build_quick_brief(symbol: str, stock_name: str) -> str:
    """命令行测试用:从 akshare 拉一个简短行情简报"""
    import akshare as ak
    import pandas as pd
    from fund_flow import (
        fetch_individual_fund_flow,
        summarize_fund_flow,
        build_fund_flow_brief_for_llm,
    )

    lines = [f"【标的】{stock_name}({symbol})"]
    try:
        end = datetime.now().strftime("%Y%m%d")
        start = (datetime.now() - pd.Timedelta(days=180)).strftime("%Y%m%d")
        df = ak.stock_zh_a_hist(
            symbol=symbol, period="daily", start_date=start, end_date=end, adjust="qfq"
        )
        if df is not None and not df.empty:
            df.columns = [
                "date",
                "code",
                "open",
                "close",
                "high",
                "low",
                "volume",
                "amount",
                "amplitude",
                "pct_chg",
                "change",
                "turnover",
            ][: len(df.columns)]
            last = df.iloc[-1]
            first = df.iloc[0]
            period_chg = (last["close"] / first["close"] - 1) * 100
            lines += [
                "\n【价格信息】",
                f"- 最新价: ¥{last['close']:.2f} (当日 {last.get('pct_chg', 0):+.2f}%)",
                f"- 区间涨跌: {period_chg:+.2f}% (近 {len(df)} 个交易日)",
                f"- 区间最高/最低: ¥{df['high'].max():.2f} / ¥{df['low'].min():.2f}",
                f"- 成交均量: {df['volume'].mean():,.0f}手",
            ]
    except Exception as e:
        lines.append(f"(行情拉取失败: {e})")

    try:
        df_fund = fetch_individual_fund_flow(symbol, days=30)
        if df_fund is not None:
            s = summarize_fund_flow(df_fund, recent_days=5)
            lines.append("\n" + build_fund_flow_brief_for_llm(s, kind=stock_name))
    except Exception:
        pass

    return "\n".join(lines)


if __name__ == "__main__":
    code = sys.argv[1] if len(sys.argv) > 1 else "600519"
    name_map = {"600519": "贵州茅台", "300059": "东方财富", "000858": "五粮液"}
    name = name_map.get(code, code)

    print("=" * 70)
    print(f"专家圆桌测试: {name}({code})")
    print("=" * 70)

    # 先测试 v2.0 配置
    print("\n[0] 加载 v2.0 teams 配置...")
    teams = load_experts_config_v2()
    if teams:
        print(f"    ✓ 加载 {len(teams)} 个团队:")
        for t in teams:
            print(f"      团队: {t.display_name} ({len(t.members)} 位成员)")
            for m in t.members:
                role_tag = " [LEAD]" if m.role == "lead" else ""
                print(
                    f"        {m.avatar} {m.display_name}{role_tag} → {m.provider}/{m.model}"
                )
    else:
        print("    ! 未找到 v2.0 teams 配置，将使用 v1.0 兼容模式")

    print("\n[1] 加载 v1.0 experts 配置...")
    experts = load_experts_config()
    print(f"    ✓ {len(experts)} 位专家:")
    for e in experts:
        print(f"      {e.icon} {e.name:<10} → {e.preferred_vendor}/{e.preferred_model}")

    print("\n[2] 构造市场简报...")
    brief = _build_quick_brief(code, name)
    print(f"    ✓ 简报 {len(brief)} 字符")

    # 如果有 v2.0 团队配置，测试团队模式
    if teams:
        print(f"\n[3] v2.0 团队并行调用(团队: {teams[0].display_name})...")
        result = run_team_roundtable(teams[0], brief, name)
        print(f"    ✓ 完成,耗时 {result['elapsed']}s")
    else:
        print("\n[3] v1.0 5 专家并行调用(预计 8-15 秒)...")
        result = run_roundtable(brief, name)
        print(f"    ✓ 完成,耗时 {result['elapsed']}s")

    print("\n[4] 各专家观点:")
    order = ["buffett", "lynch", "chanlun", "macro", "risk_officer"]
    for key in order:
        op = result["opinions"].get(key)
        if not op:
            continue
        flag = "OK" if op.ok else "FAIL"
        fb = " (降级)" if op.fallback_used else ""
        role_tag = f" [{op.role}]" if getattr(op, "role", "member") != "member" else ""
        print(
            f"\n  {op.icon} {op.expert_name}{role_tag} [{op.vendor}/{op.model}]{fb} {flag}"
        )
        if op.ok:
            print(f"    view: {op.view[:80]}")
            print(
                f"    action: {op.action} | position: {op.position}% | stop: ¥{op.stop_loss:.2f}"
            )
            if op.evidence:
                ev0 = op.evidence[0]
                ev_str = str(ev0)[:60] if isinstance(ev0, dict) else ev0[:60]
                print(f"    evidence: {ev_str}...")
        else:
            print(f"    error: {op.error_msg[:100]}")

    s = result["summary"]
    print(
        f"\n[5] 投票汇总: {s.get('buy', 0)}买/{s.get('hold', 0)}观/"
        f"{s.get('reduce', 0)}减/{s.get('sell', 0)}卖"
    )
    print(f"    平均仓位: {s.get('avg_position', 0):.1f}%")
    print(f"    有效专家: {s.get('valid_count', 0)}/{s.get('total_count', 0)}")

    print("\n[6] Markdown 导出预览:")
    team_name = result.get("team_name", "")
    md = export_md(result["opinions"], s, name, code, team_name)
    print(f"    ✓ {len(md)} 字符")
    print(md[:500] + "...")
