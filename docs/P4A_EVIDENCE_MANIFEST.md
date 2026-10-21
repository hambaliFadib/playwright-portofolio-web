# P4-A2 Evidence Manifest

This feature adds a non-authoritative, allowlisted, versioned SHA-256 evidence inventory to the portfolio QA consumer repository, without changing the adopted framework or Playwright PASS/FAIL.

## Commands

- `npm run evidence:selftest`: offline negative integrity tests (tamper, duplicate, malicious/secret/symlink paths, missing/malformed reports, run mismatch).
- `npm run evidence:write`: write `artifacts/evidence-manifest.json` atomically.
- `npm run evidence:verify`: re-enumerate actual files and validate the manifest and current GitHub run identity.

## Contract

The manifest records GitHub run ID, attempt, event, event SHA, QA implementation SHA, application tested SHA, framework adopted SHA and available report verdict. Each included artifact has a relative path, byte size and SHA-256. File paths are restricted to generated evidence under `artifacts/`, `playwright-report/` and `test-results/`, with explicit allowlisted top-level artifact names, safe evidence extensions elsewhere, no symlinks, no special hidden paths and no sensitive-name paths. No `.env`, tokens, passwords, credentials or browser storage state are intended for inclusion.

**Inventory is not an independent attestation:** build and verification operate in the same runner and cannot prove artifacts have not been mutated after upload or override GitHub's own ZIP digest. The manifest excludes itself. JSON report semantic verification reuses the existing strict 7/7 verifier; missing or invalid reports cause `evidenceStatus: incomplete`, never a fabricated PASS.

## CI

Both QA workflows run evidence self-tests and best-effort evidence write+verification with `if: always()`, before existing artifact upload. This cannot turn an earlier failed job into a success. The exact 7-test report gate, existing required check name `validate`, fixed standalone app baseline, and framework-source pin remain unchanged. No live AI API access is introduced.

## Limitations / follow-up

- Repo-side upload success does not replace independently downloading and validating a published artifact before an audit decision.
- Standalone QA workflow currently records initial provenance; when a validated report exists, the manifest can mark `evidenceStatus: incomplete` because provenance was never finalized. Final-provenance parity is a separate reviewable enhancement.
- CI must be inspected on GitHub-hosted Linux for path allowlist coverage before considering this PR ready.
- Artifacts currently expire after 14 days; this PR does not alter retention policy.
- A future approved app caller pin update is needed before app PRs run the QA version introduced by this feature.

## Acceptance

- Self-tests pass, both QA CI jobs pass at the test branch, and manifest is uploaded.
- Under a known negative Playwright failure, report gate remains failed; manifest must never assert PASS.
- No modifications to application, upstream framework or GitHub rulesets.
- No merge/publish/deploy by automation.
