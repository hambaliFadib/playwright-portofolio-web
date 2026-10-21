const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const project = require('../project.config');
const { validateRevisionContract, resolveExpectedApplicationSha } = require('./verify-revisions');
const { EXPECTED, summarizeReport, readReport } = require('./verify-test-report');

function validContract() {
  return { applicationRepository: 'hambaliFadib/portofolio-web', eventRepository: 'hambaliFadib/portofolio-web',
    eventName: 'pull_request', baseRef: 'dev', callerSha: '1'.repeat(40), appTestSha: '1'.repeat(40),
    appPrHeadSha: '2'.repeat(40), eventHeadSha: '2'.repeat(40), appCheckoutSha: '1'.repeat(40),
    qaSourceSha: '3'.repeat(40), qaCheckoutSha: '3'.repeat(40) };
}
function validReport() {
  const suites = [];
  for (const [file, projects] of Object.entries(EXPECTED)) {
    const specs = [];
    for (const [projectName, count] of Object.entries(projects)) {
      for (let i = 0; i < count; i += 1) specs.push({ title: path.basename(file) + ' case ' + i,
        tests: [{ projectName, expectedStatus: 'passed', results: [{ status: 'passed' }] }] });
    }
    suites.push({ file, specs, suites: [] });
  }
  return { stats: { startTime: new Date().toISOString(), duration: 12, expected: 7, skipped: 0, unexpected: 0, flaky: 0 }, errors: [], suites };
}
function failContract(label, edit) {
  const value = validContract(); edit(value);
  assert.throws(() => validateRevisionContract(value), undefined, label);
}
function failReport(label, edit) {
  const value = validReport(); edit(value);
  assert.throws(() => summarizeReport(value), undefined, label);
}
function genuineFailure(qaRoot) {
  const tempBase = path.resolve(os.tmpdir());
  const root = fs.mkdtempSync(path.join(tempBase, 'portfolio-qa-gate-negative-'));
  const resolved = path.resolve(root);
  if (!resolved.startsWith(tempBase + path.sep)) throw new Error('Negative fixture escaped OS temporary directory.');
  try {
    const modulePath = require.resolve('@playwright/test', { paths: [qaRoot] });
    const reportPath = path.join(resolved, 'failure-report.json');
    assert.throws(() => readReport(path.join(resolved, 'missing.json')), /report file is missing/);
    const malformedPath = path.join(resolved, 'malformed.json');
    fs.writeFileSync(malformedPath, '{', 'utf8');
    assert.throws(() => readReport(malformedPath), /report JSON is malformed/);
    const testPath = path.join(resolved, 'required-failure.spec.cjs');
    const configPath = path.join(resolved, 'playwright.config.cjs');
    fs.writeFileSync(testPath,
      'const { test, expect } = require(' + JSON.stringify(modulePath) + ');\n' +
      'test("intentional fail-closed fixture", async () => { expect(1).toBe(2); });\n', 'utf8');
    fs.writeFileSync(configPath,
      'const { defineConfig } = require(' + JSON.stringify(modulePath) + ');\n' +
      'module.exports = defineConfig({ testDir: ' + JSON.stringify(resolved) +
      ', testMatch: "**/*.spec.cjs", retries: 0, reporter: [["json", { outputFile: ' +
      JSON.stringify(reportPath) + ' }]], projects: [{ name: "unit", testMatch: "**/*.spec.cjs" }] });\n', 'utf8');
    const cli = path.join(qaRoot, 'node_modules', '@playwright', 'test', 'cli.js');
    const run = spawnSync(process.execPath, [cli, 'test', '--config', configPath], {
      cwd: qaRoot, env: { ...process.env, CI: '1' }, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024,
    });
    if (run.error) throw run.error;
    if (run.status === null || run.status === 0) throw new Error('Intentional Playwright assertion did not fail.');
    if (!fs.existsSync(reportPath) || fs.statSync(reportPath).size === 0) throw new Error('Real Playwright failure report is missing.');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    if (!report.stats || report.stats.unexpected !== 1 || report.stats.skipped !== 0) throw new Error('Playwright did not record one genuine unexpected failure.');
    assert.throws(() => summarizeReport(report), /expected exactly 7|unexpected|project/i);
    console.log('Real Playwright assertion failure was rejected by the report gate.');
  } finally {

    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
function main() {
  assert.equal(project.application.sha, '5915098e2aa507a451f58e70547abded3023f8d9', 'Standalone pinned application default changed.');
  assert.equal(resolveExpectedApplicationSha({}), project.application.sha, 'Standalone default must stay pinned.');
  assert.equal(resolveExpectedApplicationSha({ PORTFOLIO_APP_TEST_SHA: '4'.repeat(40) }), '4'.repeat(40), 'Explicit immutable override must be honored.');
  assert.equal(validateRevisionContract(validContract()).applicationTestedSha, '1'.repeat(40));
  failContract('wrong repository', (x) => { x.applicationRepository = 'other/repo'; });
  failContract('wrong event type', (x) => { x.eventName = 'push'; });
  failContract('wrong PR base', (x) => { x.baseRef = 'main'; });
  failContract('malformed tested SHA', (x) => { x.appTestSha = 'dev'; });
  failContract('caller revision mismatch', (x) => { x.appTestSha = '4'.repeat(40); });
  failContract('PR head mismatch', (x) => { x.eventHeadSha = '5'.repeat(40); });
  failContract('application checkout mismatch', (x) => { x.appCheckoutSha = '6'.repeat(40); });
  failContract('unverifiable QA source', (x) => { x.qaCheckoutSha = '7'.repeat(40); });
  assert.deepEqual(summarizeReport(validReport()).projects, { chromium: 3, api: 1, unit: 3 });
  failReport('missing test count', (x) => { x.stats.expected = 6; });
  failReport('skipped test', (x) => { x.stats.skipped = 1; });
  failReport('unexpected failure', (x) => { x.stats.unexpected = 1; });
  failReport('flaky retry', (x) => { x.stats.flaky = 1; });
  failReport('malformed report', (x) => { delete x.errors; });
  failReport('missing report timing metadata', (x) => { delete x.stats.duration; });
  failReport('unknown suite', (x) => { x.suites[0].file = 'unknown.spec.js'; });
  failReport('wrong suite distribution', (x) => { x.suites[0].specs[0].tests[0].projectName = 'api'; });
  failReport('missing required suite cases', (x) => { x.suites.pop(); });
  genuineFailure(path.resolve(__dirname, '..'));
  console.log('Quality-gate contract self-test passed: SHA, event, repository, suite count, skips, retries, malformed report, and genuine test failure.');
}
try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
