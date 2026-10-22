# P4-A4 — Reporting and AI Triage Consistency

## Verified gaps

- The strict CI report is `artifacts/all-results.json`, while the advisory CLI previously defaulted to `artifacts/playwright-results.json`. They can be different files.
- Workflow summaries did not consistently distinguish a failed execution, an unexecuted suite and missing/malformed report evidence.

## Change contract

- The advisory triage CLI now defaults to `PORTFOLIO_TEST_REPORT` or `artifacts/all-results.json`, still accepting an explicit file argument. Missing/malformed input stays `unknown` and the AI classifier falls back to `INCONCLUSIVE`; it never manufactures a failed test.
- Both workflows write `artifacts/reporting-index.json` after the test/provenance steps but before evidence manifest generation, using `if: always()`. Its strict reporter is `scripts/verify-test-report.js`, not the AI classifier. The schema identifies diagnostic `PASS`, `FAIL`, `NOT_RUN`, or `INCOMPLETE_EVIDENCE`, with distinct test report verification state and step outcomes. Diagnostic PASS requires a valid strict seven-test report and successful relevant GitHub steps.
- The reporting index is included in the P4-A2 SHA-256 manifest allowlist; manifest validation remains authoritative for file integrity.
- CI does **not** run live AI triage. The index explicitly says `NOT_RUN` and `affectsGate:false`. Original Playwright assertions, B03 application CI and required check names remain authoritative.
- Negative self-tests cover missing/malformed/noncanonical report paths, failed/skipped steps and diagnostic fail-closed behavior. All code is CommonJS.

## Intentional limits

- Reporting index is diagnostic only, not a replacement for GitHub Actions job conclusion. For a runner failure prior to QA dependency availability, the P4-A3 isolated early-evidence JSON remains the fallback; index creation may be skipped/fail.
- The triage CLI does not validate report success; running the CLI manually is advisory and does not alter the strict gate.
- No upstream framework, protected branches, application runtime, retention settings or deployment are modified. No live AI calls are initiated in CI.

## Acceptance checklist

- Standalone QA required `validate` PASS, strict 7/7 report, manifest `complete` and new index SHA-256 verified in downloaded artifact.
- Cross-repo application caller positive run on pinned PR QA SHA, strict 7/7 and artifact checksum verification.
- Controlled negative report and step-status fixtures remain `FAIL` / `NOT_RUN` / `INCOMPLETE_EVIDENCE`; no false PASS.
- Independent review of the PR, then manually squash merge and separately promote immutable QA main SHA to application dev.
