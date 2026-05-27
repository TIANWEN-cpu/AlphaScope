# v1.4 Runtime Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the v1.4 runtime audit blockers so the app clearly separates real data from degraded/demo data, repairs fund-flow/factor/report issues, removes obvious UI/runtime errors, and preserves rollback points.

**Architecture:** Keep fixes focused at existing API/UI boundaries. Backend fixes expose explicit degraded metadata and correct data computation; frontend fixes consume existing API shapes honestly and improve report/navigation UX. Avoid new providers or hard-coded API keys in this pass.

**Tech Stack:** FastAPI/Python 3.12 backend, pytest/httpx tests, Vite React 19 TypeScript frontend, `npm run lint` and `npm run build` for frontend verification.

---

## Rollback Baseline

- Current baseline tag created before implementation: `pre-remediation-20260526-3ed7e3c` at commit `3ed7e3c`.
- Commit after each task so the user can roll back by task.
- Do not commit `artifacts/`.
- Do not write the SenseNova key to any file.

## File Map

- Modify `backend/factors/generator.py`: fix fund-flow factor computation and expose missing/degraded dimensions.
- Modify `tests/test_factors.py`: add regression for correct `fetch_individual_fund_flow` + `summarize_fund_flow` call chain and degraded/missing metadata.
- Modify `backend/api/quant.py`: make `strategies` and `runs` degrade consistently with `/status`.
- Modify `tests/test_quant_api.py`: assert degraded success for strategies/runs when Jince is unavailable.
- Modify `apps/web/src/components/Workbench.tsx`: map fund-flow summary fields correctly and show degraded state.
- Modify `apps/web/src/components/ReportGenerator.tsx`: format factors as natural language, map fund-flow fields correctly, account for degraded inputs, and scroll report sections from the directory.
- Modify `apps/web/src/components/Backtesting.tsx`: make offline Jince/demo state explicit and remove external noise image dependency.
- Modify `apps/web/src/components/EvidenceChain.tsx` and `apps/web/src/components/Portfolio.tsx`: add clear demo/local-sample labels when backend data is empty or demo data is being shown.
- Modify `apps/web/src/App.tsx`: remove external `grainy-gradients.vercel.app/noise.svg` dependency.
- Optional docs after fixes: update `CHANGELOG.md` only if release prep resumes. Do not publish in this remediation pass.

---

### Task 1: Fix backend fund-flow factor computation

**Files:**
- Modify: `backend/factors/generator.py:70-125,335-384`
- Test: `tests/test_factors.py`

- [ ] **Step 1: Write failing test for fund-flow factor call chain**

Add this test to `tests/test_factors.py` inside `class TestFactorGenerator`:

```python
    def test_fund_flow_uses_fetched_dataframe_for_summary(self):
        from backend.factors.generator import FactorGenerator, FactorReport

        gen = FactorGenerator()
        report = FactorReport(symbol="600519")
        fake_df = object()
        summary = {
            "main_total_yi": 2.5,
            "last_main_yi": 1.25,
            "inflow_days": 4,
            "outflow_days": 1,
        }

        with (
            patch("backend.fund_flow.fetch_individual_fund_flow", return_value=fake_df) as mock_fetch,
            patch("backend.fund_flow.summarize_fund_flow", return_value=summary) as mock_summary,
        ):
            gen._compute_fund_flow(report, "600519", include_signals=True)

        mock_fetch.assert_called_once_with("600519", days=5)
        mock_summary.assert_called_once_with(fake_df, recent_days=5)
        assert report.fund_flow > 0
        assert report.signals[-1]["type"] == "fund_flow"
        assert report.signals[-1]["last_main_yi"] == 1.25
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
Push-Location "D:/AI-Finance/AI--FINANCE-v1.4"; python -m pytest tests/test_factors.py::TestFactorGenerator::test_fund_flow_uses_fetched_dataframe_for_summary; Pop-Location
```

Expected: FAIL because current code calls `summarize_fund_flow(symbol, days=5)` and never calls `fetch_individual_fund_flow`.

- [ ] **Step 3: Add degraded metadata fields to `FactorReport`**

