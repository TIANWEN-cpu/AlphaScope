import { AnalysisResult } from '../types';

export const mockAnalysisResult: AnalysisResult = {
  summary: "茅台基本面依然强劲，近期资金呈现微弱净流入。受白酒行业整体弱势影响，存在一定的估值修复机会。数据源显示部分板块热点数据降级，因此短期交易情绪需谨慎参考。",
  agents: {
    fundamentals: {
      signal: "BUY",
      confidence: 0.85,
      reason: "ROE 维持高位，利润增长符合预期。市盈率处于历史低位区间，安全边际较高。",
      risk_points: ["消费降级可能影响高端白酒销量", "行业库存周期调整"],
      evidence_refs: ["ref-provider-1", "ref-provider-4"]
    },
    quant: {
      signal: "HOLD",
      confidence: 0.60,
      reason: "近期量价齐跌，未见明显反转信号，建议观望等待右侧机会。",
      risk_points: ["动能指标持续走弱"],
      evidence_refs: ["ref-provider-1", "ref-provider-2"]
    },
    risk: {
      signal: "HOLD",
      confidence: 0.90,
      reason: "未发现重大违规、诉讼或减持等系统性风险事件。属于常规市场波动。",
      evidence_refs: ["ref-provider-3"]
    },
    macro: {
      signal: "BUY",
      confidence: 0.70,
      reason: "流动性边际宽松预期对核心资产估值有支撑作用。",
      evidence_refs: ["ref-provider-5"]
    }
  },
  evidence: [
    {
      id: "trace-quote-1:ref-provider-1",
      ref_id: "ref-provider-1",
      type: "price",
      title: "600519 quote snapshot",
      claim: "600519 quote snapshot: price=1520.5, pe_ttm=28.5, pb=7.2",
      source: "tencent",
      retrieved_at: "2026-05-29T12:00:00Z",
      raw_value: { price: 1520.5, pe_ttm: 28.5, pb: 7.2 },
      derivation: "direct provider quote fields",
      source_call: "tencent.quote",
      provider_trace_id: "trace-quote-1",
      confidence: 0.99
    },
    {
      id: "trace-flow-1:ref-provider-2",
      ref_id: "ref-provider-2",
      type: "fund_flow",
      title: "600519 recent fund flow",
      claim: "600519 recent main fund flow sum is 15.2 across 5 rows",
      source: "eastmoney",
      retrieved_at: "2026-05-29T12:00:00Z",
      raw_value: { latest: { date: "2026-05-29", main_net_inflow: 5.1 }, sum_main_net_inflow: 15.2, rows: 5 },
      derivation: "sum(main_net_inflow) and average(main_net_pct) over returned rows",
      source_call: "eastmoney.fund_flow",
      provider_trace_id: "trace-flow-1",
      confidence: 0.85
    },
    {
      id: "trace-risk-1:ref-provider-3",
      ref_id: "ref-provider-3",
      type: "risk_event",
      title: "600519 risk event snapshot",
      claim: "600519 provider risk events count=0",
      source: "cls",
      retrieved_at: "2026-05-29T12:00:00Z",
      raw_value: [],
      derivation: "direct provider event rows, filtered by symbol/name when possible",
      source_call: "cls.risk_events",
      provider_trace_id: "trace-risk-1",
      confidence: 0.95
    }
  ],
  provider_traces: [
    {
      data_type: "quote",
      provider_trace_id: "trace-quote-1",
      selected_provider: "tencent",
      source_chain: ["tencent"],
      fallback_attempts: [],
      field_fill_map: { pb: "baidu_stock", pe_ttm: "baidu_stock" },
      errors: [],
      degraded: false,
      items_count: 1
    },
    {
      data_type: "sector",
      provider_trace_id: "trace-sector-1",
      selected_provider: "ths_hot",
      source_chain: ["baidu_stock", "ths_hot"],
      fallback_attempts: [
        {
          provider: "baidu_stock",
          endpoint: "sector",
          status: "failed",
          latency_ms: 5002,
          items_count: 0,
          error: "Read timeout",
          fallback_to: "ths_hot"
        }
      ],
      field_fill_map: {},
      errors: [{ provider: "baidu_stock", endpoint: "sector", error: "Read timeout" }],
      degraded: true,
      items_count: 5
    }
  ],
  source_appendix: [
    {
      data_type: "quote",
      selected_provider: "tencent",
      source_chain: ["tencent"],
      degraded: false,
      items_count: 1,
      field_fill_map: { pb: "baidu_stock", pe_ttm: "baidu_stock" },
      last_error: "",
      provider_trace_id: "trace-quote-1"
    },
    {
      data_type: "sector",
      selected_provider: "ths_hot",
      source_chain: ["baidu_stock", "ths_hot"],
      degraded: true,
      items_count: 5,
      field_fill_map: {},
      last_error: "Read timeout",
      provider_trace_id: "trace-sector-1"
    }
  ],
  degraded: true,
  source_errors: [{ provider: "baidu_stock", endpoint: "sector", error: "Read timeout" }]
};
