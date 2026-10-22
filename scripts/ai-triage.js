const fs = require('fs');
const { triageFailure } = require('../src/ai/triage');

function stripAnsi(value) {
  const ansiPattern = new RegExp(String.raw`\u001B\[[0-?]*[ -/]*[@-~]`, 'g');
  return typeof value === 'string' ? value.replace(ansiPattern, '') : value;
}

function findFailedResultInSuite(suite) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      for (const result of test.results || []) {
        if (['failed', 'timedOut', 'interrupted'].includes(result.status)) return { spec, test, result };
      }
    }
  }
  for (const child of suite.suites || []) {
    const found = findFailedResultInSuite(child);
    if (found) return found;
  }
  return null;
}

function findFailedResult(report) {
  for (const suite of report.suites || []) {
    const found = findFailedResultInSuite(suite);
    if (found) return found;
  }
  return null;
}

function evidenceFromReport(report) {
  const failed = findFailedResult(report);
  if (!failed) return { testName: 'unknown', playwrightStatus: 'unknown', retry: 0 };
  const { spec, test, result } = failed;
  const error = result.error || result.errors?.[0] || {};
  return {
    testName: spec.title || test.title || 'unknown',
    playwrightStatus: result.status,
    failureMessage: stripAnsi(error.message),
    stack: stripAnsi(error.stack || result.errors?.[0]?.stack || result.errors?.[0]?.message),
    retry: result.retry || 0,
  };
}

function loadEvidence() {
  if (process.argv.includes('--selftest')) {
    return {
      testName: 'self-test failure keeps Playwright failed',
      playwrightStatus: 'failed',
      failureMessage: 'Expected application state was not observed',
      stack: 'Error: expect(locator).toBeVisible() failed',
      retry: 0,
    };
  }
  return readEvidence(resolveReportPath());
}

function resolveReportPath(argv = process.argv, env = process.env) {
  return argv[2] && argv[2] !== '--selftest'
    ? argv[2]
    : env.PORTFOLIO_TEST_REPORT || 'artifacts/all-results.json';
}

function readEvidence(file) {
  const unavailable = { testName: 'unknown', playwrightStatus: 'unknown', retry: 0 };
  if (!fs.existsSync(file)) return unavailable;
  try {
    return evidenceFromReport(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    // Malformed or unavailable reports can never be treated as AI-confirmed failures.
    return unavailable;
  }
}

async function main() {
  const evidence = loadEvidence();
  const triage = await triageFailure(evidence);
  console.log(JSON.stringify({ playwrightStatus: evidence.playwrightStatus, triage }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { evidenceFromReport, findFailedResult, stripAnsi, resolveReportPath, readEvidence };
