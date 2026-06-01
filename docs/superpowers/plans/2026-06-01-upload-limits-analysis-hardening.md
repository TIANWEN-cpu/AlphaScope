# AlphaScope Security and Correctness Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Workbench fake upload path, harden upload and query boundaries, stop blocking provider model-list calls, block fake analysis success from empty data, and land the smallest safe provenance/status contract.

**Architecture:** Keep the fixes local and reversible. The frontend Workbench should perform a real multipart upload and only show success after the backend confirms it. The backend should enforce safety and bounded resource use at each route boundary, and the analysis entrypoint should refuse to manufacture normal success from empty or zero-only market data. For provenance, add only the smallest compatible status fields first and defer the broader migration.

**Tech Stack:** FastAPI, Pydantic, pytest, React, Vite, TypeScript, native `fetch`, `asyncio.to_thread`, Ruff, `npm run lint`, `npm run build`.

---

## File structure map

### Frontend upload flow
- Modify: `apps/web/src/components/Workbench.tsx`
  - Replace the fake filename-only upload behavior with real multipart upload and failure handling.
- Modify: `apps/web/src/lib/api.ts` only if a tiny shared helper is needed for auth/header reuse; avoid a helper unless it is reused elsewhere.

### Backend safety boundaries
- Modify: `backend/api/knowledge.py`
  - Sanitize upload filenames before disk writes and preserve duplicate-safe hashing.
- Modify: `backend/api/news.py`
  - Add hard upper bounds to limit/count/range-style query params.
- Modify: `backend/api/technical.py`
  - Add hard upper bounds to limit/lookback query params.
- Modify: `backend/api/settings.py`
  - Move provider model-list lookup off the event loop and enforce a timeout.
- Modify: `backend/api/main.py`
  - Refuse empty/zero-only analysis inputs and preserve any available source/status metadata.
- Modify: `backend/schemas/api.py`
  - Add the smallest compatible provenance/status fields to the shared API response model if they are not already present.

### Tests
- Create: `tests/test_upload_safety.py`
- Create: `tests/test_resource_limits.py`
- Create: `tests/test_analysis_guardrails.py`
- Modify: `tests/test_settings.py` if there is already coverage for provider lookups and timeout behavior.
- Modify: `tests/test_api.py` only if a shared analysis/API route test already exists there and is the best home for the new assertions.

---

## Task 1: Add focused regression tests first

**Files:**
- Create: `tests/test_upload_safety.py`
- Create: `tests/test_resource_limits.py`
- Create: `tests/test_analysis_guardrails.py`
- Modify: `tests/test_settings.py` if existing provider tests are already nearby

- [ ] **Step 1: Write the failing tests for upload safety**

```python
from fastapi.testclient import TestClient

from backend.api.main import app


def test_knowledge_upload_rejects_path_traversal_filename(monkeypatch, tmp_path):
    client = TestClient(app)
    monkeypatch.setattr("backend.api.knowledge.UPLOADS_DIR", tmp_path / "uploads")

    response = client.post(
        "/api/knowledge/upload",
        files={"file": ("../../evil.pdf", b"pdf-bytes", "application/pdf")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert "文件名" in body["error"] or "安全" in body["error"]


def test_knowledge_upload_accepts_normal_filename(monkeypatch, tmp_path):
    client = TestClient(app)
    monkeypatch.setattr("backend.api.knowledge.UPLOADS_DIR", tmp_path / "uploads")
    monkeypatch.setattr("backend.api.knowledge.get_document_pipeline", lambda: None)

    response = client.post(
        "/api/knowledge/upload",
        files={"file": ("report.pdf", b"pdf-bytes", "application/pdf")},
    )

    assert response.status_code == 200
```

- [ ] **Step 2: Write the failing tests for bounded query params**