In `backend/factors/generator.py`, extend `FactorReport` with:

```python
    degraded_inputs: list[str] = field(default_factory=list)
    missing_dimensions: list[str] = field(default_factory=list)
```

Then include these in `to_dict()` after `sample_counts`:

```python
            "degraded_inputs": self.degraded_inputs,
            "missing_dimensions": self.missing_dimensions,
```

- [ ] **Step 4: Implement correct fund-flow fetch + summary chain**

Replace `_compute_fund_flow()` body import/call block with:

```python
        try:
            from backend.fund_flow import fetch_individual_fund_flow, summarize_fund_flow

            df = fetch_individual_fund_flow(symbol, days=5)
            if df is None or len(df) == 0:
                report.degraded_inputs.append("fund_flow")
                report.missing_dimensions.append("fund_flow")
                if include_signals:
                    report.signals.append(
                        {
                            "type": "fund_flow",
                            "degraded": True,
                            "reason": "fund-flow provider returned no data",
                        }
                    )
                return
            summary = summarize_fund_flow(df, recent_days=5)
        except Exception as exc:
            report.degraded_inputs.append("fund_flow")
            report.missing_dimensions.append("fund_flow")
            if include_signals:
                report.signals.append(
                    {
                        "type": "fund_flow",
                        "degraded": True,
                        "reason": str(exc),
                    }
                )
            return
```

Keep the existing score calculation below this block.

- [ ] **Step 5: Run factor tests**

Run:

```powershell
Push-Location "D:/AI-Finance/AI--FINANCE-v1.4"; python -m pytest tests/test_factors.py; Pop-Location
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```powershell
git -C "D:/AI-Finance/AI--FINANCE-v1.4" add backend/factors/generator.py tests/test_factors.py
git -C "D:/AI-Finance/AI--FINANCE-v1.4" commit -m @'
fix: compute fund-flow factor from fetched data

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 2: Make quant Jince list endpoints degrade consistently

**Files:**
- Modify: `backend/api/quant.py:96-183`
- Test: `tests/test_quant_api.py`

- [ ] **Step 1: Write failing tests for degraded strategies and runs**

In `tests/test_quant_api.py`, add tests under the existing quant API classes:

```python
    @pytest.mark.anyio
    async def test_list_strategies_degrades_when_jince_unavailable(self, client):
        from backend.integrations.jince.errors import JinceConnectionError

        mock_service = AsyncMock()
        mock_service.list_strategies.side_effect = JinceConnectionError("Jince HTTP 503")
        with patch("backend.api.quant._get_service", return_value=mock_service):
            resp = await client.get("/api/quant/strategies")

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["error_code"] == "JINCE_DISCONNECTED"
        assert data["data"]["strategies"] == []
        assert data["data"]["degraded"] is True
        assert data["data"]["source_status"] == "unavailable"
```

And:

```python
    @pytest.mark.anyio
    async def test_list_runs_degrades_when_jince_unavailable(self, client):
        from backend.integrations.jince.errors import JinceConnectionError

        mock_service = AsyncMock()
        mock_service.list_runs.side_effect = JinceConnectionError("Jince HTTP 503")
        with patch("backend.api.quant._get_service", return_value=mock_service):
            resp = await client.get("/api/quant/runs")

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["error_code"] == "JINCE_DISCONNECTED"
        assert data["data"]["runs"] == []
        assert data["data"]["degraded"] is True
        assert data["data"]["source_status"] == "unavailable"
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
Push-Location "D:/AI-Finance/AI--FINANCE-v1.4"; python -m pytest tests/test_quant_api.py -q; Pop-Location
```

Expected: new tests FAIL because endpoints currently return `success=false`.

- [ ] **Step 3: Implement degraded helper**

In `backend/api/quant.py`, replace `_jince_failure_response()` with:

```python
def _jince_failure_response(error: JinceError, data: dict[str, Any] | None = None):
    """Return a structured degraded API response for unavailable Jince operations."""
    error_code = (
        "JINCE_DISCONNECTED"
        if isinstance(error, JinceConnectionError)
        else getattr(error, "code", "JINCE_ERROR")
    )
    payload = data or {}
    payload["degraded"] = True
    payload["source_status"] = "unavailable"
    return ApiResponse(
        success=True,
        error=str(error),
        error_code=error_code,
        data=payload,
    )
```

