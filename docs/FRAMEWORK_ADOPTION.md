# Framework Adoption Record

## Pinned source

- Repository: https://github.com/hambaliFadib/playwright-quality-framework
- Adopted source commit: b5b46cc60b834ffe5ae0fcfc38d8d87921bd490d
- Source was inspected from a separate clone at that exact commit. Its existing local workspace was not changed.
- The source framework is the authority for policy, layering, fixture governance, deterministic PASS/FAIL, and bounded AI use.

## Adoption method

Every tracked file in the source tree was copied into this QA repository while excluding Git metadata. The initial QA repository contained only README.md and .gitignore. No application source, B03 verifier, Homepage Regression suite, generated report, secret, or dependency was copied from the application repository.

### Adopted without modification

- .env.ai.example
- .gitignore
- AGENTS.md
- AI_USAGE.md
- artifacts/.gitkeep
- docs/AGENT_TASK_TEMPLATE.md
- docs/QUICKSTART.md
- policies/AGENT_RULES.md
- policies/ARCHITECTURE_CONTRACT.md
- policies/AUTOMATION_RULES.md
- scripts/ai-contract-check.js
- scripts/ai-triage.js
- scripts/policy-check.js
- scripts/secret-check.js
- src/ai/structured-data.js
- src/ai/triage.js
- src/data/.gitkeep
- src/pages/.gitkeep
- tests/e2e/.gitkeep


### Adapted upstream files

- README.md: replaced template instructions with pinned-app setup and accurate P3A coverage.
- .env.example: keeps BASE_URL and adds PORTFOLIO_APP_ROOT; both values are blank placeholders.
- .github/workflows/playwright.yml: replaces the template-only job with separate QA and pinned-app checkouts, provenance, locked installs, production build, owned-server test execution, read-only permissions, summary, and artifacts.
- package.json: changes the package identity and adds unit/API/all-suite and app-server commands. Dependency names and versions remain the upstream baseline.
- package-lock.json: package identity metadata is updated; the dependency graph remains the framework lock.
- playwright.config.js: retains Chromium default and evidence reporters, and adds explicit Chromium, APIRequestContext, and browserless unit projects.
- eslint.config.js: applies the upstream test-safety and fixture-gateway restrictions to all test levels, including API and unit tests.
- scripts/run-e2e.js: selects only the Chromium E2E project and writes a suite-specific JSON result.
- scripts/run-eslint.js: includes project.config.js in fixed-file lint coverage.
- scripts/policy-selftest.js: adds a direct @playwright/test import violation under tests/api to prove gateway enforcement covers API specs.
- src/fixtures/test.fixture.js: removes the baseline import of missing src/pages/LoginPage.js and injects the real portfolio Page Object.

## Project-specific extensions

- project.config.js pins the application repository and exact dev commit, framework source SHA, and suites.
- src/pages/PortfolioPage.js owns real homepage, home-anchor, and theme-toggle locators/interactions.
- tests/e2e/homepage/homepage.spec.js and tests/e2e/theme/theme-toggle.spec.js cover actual UI behavior in both theme directions.
- tests/api/http-smoke.spec.js uses Playwright APIRequestContext against the actual static homepage; it does not invent a business API.
- tests/unit/date-ranges.spec.js transforms and executes the actual app lib/date-ranges.ts using the TypeScript version installed by the pinned app lockfile. It does not copy app logic and does not use a browser.
- scripts/run-playwright-project.js runs isolated Playwright projects with separate JSON reports.
- scripts/with-app-server.js validates the app SHA and build, allocates/checks a loopback port, starts only its own Next server process, passes a filtered environment to tests, and stops that exact child process.
- scripts/record-provenance.js records QA/app/framework commits, runtime versions, suite names, and checkout cleanliness.
- docs/PROJECT_TEST_STRATEGY.md documents implemented coverage and deferrals.

## Controlled architecture maintenance and justification

The upstream starter fixture imports LoginPage although no LoginPage exists in the pinned framework tree. Leaving it in place makes the consumer fixture gateway unusable. This repository adapts the fixture to the actual PortfolioPage rather than creating a fictitious login capability.

The upstream ESLint test boundary only covers tests/e2e. API and unit specs are also Playwright specs in this project, so the same gateway, no-raw-locator, no-hard-wait, no-force, and visible-assertion restrictions are extended across tests/**. The existing policy self-test is extended to prove direct imports remain rejected in the expanded test scope.

The upstream configuration does not isolate non-browser suites. Explicit projects keep Chromium only for UI/E2E and run API/unit without page or browser fixtures. This preserves Playwright Test as the runner and deterministic oracle.

The upstream run-e2e script remains the browser-suite entry point; project-level runner and app-server wrapper only add the needed separate application revision integration.

## Preserved contracts

- CAPABILITY → BEHAVIOR → SCENARIO organization.
- E2E specs import test and expect through src/fixtures/test.fixture.js.
- Locators and page interactions remain in Page Objects; assertions remain visible in test specs.
- No arbitrary waits, force clicks, focused/skipped tests, swallowed/conditional/trivial assertions, inline ESLint disables, or AI PASS/FAIL.
- Playwright remains the only test oracle.
- AI source modules and upstream AI policies are unchanged.
- No Level 3 or Level 4 database/destructive fixtures are created; no database access is used.
- All validation is deterministic and requires no AI provider credential.

## Future upstream contribution candidate

The missing default LoginPage import is a reusable upstream starter defect. A framework change should remove the unsupported example dependency or include a real, clearly optional sample page object and matching test. No upstream changes were made in P3A.