'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readReport } = require('./verify-test-report');

const VERSION = 1;
const ROOTS = Object.freeze(['artifacts', 'playwright-report', 'test-results']);
const ARTIFACT_NAMES = new Set([
  'all-results.json', 'api-results.json', 'unit-results.json',
  'e2e-results.json', 'playwright-results.json', 'provenance.json',
  'portfolio-build.log', 'portfolio-app-server.log',
]);
const EVIDENCE_EXTENSIONS = new Set([
  '.html', '.json', '.jsonl', '.zip', '.png', '.jpg', '.jpeg',
  '.webp', '.txt', '.log', '.css', '.js', '.mjs', '.svg', '.map',
  '.woff', '.woff2', '.ttf', '.webm', '.md',
]);
const SHA256 = /^[a-f0-9]{64}$/;
const SHA40 = /^[a-f0-9]{40}$/i;
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MANIFEST_PATH = 'artifacts/evidence-manifest.json';

function fail(message) {
  throw new Error('Evidence manifest: ' + message);
}

function allowedPath(relative) {
  if (typeof relative !== 'string' || !relative ||
      path.posix.isAbsolute(relative) || relative.includes('\\') ||
      relative.includes('\0') || relative.split('/').some((part) => !part || part === '.' || part === '..')) {
    return false;
  }
  const parts = relative.split('/');
  if (!ROOTS.includes(parts[0]) || parts.length < 2) return false;
  if (parts.some((part) => /(^\.env|storage.?state|credential|password|token|secret|(^|[-_.])auth([-_.]|$))/i.test(part))) return false;
  if (relative === MANIFEST_PATH || relative === 'artifacts/.gitkeep' ||
      relative === 'test-results/.last-run.json') return false;
  if (parts.some((part) => part.startsWith('.'))) return false;
  if (parts[0] === 'artifacts') {
    return parts.length === 2 && ARTIFACT_NAMES.has(parts[1]);
  }
  return EVIDENCE_EXTENSIONS.has(path.posix.extname(relative).toLowerCase());
}

function inventory(root) {
  const entries = [];
  const seen = new Set();
  for (const directory of ROOTS) {
    const dir = path.join(root, directory);
    if (!fs.existsSync(dir)) continue;
    if (!fs.lstatSync(dir).isDirectory() || fs.lstatSync(dir).isSymbolicLink()) {
      fail('unsafe evidence root: ' + directory);
    }
    function visit(current, relDir) {
      for (const item of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
        const rel = relDir + '/' + item.name;
        if (rel === MANIFEST_PATH || rel === 'artifacts/.gitkeep' ||
            rel === 'test-results/.last-run.json') continue;
        if (item.isSymbolicLink()) fail('symbolic links are not evidence: ' + rel);
        if (item.isDirectory()) {
          if (item.name.startsWith('.') || /(^\.env|storage.?state|credential|password|token|secret|(^|[-_.])auth([-_.]|$))/i.test(item.name)) {
            fail('unsafe directory: ' + rel);
          }
          visit(path.join(current, item.name), rel);
          continue;
        }
        if (!item.isFile() || !allowedPath(rel)) fail('unapproved evidence path: ' + rel);
        if (seen.has(rel)) fail('duplicate evidence path: ' + rel);
        const file = path.join(current, item.name);
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.size > MAX_FILE_SIZE) fail('unsafe evidence file: ' + rel);
        const body = fs.readFileSync(file);
        entries.push({ path: rel, bytes: body.length, sha256: crypto.createHash('sha256').update(body).digest('hex') });
        seen.add(rel);
      }
    }
    visit(dir, directory);
  }
  return entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

function readProvenance(root, context) {
  const filename = path.join(root, 'artifacts', 'provenance.json');
  if (!fs.existsSync(filename)) return { status: 'missing', value: null };
  try {
    const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (!value || !['initial', 'final'].includes(value.phase) ||
        !SHA40.test(value.qa?.implementationSha || '') ||
        !SHA40.test(value.application?.testedSha || '') ||
        !SHA40.test(value.framework?.adoptedSha || '')) return { status: 'invalid', value: null };
    const trigger = value.trigger;
    if (!trigger || typeof trigger !== 'object' ||
        trigger.runId !== (context.runId ?? null) ||
        trigger.runAttempt !== (context.runAttempt ?? null) ||
        trigger.event !== (context.event ?? null) ||
        trigger.callerEventSha !== (context.eventSha ?? null)) {
      return { status: 'context-mismatch', value: null };
    }
    return { status: value.phase, value };
  } catch {
    return { status: 'invalid', value: null };
  }
}