This keeps existing list endpoint structure while making it frontend-friendly.

- [ ] **Step 4: Run quant tests**

Run:

```powershell
Push-Location "D:/AI-Finance/AI--FINANCE-v1.4"; python -m pytest tests/test_quant_api.py; Pop-Location
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```powershell
git -C "D:/AI-Finance/AI--FINANCE-v1.4" add backend/api/quant.py tests/test_quant_api.py
git -C "D:/AI-Finance/AI--FINANCE-v1.4" commit -m @'
fix: degrade quant list endpoints when Jince is offline

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 3: Fix Workbench fund-flow display semantics

**Files:**
- Modify: `apps/web/src/components/Workbench.tsx:782-797`

- [ ] **Step 1: Inspect current fund-flow item shape**

Confirm `fundItems` is rendered as four cards and can include value strings. No backend change needed.

- [ ] **Step 2: Replace field mapping**

In `loadFundFlow()`, replace the successful `setFundItems([...])` block with:

```typescript
        const degraded = Boolean(result.data.degraded);
        const mainValue = summary.last_main_yi ?? summary.main_total_yi ?? latestRecord.main_net_yi;
        const superValue = summary.super_total_yi ?? latestRecord.super_net_yi;
        const largeValue = summary.large_total_yi ?? latestRecord.large_net_yi;
        const mediumValue = summary.medium_total_yi ?? latestRecord.medium_net_yi;
        setFundItems([
          {
            label: degraded ? '主力净流入(降级)' : '主力净流入',
            value: degraded ? '数据源降级' : formatYi(mainValue),
            color: degraded ? 'text-amber-400' : Number(mainValue ?? 0) >= 0 ? 'text-rose-500' : 'text-emerald-500',
          },
          { label: '超大单', value: degraded ? '--' : formatYi(superValue), color: Number(superValue ?? 0) >= 0 ? 'text-rose-500' : 'text-emerald-500' },
          { label: '大单', value: degraded ? '--' : formatYi(largeValue), color: Number(largeValue ?? 0) >= 0 ? 'text-rose-500' : 'text-emerald-500' },
          { label: '中单', value: degraded ? '--' : formatYi(mediumValue), color: Number(mediumValue ?? 0) >= 0 ? 'text-rose-500' : 'text-emerald-500' },
        ]);
```

- [ ] **Step 3: Run frontend type check**

Run:

```powershell
Push-Location "D:/AI-Finance/AI--FINANCE-v1.4/apps/web"; npm run lint; Pop-Location
```

Expected: PASS.

- [ ] **Step 4: Commit Task 3**

```powershell
git -C "D:/AI-Finance/AI--FINANCE-v1.4" add apps/web/src/components/Workbench.tsx
git -C "D:/AI-Finance/AI--FINANCE-v1.4" commit -m @'
fix: show degraded fund-flow state in workbench

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 4: Improve report generation content and directory scrolling

**Files:**
- Modify: `apps/web/src/components/ReportGenerator.tsx:1-520`

- [ ] **Step 1: Add section refs**

Update React import to include `useRef` if not already present:

```typescript
import { useMemo, useRef, useState } from 'react';
```

Inside `ReportGenerator`, add:

```typescript
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
```

Add helper:

```typescript
  const scrollToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
```

- [ ] **Step 2: Replace directory click handler**

Change:

```typescript
onClick={() => setActiveSectionId(sec.id)}
```

to:

```typescript
onClick={() => scrollToSection(sec.id)}
```

- [ ] **Step 3: Attach refs to report section containers**

Where each report section is rendered, set:

```typescript
ref={element => { sectionRefs.current[sec.id] = element; }}
```

on the section wrapper element.

- [ ] **Step 4: Add factor summary helper**

Add near other helpers in `ReportGenerator.tsx`:

```typescript
const formatPct = (value: unknown) => typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '--';

