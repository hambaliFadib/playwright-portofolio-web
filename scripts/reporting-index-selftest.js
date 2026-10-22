'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildIndex, writeIndex, REPORT_RELATIVE } = require('./reporting-index');
const { resolveReportPath, readEvidence } = require('./ai-triage');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p4a4-reporting-'));
const reportPath = path.join(root, REPORT_RELATIVE);
const env = {
  STEP_VALIDATE_OUTCOME: 'skipped',
  STEP_REPORT_GATE_OUTCOME: 'not-applicable',
  GITHUB_RUN_ID: '123',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_SHA: 'a'.repeat(40),
};
function check(validate, gate, expected, status) {
  const value = buildIndex(root, {
    ...env, STEP_VALIDATE_OUTCOME: validate, STEP_REPORT_GATE_OUTCOME: gate,
  });
  assert.equal(value.decision, expected);
  assert.equal(value.report.status, status);
  return value;
}
try {
  assert.equal(resolveReportPath(['node', 'cli.js'], {}), REPORT_RELATIVE);
  assert.equal(resolveReportPath(['node', 'cli.js', 'custom.json'], {}), 'custom.json');
  assert.equal(resolveReportPath(['node', 'cli.js'], { PORTFOLIO_TEST_REPORT: 'configured.json' }), 'configured.json');
  check('skipped', 'not-applicable', 'NOT_RUN', 'missing');
  check('failure', 'skipped', 'FAIL', 'missing');
  check('success', 'success', 'INCOMPLETE_EVIDENCE', 'missing');
  assert.equal(readEvidence(reportPath).playwrightStatus, 'unknown');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, '{invalid');
  check('success', 'success', 'INCOMPLETE_EVIDENCE', 'invalid');
  assert.equal(readEvidence(reportPath).playwrightStatus, 'unknown');
  const fake = { ...env, PORTFOLIO_TEST_REPORT: 'artifacts/playwright-results.json',
    STEP_VALIDATE_OUTCOME: 'success', STEP_REPORT_GATE_OUTCOME: 'success' };
  assert.equal(buildIndex(root, fake).report.status, 'noncanonical-input');
  assert.equal(buildIndex(root, fake).decision, 'INCOMPLETE_EVIDENCE');
  fs.writeFileSync(reportPath, JSON.stringify({
    stats: { startTime: new Date().toISOString(), duration: 12, expected: 7,
      skipped: 0, unexpected: 0, flaky: 0 }, errors: [],
    suites: [
      { file: 'e2e/homepage/homepage.spec.js', specs: [{ title: 'home', tests: [{ projectName: 'chromium', expectedStatus: 'passed', results: [{ status: 'passed' }] }] }] },
      { file: 'e2e/theme/theme-toggle.spec.js', specs: [
        { title: 'dark', tests: [{ projectName: 'chromium', expectedStatus: 'passed', results: [{ status: 'passed' }] }] },
        { title: 'light', tests: [{ projectName: 'chromium', expectedStatus: 'passed', results: [{ status: 'passed' }] }] },
      ] },
      { file: 'api/http-smoke.spec.js', specs: [{ title: 'api', tests: [{ projectName: 'api', expectedStatus: 'passed', results: [{ status: 'passed' }] }] }] },
      { file: 'unit/date-ranges.spec.js', specs: [0, 1, 2].map(i => ({ title: 'unit' + i,
        tests: [{ projectName: 'unit', expectedStatus: 'passed', results: [{ status: 'passed' }] }] })) },
    ],
  }));
  check('success', 'success', 'PASS', 'verified');
  check('success', 'not-applicable', 'PASS', 'verified');
  check('failure', 'success', 'FAIL', 'verified');
  check('skipped', 'success', 'INCOMPLETE_EVIDENCE', 'verified');
  const written = writeIndex(root, { ...env, STEP_VALIDATE_OUTCOME: 'success', STEP_REPORT_GATE_OUTCOME: 'success' });
  assert.equal(written.decision, 'PASS');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'artifacts/reporting-index.json'))).decision, 'PASS');
  assert.equal(written.triage.affectsGate, false);
  assert.equal(written.triage.status, 'NOT_RUN');
  console.log('P4-A4 report-path, decision and advisory isolation self-tests passed.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
