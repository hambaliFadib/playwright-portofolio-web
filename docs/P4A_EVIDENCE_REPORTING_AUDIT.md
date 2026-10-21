# P4-A — Evidence & Test Reporting Audit

Status: **AUDIT / PROPOSAL ONLY** (2026-10-21). This is not a feature implementation, change to a release gate, or authorization to update the adopted framework.

## Snapshot and scope

| Subject | Pinned revision / scope |
| --- | --- |
| QA implementation | `playwright-portofolio-web/main` at `f6b7acc48c46b324e7588469d605dc7ff0748c76` |
| Application integration | `portofolio-web/dev` at `02a34be2af9f4a07a58d872e7eb4a134cc8e4773` |
| Adopted upstream framework | `playwright-quality-framework` at `b5b46cc60b834ffe5ae0fcfc38d8d87921bd490d` (unchanged) |
| Standalone QA fixed application baseline | `5915098e2aa507a451f58e70547abded3023f8d9`; intentionally distinct from dynamic application PR testing |
| Independent application checks | Portfolio CI / `validate`, including B03; not owned by the QA seven-test report gate |

Source review: `playwright.config.js`, `project.config.js`, `scripts/run-{e2e,playwright-project}.js`, `scripts/{verify-test-report,quality-gate-selftest,record-provenance,verify-revisions,with-app-server,ai-triage}.js`, `src/ai/triage.js`, both QA workflows, policy documents and project strategy.