const buildFactorSummary = (factorsData: Record<string, unknown>) => {
  const factors = (factorsData.factors || {}) as Record<string, unknown>;
  const sampleCounts = (factorsData.sample_counts || {}) as Record<string, unknown>;
  const missing = Array.isArray(factorsData.missing_dimensions) ? factorsData.missing_dimensions : [];
  const degraded = Array.isArray(factorsData.degraded_inputs) ? factorsData.degraded_inputs : [];
  return [
    `综合因子=${factors.composite ?? '--'}，动量=${factors.momentum ?? '--'}，资金流=${factors.fund_flow ?? '--'}。`,
    `样本覆盖：新闻 ${sampleCounts.news ?? 0} 条，事件 ${sampleCounts.events ?? 0} 条，研报 ${sampleCounts.reports ?? 0} 条。`,
    missing.length ? `缺失维度：${missing.join('、')}。` : '主要因子维度已返回。',
    degraded.length ? `降级输入：${degraded.join('、')}。` : '',
  ].filter(Boolean).join('');
};
```

- [ ] **Step 5: Replace raw JSON factor text**

Change:

```typescript
const factorText = factorsSource.status.ok ? JSON.stringify(factors, null, 2).slice(0, 900) : '因子接口无可用数据，本节仅保留缺口披露。';
```

to:

```typescript
const factorText = factorsSource.status.ok ? buildFactorSummary(factors as Record<string, unknown>) : '因子接口无可用数据，本节仅保留缺口披露。';
```

- [ ] **Step 6: Fix fund-flow summary fields and degraded note**

After `const flowSummary = ...`, add:

```typescript
    const fundFlowDegraded = Boolean(fundFlow.degraded);
    const flowMain = flowSummary.last_main_yi ?? flowSummary.main_total_yi ?? '--';
    const flowSuper = flowSummary.super_total_yi ?? '--';
    const flowLarge = flowSummary.large_total_yi ?? '--';
    const flowNote = fundFlowDegraded ? '资金流数据源降级，当前不应解读为真实净流入。' : '';
```

Replace report strings using `flowSummary.main_net_yi`, `super_net_yi`, `large_net_yi` with `flowMain`, `flowSuper`, `flowLarge`, and append `${flowNote}`.

- [ ] **Step 7: Treat degraded sources as partial quality**

Where `statuses` are derived/read, ensure sources with `data.degraded === true` produce `ok: false` or a partial status. If `readSource()` is the helper, update it so `degraded` sets an error like `数据源降级` and marks status not fully ok.

- [ ] **Step 8: Run frontend checks**

Run:

```powershell
Push-Location "D:/AI-Finance/AI--FINANCE-v1.4/apps/web"; npm run lint; npm run build; Pop-Location
```

Expected: PASS build with only existing large chunk warning.

- [ ] **Step 9: Commit Task 4**

```powershell
git -C "D:/AI-Finance/AI--FINANCE-v1.4" add apps/web/src/components/ReportGenerator.tsx
git -C "D:/AI-Finance/AI--FINANCE-v1.4" commit -m @'
fix: improve report factor summaries and navigation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 5: Make demo/offline states explicit and remove external 404 asset

**Files:**
- Modify: `apps/web/src/App.tsx:60-64`
- Modify: `apps/web/src/components/Backtesting.tsx:60-430`
- Modify: `apps/web/src/components/EvidenceChain.tsx`
- Modify: `apps/web/src/components/Portfolio.tsx`

- [ ] **Step 1: Remove external noise asset from App**

Replace:

```tsx
<div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
```

with:

```tsx
<div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.35)_1px,transparent_1px)] bg-[length:18px_18px]"></div>
```

- [ ] **Step 2: Remove external noise asset from Backtesting**

Replace the `grainy-gradients.vercel.app/noise.svg` div in `Backtesting.tsx` with the same local radial-gradient div.

- [ ] **Step 3: Add quant offline copy**

In `Backtesting.tsx`, locate where `statusText` or `connected` status is displayed. Ensure when status contains Jince disconnected/degraded, the UI includes this exact user-facing text:

```text
Jince 量化引擎离线，当前收益曲线与指标为本地演示样例。
```

