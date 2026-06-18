"""M4 生成器 · 把 UZI-Skill 的投资人 persona 映射进 AlphaScope config/experts.yaml。

读 ``_reference/UZI-Skill/.../personas/*.yaml``，为每个 AlphaScope 尚无的投资人，
在 ``config/experts.yaml`` 的 v1.0 ``experts:`` 段追加一条自包含条目
(含 inline system_prompt，由 persona 的 philosophy/key_metrics/avoids/a_share_view/voice 合成)。

幂等:已存在的 key 跳过;插入前用 yaml.safe_load 校验,解析失败则不写回。
可重复运行。见 ``docs/uzi-integration/ATTRIBUTION.md`` (UZI-Skill, MIT)。

用法: python docs/uzi-integration/gen_personas.py
"""

from __future__ import annotations

import glob
import os
import re

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
PERSONAS_DIR = os.path.abspath(
    os.path.join(REPO, "..", "_reference", "UZI-Skill", "skills", "deep-analysis", "personas")
)
EXPERTS_YAML = os.path.join(REPO, "config", "experts.yaml")

# AlphaScope 已有的 expert/team 成员,跳过避免重复
EXISTING = {
    "buffett", "lynch", "chanlun", "macro", "risk_officer",
    "sentiment", "fund_flow", "devil", "compliance", "summarizer",
}

SENTINEL = "# ===== UZI personas (M4 自动生成) ====="

STYLE_MAP = {
    "value_classic": "价值投资", "value": "价值投资", "growth": "成长投资",
    "macro": "宏观对冲", "trend": "趋势交易", "quant": "量化",
    "youzi": "游资打板", "activist": "激进维权", "vc": "风险投资",
    "trader": "短线交易",
}
ICON_BY_STYLE = {
    "价值投资": "🎩", "成长投资": "🌱", "宏观对冲": "🌍", "趋势交易": "📈",
    "量化": "🤖", "游资打板": "🐉", "激进维权": "⚔️", "风险投资": "🚀",
    "短线交易": "⚡",
}


def _style(p: dict) -> str:
    school = str(p.get("school", "")).lower()
    for k, v in STYLE_MAP.items():
        if k in school:
            return v
    return "投资人"


def _focus_dims(p: dict) -> list[str]:
    """从 key_metrics 抽取 ≤4 个短标签。"""
    dims: list[str] = []
    for km in (p.get("key_metrics") or [])[:4]:
        tok = re.split(r"[ 　，、,（(:：>＞<]", str(km).strip())[0]
        tok = re.sub(r"[\[\]\"'|]", "", tok).strip()
        if tok and len(tok) <= 8:
            dims.append(tok)
    return dims or ["选股", "估值"]


def _indent(text: str, spaces: int) -> str:
    pad = " " * spaces
    out = []
    for line in str(text).strip().splitlines():
        out.append(pad + line.rstrip())
    return "\n".join(out)


def _system_prompt(p: dict) -> str:
    name = p.get("name", p.get("id", ""))
    style = _style(p)
    parts = [f"你是{name}({style}风格投资人)。"]
    if p.get("philosophy"):
        parts.append(str(p["philosophy"]).strip())
    if p.get("key_metrics"):
        parts.append("核心关注: " + "; ".join(str(m).strip() for m in p["key_metrics"][:6]))
    if p.get("avoids"):
        parts.append("明确回避: " + "; ".join(str(m).strip() for m in p["avoids"][:5]))
    if p.get("a_share_view"):
        parts.append("A股视角: " + str(p["a_share_view"]).strip())
    if p.get("voice"):
        parts.append("表达风格: " + str(p["voice"]).strip())
    parts.append("请按团队约定的 JSON output_schema 给出 view/evidence/action/position/stop_loss。")
    return "\n".join(parts)


def _entry_yaml(p: dict) -> str:
    pid = p["id"]
    name = p.get("name", pid)
    style = _style(p)
    icon = ICON_BY_STYLE.get(style, "📊")
    dims = ", ".join(_focus_dims(p))
    sp = _indent(_system_prompt(p), 6)
    return (
        f"  - key: {pid}\n"
        f"    name: {name}\n"
        f"    style: {style}\n"
        f'    icon: "{icon}"\n'
        f"    preferred_vendor: claude\n"
        f"    preferred_model: claude-sonnet-4-5\n"
        f"    focus_dims: [{dims}]\n"
        f"    stop_loss_style: 中等\n"
        f"    system_prompt: |\n"
        f"{sp}\n"
    )


def main() -> int:
    files = sorted(glob.glob(os.path.join(PERSONAS_DIR, "*.yaml")))
    if not files:
        print(f"未找到 personas: {PERSONAS_DIR}")
        return 1

    with open(EXPERTS_YAML, encoding="utf-8") as f:
        original = f.read()
    if SENTINEL in original:
        print("已生成过 (sentinel 存在),跳过。")
        return 0

    blocks, added = [], []
    for fp in files:
        try:
            with open(fp, encoding="utf-8") as f:
                p = yaml.safe_load(f) or {}
        except Exception as e:
            print(f"跳过 {fp}: {e}")
            continue
        pid = p.get("id") or os.path.splitext(os.path.basename(fp))[0]
        p["id"] = pid
        if pid in EXISTING:
            continue
        blocks.append(_entry_yaml(p))
        added.append(pid)

    if not blocks:
        print("无新增 persona。")
        return 0

    insert = f"\n{SENTINEL}\n" + "\n".join(blocks)

    # 插入到 experts: 段末尾(顶层 output_schema: 之前);否则追加到文件末
    m = re.search(r"\noutput_schema:", original)
    if m:
        new_text = original[: m.start()] + insert + original[m.start():]
    else:
        new_text = original.rstrip() + "\n" + insert

    # 校验整文件仍可解析
    try:
        data = yaml.safe_load(new_text)
        keys = {e.get("key") for e in (data.get("experts") or [])}
    except Exception as e:
        print(f"❌ 生成后 YAML 解析失败,未写回: {e}")
        return 2
    for pid in added:
        if pid not in keys:
            print(f"❌ 校验失败: {pid} 未出现在 experts 中,未写回")
            return 3

    with open(EXPERTS_YAML, "w", encoding="utf-8") as f:
        f.write(new_text)
    print(f"✓ 新增 {len(added)} 个 persona: {', '.join(added)}")
    print(f"✓ experts 段现共 {len(keys)} 个")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
