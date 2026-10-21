'use strict';

// Dependency-free CommonJS evidence writer. Does not need npm install or Playwright.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const STAGES = Object.freeze([
  'caller', 'checkout_qa', 'checkout_app', 'revisions', 'node_setup',
  'qa_deps', 'app_deps', 'checkout_paths', 'initial_provenance',
  'gate_selftest', 'policy_selftest', 'triage_selftest', 'ai_contract',
  'app_build', 'chromium', 'validate', 'report_gate', 'final_provenance',
  'evidence_selftest', 'evidence_manifest',
]);
const VALID_OUTCOMES = new Set(['success', 'failure', 'cancelled', 'skipped', 'not-applicable']);
const SHA = /^[a-fA-F0-9]{40}$/;
const DIGITS = /^[0-9]+$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function safe(key, value) {
  if (typeof value !== 'string' || !value) return null;
  if (key === 'runId' || key === 'runAttempt') return DIGITS.test(value) ? value : null;
  if (key === 'eventSha' || key === 'qaPin' || key === 'appTestSha') {
    return SHA.test(value) ? value.toLowerCase() : null;
  }
  if (key === 'repository') return REPO.test(value) ? value : null;
  if (key === 'event') return ['push', 'pull_request', 'workflow_dispatch'].includes(value) ? value : null;
  return null;
}

function build(env, now = new Date()) {
  const stages = {};
  for (const stage of STAGES) {
    const value = env['STAGE_' + stage.toUpperCase()];
    stages[stage] = typeof value === 'string' && VALID_OUTCOMES.has(value.toLowerCase())
      ? value.toLowerCase() : 'unknown';
  }
  const failure = STAGES.find((stage) => ['failure', 'cancelled'].includes(stages[stage]));
  const unresolved = STAGES.find((stage) => ['skipped', 'unknown'].includes(stages[stage]));
  const first = failure || unresolved || null;
  return {
    schemaVersion: 1,
    kind: 'portfolio-qa-early-failure',
    capturedAt: now.toISOString(),
    evidenceStatus: first ? 'incomplete' : 'steps-successful',
    firstNonSuccessStage: first,
    firstNonSuccessOutcome: first ? stages[first] : null,
    context: {
      repository: safe('repository', env.GITHUB_REPOSITORY),
      runId: safe('runId', env.GITHUB_RUN_ID),
      runAttempt: safe('runAttempt', env.GITHUB_RUN_ATTEMPT),
      event: safe('event', env.GITHUB_EVENT_NAME),
      eventSha: safe('eventSha', env.GITHUB_SHA),
      qaPin: safe('qaPin', env.QA_SOURCE_PIN),
      appTestSha: safe('appTestSha', env.APP_TEST_PIN),
    },
    stages,
    note: 'Advisory stage outcomes only; never overrides the GitHub job verdict or strict Playwright report.',
  };
}

function write(env = process.env) {
  const directory = path.join(env.RUNNER_TEMP || os.tmpdir(), 'portfolio-qa-early-evidence');
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, 'early-failure.json');
  const temp = target + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify(build(env), null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, target);
  } finally {
    if (fs.existsSync(temp)) fs.rmSync(temp);
  }
  return target;
}

function selftest() {
  const base = { GITHUB_RUN_ID: '12', GITHUB_RUN_ATTEMPT: '1', GITHUB_SHA: 'a'.repeat(40) };
  for (const stage of STAGES) base['STAGE_' + stage.toUpperCase()] = 'success';
  assert.equal(build(base).evidenceStatus, 'steps-successful');
  for (const stage of ['caller', 'gate_selftest', 'report_gate', 'initial_provenance']) {
    base['STAGE_' + stage.toUpperCase()] = 'not-applicable';
  }
  assert.equal(build(base).evidenceStatus, 'steps-successful');
  assert.equal(build(base).firstNonSuccessStage, null);
  for (const stage of ['caller', 'checkout_qa', 'qa_deps', 'app_build', 'validate', 'report_gate']) {
    const test = { ...base, ['STAGE_' + stage.toUpperCase()]: 'failure' };
    const result = build(test);
    assert.equal(result.evidenceStatus, 'incomplete');
    assert.equal(result.firstNonSuccessStage, stage);
    assert.equal(result.firstNonSuccessOutcome, 'failure');
  }
  for (const status of ['skipped', 'nonsense', 'cancelled']) {
    const test = { ...base, STAGE_QA_DEPS: status };
    assert.equal(build(test).evidenceStatus, 'incomplete');
  }
  const unsafe = { ...base, GITHUB_SHA: 'secret-token', GITHUB_REPOSITORY: 'unsafe repository', QA_SOURCE_PIN: 'secrets' };
  assert.equal(build(unsafe).context.eventSha, null);
  assert.equal(build(unsafe).context.repository, null);
  assert.equal(build(unsafe).context.qaPin, null);
  const output = build({ ...base, STAGE_QA_DEPS: 'failure', STAGE_APP_DEPS: 'failure' });
  assert.equal(output.firstNonSuccessStage, 'qa_deps');
  console.log('P4-A3 CommonJS stage evidence self-tests passed.');
}

function main() {
  const command = process.argv[2];
  if (command === 'write') {
    write();
    console.log('P4-A3 stage evidence recorded at runner temp.');
  } else if (command === 'selftest') {
    selftest();
  } else {
    throw new Error('Usage: node scripts/early-failure-evidence.js write|selftest');
  }
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { STAGES, build, write, selftest };
