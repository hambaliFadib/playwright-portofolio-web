'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readReport } = require('./verify-test-report');

const REPORT_RELATIVE = 'artifacts/all-results.json';
const INDEX_RELATIVE = 'artifacts/reporting-index.json';
const OUTCOMES = new Set(['success', 'failure', 'cancelled', 'skipped', 'unknown', 'not-applicable']);
const SAFE_RUN = /^\d+$/;
const SAFE_SHA = /^[a-f0-9]{40}$/i;

function stepOutcome(value) {
  return typeof value === 'string' && OUTCOMES.has(value) ? value : 'unknown';
}
function runValue(value, pattern) {
  return typeof value === 'string' && pattern.test(value) ? value : null;
}

// Only the canonical strict-gate report may inform this index.
function buildIndex(root, env = process.env) {
  const canonical = path.resolve(root, REPORT_RELATIVE);
  const configured = env.PORTFOLIO_TEST_REPORT
    ? path.resolve(root, env.PORTFOLIO_TEST_REPORT) : canonical;
  const canonicalInput = configured === canonical;
  const validate = stepOutcome(env.STEP_VALIDATE_OUTCOME);
  const reportGate = stepOutcome(env.STEP_REPORT_GATE_OUTCOME);
  let evidence = 'missing';
  let strictSummary = null;
  if (!canonicalInput) {
    evidence = 'noncanonical-input';
  } else if (fs.existsSync(canonical)) {
    try {
      strictSummary = readReport(canonical).summary;
      evidence = 'verified';
    } catch {
      evidence = 'invalid';
    }
  }

  let decision;
  if (validate === 'failure' || validate === 'cancelled' ||
      reportGate === 'failure' || reportGate === 'cancelled') {
    decision = 'FAIL';
  } else if (evidence === 'verified' && validate === 'success' &&
             (reportGate === 'success' || reportGate === 'not-applicable')) {
    decision = 'PASS';
  } else if (validate === 'skipped' && evidence === 'missing') {
    decision = 'NOT_RUN';
  } else {
    decision = 'INCOMPLETE_EVIDENCE';
  }
  return {
    schemaVersion: 1,
    kind: 'portfolio-qa-reporting-index',
    context: {
      runId: runValue(env.GITHUB_RUN_ID, SAFE_RUN),
      runAttempt: runValue(env.GITHUB_RUN_ATTEMPT, SAFE_RUN),
      callerEventSha: runValue(env.GITHUB_SHA, SAFE_SHA),
    },
    report: { path: REPORT_RELATIVE, status: evidence, strictSummary },
    steps: { validate, reportGate },
    decision,
    triage: {
      mode: 'advisory-only',
      status: 'NOT_RUN',
      inputReport: REPORT_RELATIVE,
      affectsGate: false,
    },
  };
}

function writeIndex(root, env = process.env) {
  const result = buildIndex(root, env);
  const file = path.resolve(root, INDEX_RELATIVE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify(result, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.rmSync(temp);
  }
  if (env.GITHUB_STEP_SUMMARY) {
    const summary = [
      '', '## Reporting consistency (advisory)',
      '| Field | Value |', '| --- | --- |',
      '| Strict report | ' + REPORT_RELATIVE + ' |',
      '| Evidence | ' + result.report.status + ' |',
      '| Validation | ' + validateDisplay(result.steps.validate) + ' |',
      '| Strict report gate | ' + validateDisplay(result.steps.reportGate) + ' |',
      '| Diagnostic decision | **' + result.decision + '** |',
      '| AI triage | NOT_RUN (advisory only) |', '',
    ].join('\n');
    fs.appendFileSync(env.GITHUB_STEP_SUMMARY, summary, 'utf8');
  }
  return result;
}
function validateDisplay(value) {
  return value === 'not-applicable' ? 'N/A' : value;
}
function main() {
  if (process.argv[2] !== 'write') throw new Error('Usage: node scripts/reporting-index.js write');
  const result = writeIndex(path.resolve(__dirname, '..'));
  console.log('Reporting index: ' + JSON.stringify({
    decision: result.decision, report: result.report.status,
    validate: result.steps.validate, reportGate: result.steps.reportGate,
  }));
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { REPORT_RELATIVE, INDEX_RELATIVE, buildIndex, writeIndex, stepOutcome };
