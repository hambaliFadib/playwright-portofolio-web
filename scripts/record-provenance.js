const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const project = require('../project.config');

const qaRoot = path.resolve(__dirname, '..');

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function dirtyPaths(cwd) {
  const output = git(cwd, ['status', '--porcelain=v1', '--untracked-files=all']);
  return output ? output.split(/\r?\n/).map((line) => line.slice(3)) : [];
}

function main() {
  const appRoot = process.env.PORTFOLIO_APP_ROOT;
  if (!appRoot) throw new Error('PORTFOLIO_APP_ROOT is required to record application provenance.');
  const resolvedAppRoot = path.resolve(appRoot);
  const appSha = git(resolvedAppRoot, ['rev-parse', 'HEAD']);
  if (appSha !== project.application.sha) {
    throw new Error('Application SHA mismatch: expected ' + project.application.sha + '; found ' + appSha);
  }

  const appPackage = require(path.join(resolvedAppRoot, 'package.json'));
  const appTypeScript = require(path.join(resolvedAppRoot, 'node_modules', 'typescript', 'package.json'));
  const playwright = require('@playwright/test/package.json');
  const report = {
    capturedAt: new Date().toISOString(),
    event: process.env.GITHUB_EVENT_NAME || 'local',
    qa: {
      repository: 'https://github.com/hambaliFadib/playwright-portofolio-web',
      testedSha: git(qaRoot, ['rev-parse', 'HEAD']),
      eventSha: process.env.GITHUB_SHA || null,
      branch: git(qaRoot, ['branch', '--show-current']) || null,
      dirtyPaths: dirtyPaths(qaRoot),
    },
    application: {
      repository: project.application.repository,
      ref: project.application.ref,
      expectedSha: project.application.sha,
      checkedOutSha: appSha,
      dirtyPaths: dirtyPaths(resolvedAppRoot),
      packageName: appPackage.name,
      nextVersion: appPackage.dependencies.next,
      typescriptVersion: appTypeScript.version,
    },
    framework: {
      repository: project.framework.repository,
      adoptedSha: project.framework.sha,
    },
    runtime: {
      node: process.version,
      playwrightTest: playwright.version,
    },
    suites: project.suites,
    passFailOracle: 'Playwright Test assertions only; AI triage is advisory and cannot change test status.',
  };

  const output = path.join(qaRoot, 'artifacts', 'provenance.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main();