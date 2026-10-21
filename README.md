# Portfolio QA Automation

A project-specific adoption of the Playwright Quality Framework pinned at b5b46cc60b834ffe5ae0fcfc38d8d87921bd490d. The framework remains the source of test PASS/FAIL; AI is limited to the upstream bounded data and advisory triage paths.

## Setup

Use Node.js 22 and a separate checkout of the pinned portfolio application revision documented in project.config.js. Do not edit the application checkout.

1. Run npm ci in this repository.
2. Run npx playwright install chromium.
3. Copy .env.example to .env and set PORTFOLIO_APP_ROOT to the separate application checkout path.
4. Run npm run validate:with-app. It starts only its own production server process, runs validation, and stops that process.

To run a suite against an already running local server, set BASE_URL and PORTFOLIO_APP_ROOT, then run npm run test:unit, npm run test:api, npm run test:e2e, or npm run test:all.

The CI workflow independently checks out the QA revision and the pinned application SHA, installs locked dependencies, builds the production app, and runs the same validation against that build. No AI provider credentials are needed for validation.

## Current proof of concept

- UI/E2E: homepage hero, home-anchor navigation, and Dark/Light theme toggle persistence in both directions.
- HTTP/API: a Playwright APIRequestContext smoke check of the real static homepage response. The portfolio has no business API; this is not presented as API business coverage.
- Unit: tests the application’s actual lib/date-ranges.ts functions. The suite loads the source from PORTFOLIO_APP_ROOT and uses the application’s installed TypeScript transpileModule in memory; it does not copy the calculation logic or launch a browser.

See docs/FRAMEWORK_ADOPTION.md and docs/PROJECT_TEST_STRATEGY.md for source provenance, controlled adaptations, deferred testing levels, and limitations.