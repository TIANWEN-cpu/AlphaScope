# 第三方来源署名

本目录下若干模块的逻辑/数据移植自开源项目,均遵循其许可证。

## UZI-Skill

- 仓库:https://github.com/wbh604/UZI-Skill
- 许可证:MIT License
- 作者:FloatFu-true 等贡献者

移植/改编自 UZI-Skill 的部分:

| AlphaScope 文件 | 移植来源(UZI `skills/deep-analysis/`) | 说明 |
|---|---|---|
| `backend/dragon_tiger/seat_db.py` | `scripts/lib/seat_db.py` | 游资席位库 + 席位匹配 + 射程判定 |
| `backend/dragon_tiger/lhb.py` | `scripts/lib/data_sources.py` (`fetch_lhb_recent`)、`scripts/fetch_lhb.py` | akshare 龙虎榜抓取 + 机构/游资净额拆分 |
| `backend/dragon_tiger/trap_signals.py` | `scripts/fetch_trap_signals.py` | 8 信号杀猪盘检测(改为注入式 search) |
| `backend/valuation/` | `scripts/lib/fin_models.py`、`scripts/compute_deep_methods.py` | DCF/Comps/LBO 估值(M2) |
| `backend/quality/report_gate.py` | `scripts/lib/self_review.py` | 机械门控**模式**(检查项为 AlphaScope 自有)(M3) |
| `config/experts.yaml` 新增条目 | `personas/*.yaml` | 投资人 persona 内容(M4) |

改编已适配 AlphaScope 的数据模型与设施,并非逐行复制。
