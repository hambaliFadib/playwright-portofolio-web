# P4-A3 — Early-Failure Evidence Hardening

## Motivation

The P4-A2 manifest depends on the checked-out QA repository and Node.js. On failures before checkout or dependency installation, the existing `if: always()` manifest/provenance steps cannot necessarily run. P4-A3 adds a runner-local, Node.js built-in-module-only CommonJS stage record that can survive an unavailable QA checkout.

## Contract

- Writes `portfolio-qa-early-evidence/early-failure.json` under `RUNNER_TEMP`, outside both application and QA checkouts.
- Captures GitHub run/attempt and allowlisted SHA/repository/event metadata plus named workflow step outcomes. Stage names and status values are fixed and sanitized.
- Selects the first observed failure/cancellation; if there is no failure, marks an unknown/skipped stage rather than fabricating success.
- The resulting record is **advisory** and cannot override the strict seven-test gate, GitHub check conclusion, P4-A2 provenance or manifest.
- If the QA checkout is missing, an embedded CommonJS fallback creates an explicitly `incomplete` JSON artifact without importing source code from that checkout. This covers missing checkout and npm dependencies when Node.js is available. A failure to provision Node.js itself cannot be covered without an approved additional runtime.
- Both workflows upload runner-temp evidence as a **separate** `portfolio-qa-early-evidence*` artifact with `if: always()`, preserving the existing Playwright evidence ZIP paths and P4-A2 SHA-256 inventory. Standalone-only absent stages are explicitly `not-applicable`, not `unknown`.
- `scripts/early-failure-evidence.js selftest` exercises success, failed checkout, failed dependency, failed build, report failure, skipped/unknown stage and malformed contextual identifiers.

## Limitations

A GitHub-hosted runner interruption, disk failure, cancellation that aborts subsequent steps, artifact service outage, or an unavailable Node.js runtime can still prevent upload. This is best-effort evidence, not a guarantee. Individual stage outcomes are runner metadata and not proof that unattempted tests passed. A successful manifest remains the authoritative file inventory for its allowlisted evidence; the runner-temp JSON is uploaded separately and has not been added to the P4-A2 checksum inventory.

## Acceptance

- Positive CI passes without changing required check names and validates the early-failure contract.
- Test failures keep `validate` failed; an intentionally failed early step in a controlled negative workflow should still produce the incomplete runner-temp record.
- No change to app runtime, upstream Playwright framework, rulesets or strict 7/7 Playwright requirements.
- No merge, publish or deploy automatically.
