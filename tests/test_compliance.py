"""Compliance 合规层单元测试"""

from backend.ai_assistant.compliance import (
    needs_disclaimer,
    wrap_with_disclaimer,
    sanitize_output,
    validate_analysis_output,
)


class TestCompliance:
    def test_needs_disclaimer_analysis_modes(self):
        """分析模式需要免责声明"""
        assert needs_disclaimer("standard") is True
        assert needs_disclaimer("deep") is True
        assert needs_disclaimer("expert") is True

    def test_needs_disclaimer_free_mode(self):
        """自由问答模式不需要免责声明"""
        assert needs_disclaimer("free") is False

    def test_wrap_with_disclaimer_analysis(self):
        """分析模式追加免责声明"""
        content = "分析结果：买入"
        result = wrap_with_disclaimer(content, "deep")
        assert "风险提示" in result
        assert "分析结果：买入" in result

    def test_wrap_with_disclaimer_free(self):
        """自由问答模式不追加免责声明"""
        content = "你好，有什么可以帮你的？"
        result = wrap_with_disclaimer(content, "free")
        assert result == content
        assert "风险提示" not in result

    def test_wrap_idempotent(self):
        """不重复追加免责声明"""
        content = "分析结果"
        result1 = wrap_with_disclaimer(content, "deep")
        result2 = wrap_with_disclaimer(result1, "deep")
        assert result1 == result2
        assert result2.count("风险提示") == 1

    def test_sanitize_output_api_keys(self):
        """脱敏处理移除 API key"""
        content = "使用 sk-abc123def456ghi789jkl012mno345 进行分析"
        result = sanitize_output(content)
        assert "sk-abc123" not in result
        assert "[REDACTED]" in result

    def test_sanitize_output_bearer(self):
        """脱敏处理移除 Bearer token"""
        content = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc123"
        result = sanitize_output(content)
        assert "Bearer" not in result or "[REDACTED]" in result

    def test_sanitize_output_normal(self):
        """正常内容不受影响"""
        content = "贵州茅台当前PE为25倍"
        result = sanitize_output(content)
        assert result == content

    def test_validate_signal_normalization(self):
        """信号字段标准化"""
        data = {"signal": "买入", "confidence": 80}
        result = validate_analysis_output(data)
        assert result["signal"] == "buy"

        data2 = {"signal": "卖出", "confidence": 70}
        result2 = validate_analysis_output(data2)
        assert result2["signal"] == "sell"

    def test_validate_confidence_clamping(self):
        """置信度范围限制"""
        data = {"confidence": 150}
        result = validate_analysis_output(data)
        assert result["confidence"] == 100

        data2 = {"confidence": -10}
        result2 = validate_analysis_output(data2)
        assert result2["confidence"] == 0

    def test_validate_risks_as_list(self):
        """风险字段转为列表"""
        data = {"risks": "单一风险"}
        result = validate_analysis_output(data)
        assert isinstance(result["risks"], list)
        assert result["risks"] == ["单一风险"]

    def test_validate_evidence_as_list(self):
        """证据字段转为列表"""
        data = {"evidence": "单一证据"}
        result = validate_analysis_output(data)
        assert isinstance(result["evidence"], list)
        assert result["evidence"] == [{"claim": "单一证据"}]
