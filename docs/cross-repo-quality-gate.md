# Cross-Repository Playwright Quality Gate — Execution and Trust Boundaries

## Purpose and state

This design adds a shadow-mode quality gate for pull requests targeting portofolio-web/dev. It does not enable branch protection, replace Portfolio CI, replace B03, or modify either protected baseline. The independent QA repository owns the reusable workflow and the seven-test Playwright suite. The application repository owns a small caller workflow.

## Revision contract

The caller passes four distinct values: the caller repository identity, the application PR synthetic merge SHA (github.sha), the application PR head SHA (github.event.pull_request.head.sha), and the immutable QA source SHA used in the reusable-workflow uses reference. The reusable job validates repository/event/base identity, full SHA formats, caller-provided values against the caller event, and both actual checkout HEADs. The QA and application checkouts are explicit and separate. Mutable branch names never select the application under test.

GitHub documents that a called workflow's github context is associated with the caller. Therefore runtime provenance records caller event fields separately from the explicitly pinned QA checkout SHA; after each run, the Actions API's referenced_workflows record must be inspected to verify the workflow file itself was loaded from that immutable QA commit. The caller workflow pins the same immutable SHA for the QA checkout input. A disagreement fails validation or is surfaced by the run audit.

The existing standalone QA workflow remains unchanged and continues to use the fixed application SHA in project.config.js. Dynamic application testing is opt-in through an explicit environment variable and defaults back to that fixed SHA.

## Execution boundary

Both repositories are checked out with pinned actions/checkout, shallow exact-SHA refs, and persist-credentials: false. Workflow permissions are limited to contents: read; no secrets are passed or inherited. Node and locked dependencies are installed independently in each checkout. The exact application checkout is built and served from its own directory. The QA wrapper launches and stops only its own server child process, uses a sanitized environment for validation, and rejects an application path inside the QA worktree.

The reusable job runs QA lint, architecture policy, secret scanning, AI boundary self-test, AI contract checks, and the existing seven Playwright tests. A strict report gate requires the established 3 Chromium + 1 API + 3 unit distribution, seven expected tests, zero skipped/unexpected/flaky tests, and no malformed report. Provenance records the application PR head and tested merge SHAs separately, QA implementation checkout SHA, adopted framework SHA, event/run/attempt, Node and Playwright versions, and final report counts/conclusion. The deterministic Playwright assertions remain the only pass/fail oracle; AI triage stays advisory.

Artifacts include the generated JSON/HTML reports, test results/traces, application build/server logs, and provenance. No credentials, browser storage state, deployment variables, or secrets are intended to enter the job or its artifacts. No application source is copied into the QA repository.

## Threat and operational limits

Application PR code is untrusted input: npm lifecycle scripts, build scripts, and the production server execute on a disposable GitHub-hosted Linux runner. The job has read-only permissions, no secrets, no persisted checkout token, and no deployment access. A PR may edit its caller workflow; the gate does not establish branch protection or prevent direct pushes/admin bypass. Reviewers must inspect workflow/pin changes, and repository rules must later require both observed checks before merge.

The initial QA gate exercises seven focused unit, HTTP, and UI/E2E cases. It does not replace B03's 31 checks; existing Portfolio CI remains an independent required result in the proposed activation plan. Homepage regression remains separate because its known baseline is 11 PASS / 3 FAIL.

High-severity dependency advisories already present in the QA and application lockfiles remain documented and unchanged. No automated audit remediation is in scope.

## Promotion and activation

QA source upgrades are reviewed and merged in the QA repository first, then promoted by a separate application caller change that pins the exact reviewed QA commit. Framework adoption changes are similarly reviewed as a QA repository update against the exact upstream SHA before the caller pin is advanced. Do not activate required checks until a successful application Draft PR run proves the exact merge revision, seven non-skipped tests, provenance, artifacts, and both independent check names. Proposed branch protection for dev requires the observed Portfolio CI check and observed cross-repository QA check. Keep it disabled during this checkpoint.