```python
from fastapi.testclient import TestClient

from backend.api.main import app


def test_news_limit_rejects_excessive_value():
    client = TestClient(app)
    response = client.get("/api/news?limit=1000000")
    assert response.status_code == 422


def test_technical_limit_rejects_excessive_value():
    client = TestClient(app)
    response = client.get("/api/technical/600519.SH?limit=1000000")
    assert response.status_code == 422


def test_news_event_days_rejects_excessive_value():
    client = TestClient(app)
    response = client.get("/api/news/events/600519.SH?days=9999")
    assert response.status_code == 422
```

- [ ] **Step 3: Write the failing tests for analysis guardrails**

```python
from fastapi.testclient import TestClient

from backend.api.main import app


def test_analysis_run_rejects_empty_market_data(monkeypatch):
    client = TestClient(app)
    monkeypatch.setattr("backend.api.main.get_prices", lambda *args, **kwargs: [])

    response = client.post(
        "/api/analysis/run",
        json={"stock_symbol": "600519.SH", "stock_name": "贵州茅台", "mode": "deep"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert "行情" in body["error"] or "数据不足" in body["error"]


def test_analysis_run_rejects_zero_only_market_data(monkeypatch):
    client = TestClient(app)
    monkeypatch.setattr(
        "backend.api.main.get_prices",
        lambda *args, **kwargs: [
            {"date": "2026-05-01", "open": 0, "close": 0, "high": 0, "low": 0, "volume": 0}
        ],
    )

    response = client.post(
        "/api/analysis/run",
        json={"stock_symbol": "600519.SH", "stock_name": "贵州茅台", "mode": "deep"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
```

- [ ] **Step 4: Write the failing test for provider-model timeout behavior**

```python
from types import SimpleNamespace

from fastapi.testclient import TestClient

from backend.api.main import app


def test_list_provider_models_times_out(monkeypatch):
    client = TestClient(app)

    class SlowModels:
        def list(self):
            import time
            time.sleep(2)
            return SimpleNamespace(data=[])

    class FakeOpenAI:
        def __init__(self, *args, **kwargs):
            self.models = SlowModels()

    monkeypatch.setattr("backend.api.settings.OpenAI", FakeOpenAI)
    monkeypatch.setattr(
        "backend.settings_store.get_provider",
        lambda provider_id: {"id": provider_id, "api_key": "k", "base_url": "https://example.com/v1"},
    )

    response = client.get("/api/settings/providers/demo/models")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert "超时" in body["error"] or "timeout" in body["error"].lower()
```

- [ ] **Step 5: Run the tests and confirm they fail for the current code**

Run:

```powershell
python -m pytest tests/test_upload_safety.py tests/test_resource_limits.py tests/test_analysis_guardrails.py tests/test_settings.py -q *> test-results\phase1-failing-regressions.log
```

Expected: several failures that point at the fake upload path, missing bounds, fake analysis success, and blocking provider lookup.

- [ ] **Step 6: Commit the test-only baseline if the team prefers tiny commits**

```powershell
git add tests/test_upload_safety.py tests/test_resource_limits.py tests/test_analysis_guardrails.py tests/test_settings.py
git commit -m "test: add regressions for upload limits and analysis guardrails"
```

---

## Task 2: Make Workbench perform the real upload

**Files:**
- Modify: `apps/web/src/components/Workbench.tsx`
- Read only for reference: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add a dedicated upload helper inside Workbench**

