'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { allowedPath, buildManifest, verifyManifest, writeManifest } = require('./evidence-manifest');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p4a-evidence-selftest-'));
const context = { repository: 'test/repo', runId: '123', runAttempt: '1', event: 'pull_request', eventSha: 'f'.repeat(40) };
function file(relative, contents) {
  const name = path.join(root, relative);
  fs.mkdirSync(path.dirname(name), { recursive: true });
  fs.writeFileSync(name, contents);
  return name;
}
function mustFail(name, action, match = /Evidence manifest/) {
  assert.throws(action, match, name);
}
try {
  for (const value of ['../.env', 'artifacts/../secret.txt', '/etc/passwd', 'artifacts\\a.log',
    'artifacts/secret.txt', 'artifacts/private-token.log', 'test-results/storageState.json',
    'test-results/.hidden', 'artifacts/evidence-manifest.json', 'artifacts/malicious.json']) {
    assert.equal(allowedPath(value), false, 'unsafe path must be denied: ' + value);
  }
  file('artifacts/portfolio-build.log', 'build evidence\n');
  file('test-results/case/trace.zip', 'fake trace bytes');
  const missing = buildManifest(root, context);
  assert.equal(missing.evidenceStatus, 'incomplete');
  assert.equal(missing.provenanceStatus, 'missing');
  assert.equal(missing.report.status, 'missing');
  assert.deepEqual(missing.files.map((x) => x.path), ['artifacts/portfolio-build.log', 'test-results/case/trace.zip']);
  const manifest = writeManifest(root, context);
  assert.deepEqual(verifyManifest(root, manifest, context), manifest);
  assert.equal(manifest.files[0].sha256, crypto.createHash('sha256').update('build evidence\n').digest('hex'));
  assert.equal(fs.existsSync(path.join(root, 'artifacts/evidence-manifest.json')), true);
  const duplicate = JSON.parse(JSON.stringify(manifest));
  duplicate.files.push(duplicate.files[0]);
  mustFail('duplicate path', () => verifyManifest(root, duplicate, context));
  const corrupt = JSON.parse(JSON.stringify(manifest));
  corrupt.files[0].sha256 = '0'.repeat(64);
  mustFail('checksum mismatch', () => verifyManifest(root, corrupt, context));
  const forgery = JSON.parse(JSON.stringify(manifest));
  forgery.evidenceStatus = 'complete';
  mustFail('false complete verdict', () => verifyManifest(root, forgery, context));
  const falseRun = JSON.parse(JSON.stringify(context));
  falseRun.runId = '999';
  mustFail('run mismatch', () => verifyManifest(root, manifest, falseRun));
  file('artifacts/portfolio-build.log', 'tampered');
  mustFail('tampered file', () => verifyManifest(root, manifest, context));
  file('artifacts/portfolio-build.log', 'build evidence\n');
  file('artifacts/all-results.json', '{ broken');
  assert.equal(buildManifest(root, context).report.status, 'invalid');
  fs.rmSync(path.join(root, 'artifacts/all-results.json'));
  const provenance = {
    phase: 'final',
    trigger: { runId: context.runId, runAttempt: context.runAttempt,
      event: context.event, callerEventSha: context.eventSha },
    qa: { implementationSha: 'a'.repeat(40) },
    application: { testedSha: 'b'.repeat(40) },
    framework: { adoptedSha: 'c'.repeat(40) },
  };
  file('artifacts/provenance.json', JSON.stringify(provenance));
  assert.equal(buildManifest(root, context).provenanceStatus, 'final');
  for (const key of ['runId', 'runAttempt', 'eventSha', 'event']) {
    const mismatched = { ...context, [key]: key === 'event' ? 'push' : 'different' };
    const result = buildManifest(root, mismatched);
    assert.equal(result.provenanceStatus, 'context-mismatch', 'reject stale ' + key);
    assert.equal(result.evidenceStatus, 'incomplete', 'stale run must not be complete');
    assert.equal(result.revisions.qa, null, 'untrusted SHA must not be copied');
  }
  const newManifest = writeManifest(root, context);
  mustFail('stale provenance cannot verify under a new run',
    () => verifyManifest(root, newManifest, { ...context, runId: '456' }));
  assert.equal(newManifest.provenanceStatus, 'final');
  fs.rmSync(path.join(root, 'artifacts/provenance.json'));
  const secret = file('artifacts/secret.txt', 'x');
  mustFail('unapproved sensitive file', () => buildManifest(root, context));
  fs.rmSync(secret);
  const linkTarget = file('test-results/target.txt', 'target');
  const link = path.join(root, 'test-results', 'linked.txt');
  fs.symlinkSync(linkTarget, link);
  mustFail('symlink', () => buildManifest(root, context));
  fs.rmSync(link);
  assert.equal(buildManifest(root, context).files.length, 3); // manifest is excluded; existing 2 files + target.txt
  console.log('P4-A evidence manifest negative and checksum self-tests passed.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
