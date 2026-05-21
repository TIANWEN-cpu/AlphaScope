"""Tests for Enhanced Compliance — 扩展禁用词 + 风险级别免责声明 + 高风险标记"""

from __future__ import annotations


class TestExpandedForbiddenWords:
    """测试扩展禁用词"""

    def test_promise_words(self):
        from backend.ai_assistant.compliance import check_forbidden_words

        _, found = check_forbidden_words("这只股票稳赚不赔，保证收益")
        assert len(found) >= 2

    def test_insider_words(self):
        from backend.ai_assistant.compliance import check_forbidden_words

        _, found = check_forbidden_words("根据内幕消息，庄家操盘")
        assert len(found) >= 2

    def test_position_words(self):
        from backend.ai_assistant.compliance import check_forbidden_words

        _, found = check_forbidden_words("建议满仓梭哈")
        assert len(found) >= 2

    def test_recommend_words(self):
        from backend.ai_assistant.compliance import check_forbidden_words

        _, found = check_forbidden_words("确定买入，闭眼买入")
        assert len(found) >= 2

    def test_replacement_works(self):
        from backend.ai_assistant.compliance import check_forbidden_words

        result, found = check_forbidden_words("必涨")
        assert "必涨" not in result
        assert "倾向上涨" in result
        assert len(found) == 1

    def test_regex_pattern(self):
        from backend.ai_assistant.compliance import check_forbidden_words

        _, found = check_forbidden_words("保证100%以上收益")
        assert len(found) >= 1

    def test_no_false_positive(self):
        from backend.ai_assistant.compliance import check_forbidden_words

        result, found = check_forbidden_words("该公司业绩增长稳定，ROE持续提升")
        assert len(found) == 0
        assert "业绩增长稳定" in result


class TestRiskDisclaimer:
    """测试风险级别免责声明"""

    def test_low_risk(self):
        from backend.ai_assistant.compliance import get_disclaimer

        d = get_disclaimer("low")
        assert "仅供参考" in d
        assert "高风险" not in d

    def test_medium_risk(self):
        from backend.ai_assistant.compliance import get_disclaimer

        d = get_disclaimer("medium")
        assert "风险提示" in d

    def test_high_risk(self):
        from backend.ai_assistant.compliance import get_disclaimer

        d = get_disclaimer("high")
        assert "高风险提示" in d
        assert "强烈建议" in d

    def test_critical_risk(self):
        from backend.ai_assistant.compliance import get_disclaimer

        d = get_disclaimer("critical")
        assert "极高风险警告" in d
        assert "持牌专业人士" in d

    def test_market_hk(self):
        from backend.ai_assistant.compliance import get_disclaimer

        d = get_disclaimer("medium", "HK")
        assert "港股" in d

    def test_market_us(self):
        from backend.ai_assistant.compliance import get_disclaimer

        d = get_disclaimer("medium", "US")
        assert "美股" in d

    def test_wrap_with_risk_level(self):
        from backend.ai_assistant.compliance import wrap_with_disclaimer

        result = wrap_with_disclaimer("分析内容", "standard", "high")
        assert "高风险提示" in result
        assert "分析内容" in result

    def test_wrap_idempotent(self):
        from backend.ai_assistant.compliance import wrap_with_disclaimer

        once = wrap_with_disclaimer("分析内容", "standard")
        twice = wrap_with_disclaimer(once, "standard")
        assert once == twice


class TestHighRiskDetection:
    """测试高风险输出标记"""

    def test_high_confidence_buy(self):
        from backend.ai_assistant.compliance import check_high_risk

        output = {"signal": "买入", "confidence": 90, "reason": "技术面强势"}
        result = check_high_risk(output)
        assert result["high_risk"] is True
        assert result["risk_level"] == "high"
        assert len(result["risk_warnings"]) > 0

    def test_critical_confidence(self):
        from backend.ai_assistant.compliance import check_high_risk

        output = {"signal": "买入", "confidence": 98, "reason": "test"}
        result = check_high_risk(output)
        assert result["risk_level"] == "critical"

    def test_normal_output(self):
        from backend.ai_assistant.compliance import check_high_risk

        output = {"signal": "观望", "confidence": 50, "reason": "震荡行情"}
        result = check_high_risk(output)
        assert result["high_risk"] is False
        assert result["risk_level"] == "medium"

    def test_forbidden_words_in_output(self):
        from backend.ai_assistant.compliance import check_high_risk

        output = {"signal": "买入", "confidence": 60, "reason": "必涨信号"}
        result = check_high_risk(output)
        assert len(result["risk_warnings"]) > 0

    def test_non_dict_input(self):
        from backend.ai_assistant.compliance import check_high_risk

        result = check_high_risk("not a dict")
        assert result == "not a dict"