Use existing state; do not add a new backend call.

- [ ] **Step 4: Label EvidenceChain sample data**

In `EvidenceChain.tsx`, add a visible banner above the sample evidence list:

```tsx
<div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
  当前证据链为本地演示样例；后端未返回真实证据时，请勿作为真实投研结论使用。
</div>
```

Only show this when rendering the built-in sample nodes.

- [ ] **Step 5: Label Portfolio sample data**

In `Portfolio.tsx`, add a similar banner near the top of the page:

```tsx
<div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
  当前组合与风控指标为本地演示样例；连接真实组合后再用于投资复核。
</div>
```

- [ ] **Step 6: Run frontend checks**

Run:

```powershell
Push-Location "D:/AI-Finance/AI--FINANCE-v1.4/apps/web"; npm run lint; npm run build; Pop-Location
```

Expected: PASS build with only existing large chunk warning.

- [ ] **Step 7: Commit Task 5**

```powershell
git -C "D:/AI-Finance/AI--FINANCE-v1.4" add apps/web/src/App.tsx apps/web/src/components/Backtesting.tsx apps/web/src/components/EvidenceChain.tsx apps/web/src/components/Portfolio.tsx
git -C "D:/AI-Finance/AI--FINANCE-v1.4" commit -m @'
fix: label demo data and remove broken noise asset

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 6: Runtime verification and final report

**Files:**
- No production code unless verification finds a regression.

- [ ] **Step 1: Start or confirm backend and frontend**

Run:

```powershell
try { Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 5 | ConvertTo-Json -Depth 5 } catch { "backend missing" }
try { Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3000" -TimeoutSec 5 | Select-Object StatusCode } catch { "frontend missing" }
```

If either service is down, start using the project scripts or existing commands. Do not kill user processes unless explicitly needed.

- [ ] **Step 2: Probe backend runtime surfaces**

Run:

```powershell
$base='http://127.0.0.1:8000'
$endpoints=@(
'/api/fund-flow/600519?days=30',
'/api/factors/600519?stock_name=%E8%B4%B5%E5%B7%9E%E8%8C%85%E5%8F%B0&days=60',
'/api/quant/status',
'/api/quant/strategies',
'/api/quant/runs',
'/api/funds/search?keyword=000001'
)
foreach($ep in $endpoints){
  Write-Output "=== $ep ==="
  Invoke-RestMethod -Uri ($base+$ep) -TimeoutSec 20 | ConvertTo-Json -Depth 8 -Compress
}
```

Expected:
- fund-flow may still be degraded but clearly says so.
- factors include `degraded_inputs` / `missing_dimensions` when fund-flow is unavailable.
- quant list endpoints return `success=true` with degraded empty lists when Jince is offline.
- fund search still returns 000001.

- [ ] **Step 3: Verify frontend build**

Run:

```powershell
Push-Location "D:/AI-Finance/AI--FINANCE-v1.4/apps/web"; npm run lint; npm run build; Pop-Location
```

Expected: PASS with only large chunk warning.

- [ ] **Step 4: Confirm no secrets or temp files were added**

Run:

```powershell
git -C "D:/AI-Finance/AI--FINANCE-v1.4" status --short
git -C "D:/AI-Finance/AI--FINANCE-v1.4" grep -n "sk-<redacted-test-key>" -- . ':!artifacts' ':!data' ':!.venv' ':!apps/web/node_modules'
```

Expected: status only includes intended tracked changes or `?? artifacts/`; grep finds nothing.

- [ ] **Step 5: Final summary**

Report:
- rollback tag name,
- commits created,
- tests run and pass/fail,
- runtime probes,
- remaining known issues: Chinese mojibake, real fund-flow provider empty, default LLM provider/model selection.

---

## Self-Review

- Spec coverage: covers fund-flow display, factor fund-flow bug, report quality/scrolling, quant offline degradation, demo labeling, 404 asset removal, and verification. It intentionally does not solve Chinese mojibake or real provider availability in this pass.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: backend uses existing `ApiResponse`; frontend uses existing `Record<string, unknown>` patterns and string-valued cards.
