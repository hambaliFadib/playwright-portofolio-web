# Portfolio QA Test Strategy

## Application revision contract

The suite is scoped to the application repository and exact SHA in project.config.js. CI checks the QA repository and application out independently and verifies both revisions before execution. The application checkout is never edited. Local app builds run only in a separate disposable checkout. The adopted framework SHA is also recorded in artifacts/provenance.json.

## Implemented proof of concept

| Level | Status | Evidence and scope |
|---|---|---|
| UI/E2E | Implemented | Chromium opens the real production homepage, checks its known hero and primary navigation, follows the existing Home anchor, and toggles theme Dark → Light and Light → Dark. Each direction verifies root theme class, persisted theme, idle scene after completion, and persistence after reload. |
| HTTP/API | Implemented as HTTP smoke only | Playwright APIRequestContext requests GET / and checks the real homepage response status, HTML content type, and server-rendered title and description metadata. The application is static and has no suitable business API; this is not business API coverage. |
| Unit | Implemented | Playwright Test runs a browserless project and tests the actual pinned app lib/date-ranges.ts. It reads source from the separately checked-out application and transforms it in memory using the TypeScript compiler already installed by the app lockfile. No business logic is copied. |

All tests import test and expect through src/fixtures/test.fixture.js. Unit and API projects do not request page or browser fixtures. Assertions remain in specs.

## Levels deferred

### Component

No React component suite is claimed. The pinned @playwright/test 1.62.1 supports Playwright's story-and-gallery component model: a QA/app-owned gallery served by a compatible development pipeline renders named component stories, and Playwright's mount fixture drives them. This model is documented in the Playwright 1.62 release notes and component testing guide.

The portfolio app is a read-only Next.js/Turbopack checkout. Its React components are TSX modules with app aliases, global CSS, Next.js imports, and theme/provider dependencies. Adding stories inside the application would violate the no-app-source-change boundary; a separate QA gallery would need to reproduce and validate those build, alias, CSS, and provider contracts. The framework's JavaScript/CommonJS default also makes a TSX gallery a controlled architecture extension. Defer component testing until a separate compatibility checkpoint proves a QA-owned gallery can exercise the actual components without copying them or changing the app. See https://playwright.dev/docs/release-notes#version-162 and https://playwright.dev/docs/test-components.
### Integration

The portfolio has no business API, database, or mutable server-side domain. The home HTTP response and browser UI run against the same production build, but no separate integration or backend behavior is claimed. Add integration tests only if a real service boundary is introduced.

### Accessibility

Role and accessible-name locators cover the tested controls' basic semantic exposure. They do not constitute a WCAG audit or automated accessibility scan. A later checkpoint should choose and pin a supported accessibility analyzer, establish page-level coverage and severity handling, and separately review keyboard/focus and contrast requirements.

### Visual regression

Playwright captures screenshots and traces on test failure, but P3A has no approved golden screenshots or pixel baseline. No visual-regression coverage is claimed. A later visual suite needs an owner-approved baseline, stable viewport/font/browser/reduced-motion settings, and a reviewable threshold policy.

## Determinism and evidence

- Playwright assertions alone set PASS/FAIL. AI triage is advisory and cannot change status.
- BASE_URL is supplied by environment. The owned server helper chooses a free loopback port when one is not provided.
- Suite JSON reports, HTML report, traces/screenshots, application build log, server log, and provenance are written under ignored artifacts/report directories and uploaded by CI.
- Homepage Regression and B03 are deliberately not migrated in this P3A checkpoint.