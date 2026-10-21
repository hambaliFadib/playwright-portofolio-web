const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const project = require('../project.config');
const { resolveExpectedApplicationSha } = require('./verify-revisions');
const { readReport } = require('./verify-test-report');
const qaRoot = path.resolve(__dirname, '..');
function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function dirtyPaths(cwd) {
  const output = execFileSync('git', ['-C', cwd, 'status', '--porcelain=v1', '--untracked-files=all'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return output.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3));
}
function getTestEvidence(reportPath) {
  if (!fs.existsSync(reportPath)) return { status: 'not-produced', path: reportPath, conclusion: 'unavailable' };
  try {
    const checked = readReport(reportPath);
    return { status: 'verified', path: reportPath, counts: checked.summary, conclusion: 'passed' };
  } catch (error) {
    let counts = null;
    try { counts = JSON.parse(fs.readFileSync(reportPath, 'utf8')).stats || null; } catch { counts = null; }
    return { status: 'invalid', path: reportPath, counts, conclusion: 'failed', validationError: error.message };
  }
}
function main() {
  const appRoot = process.env.PORTFOLIO_APP_ROOT;
  if (!appRoot) throw new Error('PORTFOLIO_APP_ROOT is required to record application provenance.');
  const resolvedAppRoot = path.resolve(appRoot);
  const appSha = git(resolvedAppRoot, ['rev-parse', 'HEAD']);
  const expectedAppSha = resolveExpectedApplicationSha();
  if (appSha !== expectedAppSha) throw new Error('Application SHA mismatch: expected ' + expectedAppSha + '; found ' + appSha);
  const qaSha = git(qaRoot, ['rev-parse', 'HEAD']);
  const qaSourcePin = process.env.PORTFOLIO_QA_SOURCE_SHA || qaSha;
  if (qaSourcePin !== qaSha) throw new Error('QA source SHA mismatch: expected ' + qaSourcePin + '; found ' + qaSha);
  const appPackage = require(path.join(resolvedAppRoot, 'package.json'));
  let typescriptVersion = null;
  try { typescriptVersion = require(path.join(resolvedAppRoot, 'node_modules', 'typescript', 'package.json')).version; } catch { typescriptVersion = null; }
  const playwright = require('@playwright/test/package.json');
  const reportPath = process.env.PORTFOLIO_TEST_REPORT || path.join(qaRoot, 'artifacts', 'all-results.json');
  const finalPhase = process.argv.includes('--final');
  const result = {
    capturedAt: new Date().toISOString(),
    phase: finalPhase ? 'final' : 'initial',
    trigger: {
      event: process.env.GITHUB_EVENT_NAME || 'local',
      runId: process.env.GITHUB_RUN_ID || null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
      pullRequestNumber: process.env.PORTFOLIO_PR_NUMBER || null,
      callerEventSha: process.env.GITHUB_SHA || null,
    },
    qa: {
      repository: 'https://github.com/hambaliFadib/playwright-portofolio-web',
      implementationSha: qaSha,
      pinnedSourceSha: qaSourcePin,
      branch: git(qaRoot, ['branch', '--show-current']) || null,
      dirtyPaths: dirtyPaths(qaRoot),
    },
    application: {
      repository: project.application.repository,
      configuredRef: project.application.ref,
      configuredBaselineSha: project.application.sha,
      testedSha: appSha,
      prHeadSha: process.env.PORTFOLIO_APP_PR_HEAD_SHA || null,
      revisionSource: process.env.PORTFOLIO_APP_TEST_SHA ? 'explicit immutable caller input' : 'project.config fixed baseline',
      dirtyPaths: dirtyPaths(resolvedAppRoot),
      packageName: appPackage.name,
      nextVersion: appPackage.dependencies && appPackage.dependencies.next || null,
      typescriptVersion,
    },
    framework: { repository: project.framework.repository, adoptedSha: project.framework.sha },
    runtime: { node: process.version, playwrightTest: playwright.version },
    suites: project.suites,
    testExecution: getTestEvidence(reportPath),
    passFailOracle: 'Playwright Test assertions only; AI triage is advisory and cannot change test status.',
  };
  const output = path.join(qaRoot, 'artifacts', 'provenance.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(result, null, 2));
}
main();
