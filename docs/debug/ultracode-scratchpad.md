# Ultracode Scratchpad

## Confirmed facts
- 2026-06-01: Working branch is `fix/release-risk-hardening` in `D:\AlphaScope-release-sync`.
- Completed earlier security/release commits include key vault hardening, provider URL/lifecycle hardening, unresolved hostname rejection, local API boundary, and release workflow ownership fix.
- User requested Ultra Code / Maximum Result Mode with controlled parallel investigation, serialized implementation, compact reports, logs in `test-results/`, and phase checkpoints.

## Active hypotheses
- Workbench upload may be frontend-only optimistic/fake success.
- Knowledge upload may use unsafe client filenames.
- News/technical APIs may expose unbounded query parameters.
- Settings provider model-list may perform blocking provider calls inside async request paths without bounded timeout.
- Analysis pipeline may treat empty, zero-only, stale, mock, or fallback data as normal live success.
- A full provenance contract may be too large; a minimal compatible first step is likely safer.

## Decisions
- Phase 1 is read-only parallel investigation.
- Implementation will be serialized by patch group after consensus plan.
- Main conversation will contain compact summaries and evidence pointers only.

## Changed files
- Created/updated `docs/debug/ultracode-scratchpad.md`.
- Created `test-results/` directory.

## Verification status
- Phase 1 setup completed.
- No code fixes in this phase yet.

## Deferred issues
- Full provenance/status migration may be deferred after minimal compatible landing patch.

## Next actions
- Run Phase 1 parallel read-only investigation agents A-J.
- Aggregate compact diagnosis by bug class.