```ts
async function uploadKnowledgeFile(file: File): Promise<{ success: boolean; message: string; error?: string; filename?: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const headers = new Headers();
  if (API_KEY) {
    headers.set('X-API-Key', API_KEY);
  }

  const response = await fetch(`${API_BASE_URL}/api/knowledge/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    return {
      success: false,
      error: payload?.error || `HTTP ${response.status} ${response.statusText}`,
      message: payload?.message || '',
    };
  }

  return {
    success: true,
    message: payload?.message || '文件上传并处理成功',
    filename: payload?.data?.filename || file.name,
  };
}
```

- [ ] **Step 2: Replace the optimistic file-only UI path**

```ts
const handleUploadContext = async (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    appendSystemMessage(`正在上传 **${file.name}** 到知识库，请稍候...`);
    const result = await uploadKnowledgeFile(file);
    if (!result.success) {
      appendSystemMessage(`知识库上传失败：**${file.name}**\n${result.error || '未知错误'}`);
      return;
    }

    setLastUploadedFile(result.filename || file.name);
    appendSystemMessage(`已上传并索引：**${result.filename || file.name}**。\n${result.message}`);
  } catch (error) {
    appendSystemMessage(`知识库上传失败：**${file.name}**\n${error instanceof Error ? error.message : '网络错误'}`);
  } finally {
    event.target.value = '';
  }
};
```

- [ ] **Step 3: Make sure no success message is emitted before backend confirmation**
  - Remove any remaining code path that calls `setLastUploadedFile(file.name)` before the fetch resolves.
  - Keep the “上传成功” wording only in the post-response branch.

- [ ] **Step 4: Run the frontend typecheck and build**

Run:

```powershell
npm --prefix "D:\AlphaScope-release-sync\apps\web" run lint *> test-results\workbench-lint.log
npm --prefix "D:\AlphaScope-release-sync\apps\web" run build *> test-results\workbench-build.log
```

Expected: both pass.

- [ ] **Step 5: Manual browser smoke test**
  - Start the backend and frontend.
  - Upload a known good file and confirm the UI success message appears only after the network request returns 2xx.
  - Force a 4xx response from `/api/knowledge/upload` and confirm the UI shows failure.
  - Disconnect the backend and confirm the UI shows failure instead of optimistic success.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/components/Workbench.tsx
git commit -m "fix: make workbench upload wait for backend confirmation"
```

---

## Task 3: Harden knowledge upload filename handling

**Files:**
- Modify: `backend/api/knowledge.py`
- Test: `tests/test_upload_safety.py`

- [ ] **Step 1: Add a filename sanitizer that removes path components and unsafe characters**

```python
import re
from pathlib import Path


def _sanitize_upload_filename(filename: str) -> str:
    raw_name = Path(filename or "").name.strip()
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", raw_name)
    safe_name = safe_name.strip("._-")
    if not safe_name:
        raise ValueError("文件名无效")
    return safe_name
```

- [ ] **Step 2: Use the sanitized name when persisting the file**

```python
safe_filename = _sanitize_upload_filename(file.filename or "")
save_name = f"{c_hash}_{safe_filename}"
save_path = UPLOADS_DIR / save_name
save_path.write_bytes(content)
```

- [ ] **Step 3: Preserve duplicate-safe behavior**
  - Keep the content hash prefix so identical content still produces stable, non-colliding names.
  - Do not use the raw client filename in the disk path or metadata path.

- [ ] **Step 4: Return a structured validation failure when the filename is unusable**

```python
try:
    safe_filename = _sanitize_upload_filename(file.filename or "")
except ValueError as exc:
    return ApiResponse(success=False, error=str(exc))
```

- [ ] **Step 5: Run the upload safety tests**

Run:

```powershell
python -m pytest tests/test_upload_safety.py -q *> test-results\upload-safety.log
```

Expected: normal filename passes; traversal and special-character cases fail safely or are normalized without touching unsafe paths.

- [ ] **Step 6: Commit**

```powershell
git add backend/api/knowledge.py tests/test_upload_safety.py
git commit -m "fix: sanitize knowledge upload filenames"
```

---

## Task 4: Bound news and technical API query parameters

**Files:**
- Modify: `backend/api/news.py`
- Modify: `backend/api/technical.py`
- Test: `tests/test_resource_limits.py`

- [ ] **Step 1: Add explicit maximums in `backend/api/news.py`**