function readTestEvidence(root) {
  const filename = path.join(root, 'artifacts', 'all-results.json');
  if (!fs.existsSync(filename)) return { status: 'missing', summary: null };
  try {
    const checked = readReport(filename);
    return { status: 'verified', summary: checked.summary };
  } catch {
    return { status: 'invalid', summary: null };
  }
}

function defaultContext() {
  const env = process.env;
  return {
    repository: env.GITHUB_REPOSITORY || null,
    runId: env.GITHUB_RUN_ID || null,
    runAttempt: env.GITHUB_RUN_ATTEMPT || null,
    event: env.GITHUB_EVENT_NAME || 'local',
    eventSha: env.GITHUB_SHA || null,
  };
}

function buildManifest(root, context = defaultContext()) {
  const resolved = path.resolve(root);
  const provenance = readProvenance(resolved, context);
  const test = readTestEvidence(resolved);
  const source = provenance.value;
  const files = inventory(resolved);
  const isComplete = provenance.status === 'final' && test.status === 'verified';
  return {
    schemaVersion: VERSION,
    kind: 'portfolio-qa-evidence-inventory',
    inventoryScope: 'allowlisted-generated-evidence',
    context: {
      repository: context.repository ?? null,
      runId: context.runId ?? null,
      runAttempt: context.runAttempt ?? null,
      event: context.event ?? null,
      eventSha: context.eventSha ?? null,
    },
    revisions: {
      qa: source?.qa?.implementationSha || null,
      application: source?.application?.testedSha || null,
      framework: source?.framework?.adoptedSha || null,
      appPrHead: source?.application?.prHeadSha || null,
    },
    provenanceStatus: provenance.status,
    report: test,
    evidenceStatus: isComplete ? 'complete' : 'incomplete',
    files,
  };
}

function verifyManifest(root, manifest, context) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) ||
      manifest.schemaVersion !== VERSION || manifest.kind !== 'portfolio-qa-evidence-inventory' ||
      manifest.inventoryScope !== 'allowlisted-generated-evidence' ||
      !Array.isArray(manifest.files)) fail('invalid schema header or files');
  const paths = new Set();
  for (const entry of manifest.files) {
    if (!entry || !allowedPath(entry.path) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 ||
        typeof entry.sha256 !== 'string' || !SHA256.test(entry.sha256) || paths.has(entry.path)) {
      fail('malformed, unsafe or duplicate file entry');
    }
    paths.add(entry.path);
  }
  const expected = buildManifest(root, context || manifest.context);
  if (JSON.stringify(manifest) !== JSON.stringify(expected)) fail('inventory, hashes, revisions or report status mismatch');
  if (context && JSON.stringify(manifest.context) !== JSON.stringify(expected.context)) fail('CI run identity mismatch');
  return expected;
}

function writeManifest(root, context) {
  const resolved = path.resolve(root);
  const manifest = buildManifest(resolved, context);
  const dest = path.join(resolved, MANIFEST_PATH);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const temp = dest + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify(manifest, null, 2) + '\n', { encoding: 'utf8', flag: 'w', mode: 0o600 });
    fs.renameSync(temp, dest);
    verifyManifest(resolved, manifest, context || defaultContext());
  } finally {
    if (fs.existsSync(temp)) fs.rmSync(temp);
  }
  return manifest;
}

function main() {
  const command = process.argv[2];
  if (!['write', 'verify'].includes(command)) fail('usage: evidence-manifest.js write|verify');
  const root = path.resolve(__dirname, '..');
  const manifest = command === 'write'
    ? writeManifest(root)
    : verifyManifest(root, JSON.parse(fs.readFileSync(path.join(root, MANIFEST_PATH), 'utf8')), defaultContext());
  console.log('Evidence manifest ' + command + ': ' + JSON.stringify({
    status: manifest.evidenceStatus, report: manifest.report.status,
    provenance: manifest.provenanceStatus, files: manifest.files.length,
    runId: manifest.context.runId,
  }));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { MANIFEST_PATH, allowedPath, inventory, buildManifest, verifyManifest, writeManifest };
