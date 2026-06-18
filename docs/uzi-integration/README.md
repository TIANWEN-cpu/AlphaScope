# UZI-Skill 能力融入 AlphaScope · 集成进度

把开源项目 [UZI-Skill](https://github.com/wbh604/UZI-Skill)(MIT)与 AlphaScope 同赛道的四块**内容能力**补进现有架构。增量为主,不重构既有代码。详见根计划文件。

分支:`feat/uzi-integration`(基于 `main`)。每模块独立提交、可独立回退。

## 模块进度

| 模块 | 内容 | 状态 |
|---|---|---|
| **M1** | A 股龙虎榜「机构 vs 游资」席位 + 杀猪盘信号(新 provider) | ✅ 完成(`bd45b04`，14 测试) |
| **M2** | DCF / Comps / LBO 机构估值建模(新 `backend/valuation/`) | ✅ 完成(15 测试) |
| **M3** | 研报质量机械门控(新 `backend/quality/report_gate.py`) | ✅ 完成(14 测试) |
| **M4** | 投资人 persona 扩充(`config/experts.yaml` + `prompts/experts/`) | ✅ 完成(+49 persona，9 测试) |

## 验证基线

- 现有 pytest 套件须保持全绿(集成前约 823 项)。
- 每模块带独立测试:`python -m pytest tests/test_<module>.py -q`。

## 设计原则

- 复用 AlphaScope 既有设施:provider 基类/自动发现 registry、`stock_resolver`、`web_search_provider`、`critic.py`、`evidence_chain.py`、`expert_panel.py`。
- 不移植 UZI 的数据层架构、面板引擎、分享卡/战报营销出图(AlphaScope 自有更优实现或定位不符)。
- 移植文件头部标注来源,见 [ATTRIBUTION.md](ATTRIBUTION.md)。