```python
from fastapi import APIRouter, Query

MAX_NEWS_LIMIT = 100
MAX_EVENT_DAYS = 180
MAX_EVENT_WINDOW = 30

@router.get("")
async def list_news(symbol: str | None = None, event_type: str | None = None, limit: int = Query(default=50, ge=1, le=MAX_NEWS_LIMIT)):
    ...

@router.get("/announcements")
async def list_announcements(symbol: str | None = None, category: str | None = None, limit: int = Query(default=50, ge=1, le=MAX_NEWS_LIMIT)):
    ...

@router.get("/events/{symbol}")
async def get_event_summary(symbol: str, days: int = Query(default=30, ge=1, le=MAX_EVENT_DAYS)):
    ...

@router.get("/impact/{symbol}")
async def get_event_impact(symbol: str, days: int = Query(default=30, ge=1, le=MAX_EVENT_DAYS), window: int = Query(default=5, ge=1, le=MAX_EVENT_WINDOW)):
    ...

@router.post("/search")
async def search_news(req: NewsSearchRequest):
    ...

class NewsSearchRequest(BaseModel):
    query: str = Field(description="搜索关键词")
    limit: int = Field(default=20, ge=1, le=MAX_NEWS_LIMIT, description="最大结果数")
```

- [ ] **Step 2: Add explicit maximums in `backend/api/technical.py`**

```python
from fastapi import APIRouter, Query

MAX_TECH_LIMIT = 500
MAX_SUPPORT_LOOKBACK = 120

@router.get("/{symbol}")
async def get_all_indicators(symbol: str, limit: int = Query(default=250, ge=1, le=MAX_TECH_LIMIT)):
    ...

@router.get("/{symbol}/ma")
async def get_ma(symbol: str, limit: int = Query(default=250, ge=1, le=MAX_TECH_LIMIT)):
    ...

@router.get("/{symbol}/macd")
async def get_macd(symbol: str, limit: int = Query(default=250, ge=1, le=MAX_TECH_LIMIT)):
    ...

@router.get("/{symbol}/rsi")
async def get_rsi(symbol: str, limit: int = Query(default=250, ge=1, le=MAX_TECH_LIMIT)):
    ...

@router.get("/{symbol}/kdj")
async def get_kdj(symbol: str, limit: int = Query(default=250, ge=1, le=MAX_TECH_LIMIT)):
    ...

@router.get("/{symbol}/support-resistance")
async def get_support_resistance(symbol: str, lookback: int = Query(default=20, ge=1, le=MAX_SUPPORT_LOOKBACK)):
    ...
```

- [ ] **Step 3: Keep behavior consistent across endpoints**
  - Use `422` for excessive values through FastAPI validation.
  - Do not silently accept enormous values in one endpoint while rejecting them in another.

- [ ] **Step 4: Run the resource limit tests**

Run:

```powershell
python -m pytest tests/test_resource_limits.py -q *> test-results\resource-limits.log
```

Expected: excessive values produce `422`; normal values still work.

- [ ] **Step 5: Commit**

```powershell
git add backend/api/news.py backend/api/technical.py tests/test_resource_limits.py
git commit -m "fix: bound news and technical query parameters"
```

---

## Task 5: Make provider model-list calls non-blocking and time-bounded

**Files:**
- Modify: `backend/api/settings.py`
- Test: `tests/test_settings.py` or `tests/test_resource_limits.py` if that is the clearer home

- [ ] **Step 1: Add a small sync helper for the blocking SDK call**

```python
import asyncio

MODEL_LIST_TIMEOUT_SECONDS = 15.0


def _list_provider_models_sync(provider: dict[str, Any]) -> list[dict[str, Any]]:
    from openai import OpenAI

    client = OpenAI(api_key=provider["api_key"], base_url=validate_custom_base_url(provider["base_url"]), timeout=MODEL_LIST_TIMEOUT_SECONDS)
    models = client.models.list()
    return [_public_model(m) for m in (models.data or []) if getattr(m, "id", "")]
```