Evidence references:
- [Standalone QA main push: success](https://github.com/hambaliFadib/playwright-portofolio-web/actions/runs/39565184743).
- [Application PR cross-repo quality gate: success](https://github.com/hambaliFadib/portofolio-web/actions/runs/39565828984).
- [Application PR Portfolio CI: success](https://github.com/hambaliFadib/portofolio-web/actions/runs/39565828343).
- [Application negative enforcement: closed without merge](https://github.com/hambaliFadib/portofolio-web/pull/7).
- [QA main negative enforcement: closed without merge](https://github.com/hambaliFadib/playwright-portofolio-web/pull/3).

The source and GitHub Actions job metadata were inspected; uploaded ZIP contents, screenshots, trace files, HTML reports and the actual `provenance.json` bytes were **not** independently downloaded or inspected. Do not claim artifact-level cryptographic verification from upload success alone.

## 1. Existing controls: reuse, do not recreate

| Capability | Implementation / observed behavior | Assessment |
| --- | --- | --- |
| Deterministic oracle | `@playwright/test` assertions; AI is advisory only | Preserve |
| Native reporters | Playwright `list`, HTML `playwright-report/`, JSON output | Preserve |
| Failure evidence | Screenshot `only-on-failure`; trace `on-first-retry` | Preserve; not a visual-regression baseline |
| Suite outputs | `artifacts/all-results.json`, `api-results.json`, `unit-results.json`, `e2e-results.json` selected by scripts | Preserve and document |
| Strict cross-repo report gate | Exactly 7 expected / 0 skipped / 0 unexpected / 0 flaky; known distribution: 3 Chromium UI/E2E + 1 HTTP smoke + 3 unit; one passed attempt per test | Preserve fail-closed; controlled change required to expand suites |
| Negative contract verification | Invalid/missing report, mismatched revision, suite drift, skip/retry and real assertion-failure self-tests | Preserve |
| Revision provenance | Caller event, PR head, synthetic merge, QA SHA, framework SHA, runtime, suite distribution, app SHA and dirty paths; final test conclusion when report available | Preserve |
| CI artifacts | `artifacts/`, `playwright-report/`, `test-results/`; upload uses `if: always()` and 14-day retention | Preserve; do not assert that upload success verifies internal file correctness |
| Supply-chain boundary | Immutable QA caller pin, exact revision checkouts, read-only permissions, no inherited secrets, separate app-owned server lifecycle | Preserve |
| Branch rules | QA `main` requires GitHub Actions `validate`; app `dev` requires `validate` and `portfolio-quality-gate / validate` | Already active and separately verified |

The QA CLI uses `npm run test:all` to select the JSON output `artifacts/all-results.json`, which is the path required by `PORTFOLIO_TEST_REPORT` in the reusable gate. The standalone workflow uses an intentionally fixed application SHA; dynamic caller inputs are used only in the reusable workflow.

## 2. Gap register

### P4A-01 — Per-file integrity and evidence inventory (P1, proposed)

There is no project-owned, machine-readable manifest explicitly enumerating each evidence file with relative path, size, SHA-256, producing run/attempt, and evidence-generation status. GitHub artifact API supplies an uploaded ZIP digest and expiration metadata, but not a verified per-file inventory. Current provenance records revision identity and test counts but not every uploaded file and its hash.

**Proposal:** generate an additive `artifacts/evidence-manifest.json` from an allowlisted set of existing evidence directories, with a versioned schema, relative paths only, per-file hashes/sizes, `runId`, `runAttempt`, QA/app/framework SHAs, available report verdict and generation errors. Do not recursively include secrets, storage state, `.env`, or arbitrary paths. Validate against an explicit schema; use a deterministic ordering. The manifest does not itself change PASS/FAIL.

### P4A-02 — Report naming / triage input contract (P2, P4-C interface)

`scripts/run-playwright-project.js all` writes `artifacts/all-results.json`, but `scripts/ai-triage.js` defaults to `artifacts/playwright-results.json`, the direct Playwright-config default. The CI workflows validate AI *boundaries/self-tests* but do not invoke live AI analysis; no automatic triage-on-failure evidence is currently claimed.

**Proposal:** document the produced report-path contract and accept an explicit report path when P4-C integrates advisory triage. Never change test status based on an AI classification. Avoid altering the adopted upstream `src/ai/**` modules without separate architecture review.

### P4A-03 — Early-failure provenance and error evidence (P2, proposed)

`record-provenance.js` requires both git checkouts and verifies their SHA contract. If caller identity, checkout or setup fails earlier, final provenance may be unavailable even though `if: always()` permits the final step to run. The evidence ZIP upload uses `if-no-files-found: warn`, so a job may report a failed step without a complete provenance payload. This is a diagnostic completeness limitation, **not** a false-success gate, because the job already fails closed.

**Proposal:** emit a bounded, redacted machine-readable failure summary independently of successful checkouts where feasible; include stage, error kind, run reference and verification availability. Keep the existing validation error as the authoritative failed status. Exercise missing-checkout, malformed-report and early-failure paths.

### P4A-04 — Human-readable reporting and current governance state (P2, proposed)

The reusable workflow writes a per-step GitHub job summary but does not provide a normalized per-test evidence index or an explicit distinction between `PASS`, `FAIL`, `NOT_RUN` and `INCOMPLETE_EVIDENCE` for users reviewing failed runs. `docs/cross-repo-quality-gate.md` still describes shadow-mode/not-yet-activated protection even though the GitHub rulesets were activated after this source version.

**Proposal:** add a concise decision-oriented evidence index (build, policy, suite distribution, provenance, artifacts, failure links) with truthful unavailable markers, and update governance documentation through a reviewed PR. Do not duplicate or replace the independent B03 check.

### P4A-05 — Evidence retention / audit permanence (P2, policy decision)

Both inspected positive-run artifacts have `retention-days: 14`. GitHub Actions and audit PR links outlast the artifacts, but artifact contents are not a permanent evidence archive. Example metadata: QA artifact from [run #39565184743](https://github.com/hambaliFadib/playwright-portofolio-web/actions/runs/39565184743) expires **2026-11-04**; app cross-repo artifact from [run #39565828984](https://github.com/hambaliFadib/portofolio-web/actions/runs/39565828984) also expires **2026-11-04**.

**Proposal:** owner-defined retention policy before changing retention or exporting evidence elsewhere. Keep sensitive-data handling and storage/cost constraints explicit. Do not automatically publish artifacts to a third party.

## 3. Recommended implementation sequence (requires separate approval)

1. **P4A-1: Audit accepted.** Approve the schema and evidence allowlist. Documentation-only changes can be reviewed independently.
2. **P4A-2: Manifest builder + self-tests.** Add a project-owned CommonJS script and deterministic unit/self-tests for paths, hashing, missing files, malformed report and secret exclusions. No changes to `src/ai/**` or the upstream framework.
3. **P4A-3: Reusable workflow integration.** Produce the manifest on success and best effort on failure; upload with existing artifacts, preserve CI failure semantics. Requires architecture-maintenance review because it changes `.github/workflows/**`.
4. **P4A-4: Run validation.** Exercise both positive seven-test CI and a controlled failing/missing-report scenario; inspect the actual manifest/artifact contents and source SHA; record evidence.
5. **P4A-5: Promote QA then caller.** Squash approved QA PR only after validation; update app workflow pin through an app PR to the new immutable QA `main` SHA. Reconfirm both required checks and branch rules. No direct pushes/merge bypass.

Deferred: Homepage Regression (existing 11 PASS / 3 FAIL) belongs to P4-B; AI-assisted triage and its safety contract to P4-C; defect linkage to P4-D; SDLC case-study presentation to P4-E. No test-case IDs are to be invented, and `7/7` coverage is not represented as exhaustive application coverage.

## 4. Acceptance criteria for P4A implementation

- A machine-readable, versioned, minimal manifest can be validated offline and maps exactly to the tested app SHA, QA source SHA, framework baseline, GitHub run/attempt and strict 7-test verdict.
- All enumerated files are under permitted generated-evidence paths; no absolute paths, tokens, secrets, storage state, credentials or user profile paths leak.
- Manifest entries have correct deterministic SHA-256 and byte length; non-existent, unreadable or malformed entries are explicitly represented and never silently called verified.
- Every negative validation fixture still results in GitHub Actions **failure**; evidence recording cannot turn failures into success or mark missing tests as passed.
- Existing `validate` and `portfolio-quality-gate / validate` check names are unchanged. Standalone QA fixed baseline, B03 independence, and existing 7/7 gate remain unchanged until separately approved.
- At least one successful and one controlled failing GitHub-hosted run provide independently inspected, archived references; artifact expiration and verification limitations are documented.
- All merges and SHA promotions require separate owner review; no merge, deploy, publication or branch-protection changes occur within this audit.

## 5. Decision

**GO for scoped additive evidence-manifest design, conditional on owner review; NO-GO for a rewrite of existing Playwright reporters, changes to the deterministic oracle, unauthorized AI triage automation, or an unreviewed expansion of the strict seven-test suite.**

This audit makes no source or workflow changes and does not claim to have executed a new test run.