- [ ] **Step 2: Run the sync helper in a worker thread with a timeout**

```python
@router.get("/providers/{provider_id}/models")
async def list_provider_models(provider_id: str):
    ...
    try:
        models = await asyncio.wait_for(
            asyncio.to_thread(_list_provider_models_sync, provider),
            timeout=MODEL_LIST_TIMEOUT_SECONDS + 2.0,
        )
        return ApiResponse(success=True, data={"models": models})
    except asyncio.TimeoutError:
        return ApiResponse(success=False, error="获取模型列表超时")
    except Exception as e:
        return ApiResponse(success=False, error=f"获取模型列表失败: {e}")
```

- [ ] **Step 3: Keep error output bounded**
  - Do not expose raw provider stack traces or secrets.
  - Keep the error message short and user-facing.

- [ ] **Step 4: Run the timeout test**

Run:

```powershell
python -m pytest tests/test_settings.py -q *> test-results\settings-timeout.log
```

Expected: the slow provider case fails quickly with a timeout or bounded error instead of hanging.

- [ ] **Step 5: Commit**

```powershell
git add backend/api/settings.py tests/test_settings.py
git commit -m "fix: isolate provider model list calls from event loop"
```

---

## Task 6: Stop fake-success analysis and land the minimal provenance/status patch

**Files:**
- Modify: `backend/api/main.py`
- Modify: `backend/schemas/api.py`
- Possibly modify: `backend/price_store.py` only if the analysis route needs a helper to read actual prices; do not add a new abstraction unless it is reused.
- Test: `tests/test_analysis_guardrails.py`

- [ ] **Step 1: Make `/api/analysis/run` load real market data or fail explicitly**

```python
from backend.price_store import get_prices


def _meaningful_price_bars(symbol: str, limit: int = 30) -> list[dict[str, Any]]:
    bars = get_prices(symbol, limit=limit)
    real_bars = []
    for bar in bars:
        values = [bar.get("open"), bar.get("close"), bar.get("high"), bar.get("low"), bar.get("volume")]
        if any(isinstance(value, (int, float)) and value > 0 for value in values):
            real_bars.append(bar)
    return real_bars
```

- [ ] **Step 2: Reject empty or zero-only analysis inputs before calling the orchestrator**

```python
bars = _meaningful_price_bars(req.stock_symbol, limit=30)
if not bars:
    return ApiResponse(success=False, error="行情数据不足，无法生成正常分析")
```

- [ ] **Step 3: Build analysis stock data from real bars instead of zeros**

```python
latest = bars[-1]
previous = bars[-2] if len(bars) > 1 else latest
stock_data = {
    "symbol": req.stock_symbol,
    "name": req.stock_name,
    "close": float(latest.get("close") or 0),
    "day_change": float((latest.get("close") or 0) - (previous.get("close") or 0)),
    "period_change": float((latest.get("close") or 0) - (bars[0].get("close") or 0)),
    "period_high": max(float(bar.get("high") or 0) for bar in bars),
    "period_low": min(float(bar.get("low") or 0) for bar in bars),
    "days": len(bars),
    "volume": float(latest.get("volume") or 0),
    "total_amount": float(latest.get("amount") or 0),
}
```

- [ ] **Step 4: Add the minimal provenance/status fields to the shared response model**

```python
class ApiResponse(BaseModel, Generic[T]):
    success: bool = Field(description="请求是否成功")
    data: Optional[T] = Field(default=None, description="响应数据")
    error: Optional[str] = Field(default=None, description="错误信息")
    message: Optional[str] = Field(default=None, description="提示信息")
    error_code: Optional[str] = Field(default=None, description="错误码")
    trace_id: Optional[str] = Field(default=None, description="请求追踪ID")
    source: Optional[str] = Field(default=None, description="数据来源")
    status: Optional[str] = Field(default=None, description="live / degraded / fallback / failed")
    fallback_reason: Optional[str] = Field(default=None, description="降级原因")
    failure_type: Optional[str] = Field(default=None, description="失败类型")
    attempt_chain: Optional[list[str]] = Field(default=None, description="尝试链路")
    cached_at: Optional[str] = Field(default=None, description="缓存时间")
    cache_age_seconds: Optional[int] = Field(default=None, description="缓存年龄秒数")
    is_stale: Optional[bool] = Field(default=None, description="是否陈旧")
    warnings: Optional[list[str]] = Field(default=None, description="告警/提示")
    tool_call_id: Optional[str] = Field(default=None, description="工具调用ID")
    evidence_ids: Optional[list[str]] = Field(default=None, description="关联证据ID列表")
```

- [ ] **Step 5: Populate only the smallest safe status metadata at the analysis route**
  - Mark successful live-analysis responses with `status="live"` only when the data source is actually meaningful.
  - Mark rejected input with `status="failed"` if the route returns a structured failure response.
  - Do not invent a global contract rewrite yet.

- [ ] **Step 6: Run the analysis guardrail tests**

Run:

```powershell
python -m pytest tests/test_analysis_guardrails.py -q *> test-results\analysis-guardrails.log
```

Expected: empty and zero-only data are rejected; real data still reaches the orchestrator.

- [ ] **Step 7: Commit**

```powershell
git add backend/api/main.py backend/schemas/api.py tests/test_analysis_guardrails.py
git commit -m "fix: reject fake-success analysis inputs"
```

---

## Task 7: Verify the whole patch set and finish the review pass

**Files:**
- All changed files above
- Optional: `docs/debug/ultracode-scratchpad.md`

- [ ] **Step 1: Run targeted backend tests together**

Run:

```powershell
python -m pytest tests/test_upload_safety.py tests/test_resource_limits.py tests/test_analysis_guardrails.py tests/test_settings.py -q *> test-results\targeted-backend-suite.log
```

Expected: all targeted regressions pass.

- [ ] **Step 2: Run frontend checks**

Run:

```powershell
npm --prefix "D:\AlphaScope-release-sync\apps\web" run lint *> test-results\frontend-lint-final.log
npm --prefix "D:\AlphaScope-release-sync\apps\web" run build *> test-results\frontend-build-final.log
```

Expected: typecheck/build pass after the Workbench upload change.

- [ ] **Step 3: Run the final manual smoke checklist**
  - Workbench upload success only after backend 2xx.
  - Workbench upload failure on backend 4xx/5xx or network failure.
  - Knowledge upload rejects or sanitizes traversal-style filenames.
  - News/technical endpoints reject excessive values with `422`.
  - Settings model-list call returns bounded failure on a slow provider.
  - Analysis route does not emit normal success from empty or zero-only data.
  - No fallback path is represented as live.

- [ ] **Step 4: Update the scratchpad with final verification status**
  - Record changed files.
  - Record the commands run.
  - Record anything deferred from the provenance migration.

- [ ] **Step 5: Final commit if the team wants one commit per patch group or a single squash commit**
  - Prefer the smallest reviewable commit set the branch policy allows.
  - Do not squash away useful rollback points unless explicitly requested.

---

## Self-review checklist

- [ ] Every confirmed bug class maps to at least one task.
- [ ] No task says "TODO" or leaves an implementation detail vague.
- [ ] The Workbench upload path only reports success after backend confirmation.
- [ ] Filename safety uses sanitized names before disk writes.
- [ ] News and technical params have hard upper bounds.
- [ ] Provider model-list calls cannot hang the event loop indefinitely.
- [ ] `/api/analysis/run` cannot return normal success from empty or zero-only data.
- [ ] The provenance patch is minimal and does not attempt a broad migration.
- [ ] Verification commands are targeted and save long output to `test-results/`.
