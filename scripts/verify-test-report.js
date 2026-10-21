const fs = require('node:fs');
const path = require('node:path');
const EXPECTED = Object.freeze({
  'e2e/homepage/homepage.spec.js': Object.freeze({ chromium: 1 }),
  'e2e/theme/theme-toggle.spec.js': Object.freeze({ chromium: 2 }),
  'api/http-smoke.spec.js': Object.freeze({ api: 1 }),
  'unit/date-ranges.spec.js': Object.freeze({ unit: 3 }),
});
function reject(message) { throw new Error('Invalid Playwright quality-gate report: ' + message); }
function normalizeFile(value) { return typeof value === 'string' ? value.replace(/\\/g, '/').replace(/^\.?\//, '') : ''; }
function summarizeReport(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) reject('root must be an object.');
  if (!report.stats || typeof report.stats !== 'object') reject('stats is missing.');
  for (const k of ['expected', 'skipped', 'unexpected', 'flaky']) {
    if (!Number.isInteger(report.stats[k]) || report.stats[k] < 0) reject('stats.' + k + ' is malformed.');
  }
  if (typeof report.stats.startTime !== 'string' || !Number.isFinite(Date.parse(report.stats.startTime))) reject('stats.startTime is malformed.');
  if (typeof report.stats.duration !== 'number' || !Number.isFinite(report.stats.duration) || report.stats.duration < 0) reject('stats.duration is malformed.');
  if (report.stats.expected !== 7) reject('expected exactly 7 tests; found ' + report.stats.expected + '.');
  for (const k of ['skipped', 'unexpected', 'flaky']) if (report.stats[k] !== 0) reject('stats.' + k + ' must be zero; found ' + report.stats[k] + '.');
  if (!Array.isArray(report.errors) || report.errors.length !== 0) reject('report errors must be an empty array.');
  if (!Array.isArray(report.suites)) reject('suites must be an array.');
  const counts = Object.create(null);
  const titles = new Set();
  function visit(suites, inheritedFile) {
    for (const suite of suites) {
      if (!suite || typeof suite !== 'object') reject('suite entry is malformed.');
      const file = normalizeFile(suite.file) || inheritedFile;
      if (suite.specs !== undefined) {
        if (!Array.isArray(suite.specs)) reject('specs must be an array.');
        if (!Object.prototype.hasOwnProperty.call(EXPECTED, file)) reject('unexpected test file: ' + (file || '(missing)') + '.');
        for (const spec of suite.specs) {
          if (!spec || typeof spec.title !== 'string' || !spec.title.trim()) reject('spec entry is malformed.');
          const key = file + '::' + spec.title;
          if (titles.has(key)) reject('duplicate spec entry: ' + key + '.');
          titles.add(key);
          if (!Array.isArray(spec.tests) || spec.tests.length !== 1) reject('each spec must map to exactly one project test.');
          const t = spec.tests[0];
          if (!t || typeof t.projectName !== 'string') reject('test project is malformed.');
          if (!Object.prototype.hasOwnProperty.call(EXPECTED[file], t.projectName)) reject('unexpected project ' + t.projectName + ' for ' + file + '.');
          if (t.expectedStatus !== 'passed' || !Array.isArray(t.results) || t.results.length !== 1 || !t.results[0] || t.results[0].status !== 'passed') reject('test did not pass exactly once without retries: ' + key + '.');
          if (!counts[file]) counts[file] = Object.create(null);
          counts[file][t.projectName] = (counts[file][t.projectName] || 0) + 1;
        }
      }
      if (suite.suites !== undefined) {
        if (!Array.isArray(suite.suites)) reject('nested suites must be an array.');
        visit(suite.suites, file);
      }
    }
  }
  visit(report.suites, '');
  for (const [file, expectedProjects] of Object.entries(EXPECTED)) {
    const actual = counts[file] || Object.create(null);
    for (const project of new Set([...Object.keys(expectedProjects), ...Object.keys(actual)])) {
      if ((actual[project] || 0) !== (expectedProjects[project] || 0)) reject(file + ' expected ' + (expectedProjects[project] || 0) + ' ' + project + ' tests; found ' + (actual[project] || 0) + '.');
    }
  }
  const projects = { chromium: 0, api: 0, unit: 0 };
  for (const perFile of Object.values(counts)) for (const [project, count] of Object.entries(perFile)) projects[project] += count;
  if (Object.values(projects).reduce((a, b) => a + b, 0) !== 7) reject('suite distribution must total 7 tests.');
  return { expected: 7, skipped: 0, unexpected: 0, flaky: 0, projects, conclusion: 'passed' };
}
function readReport(file) {
  if (!file || !fs.existsSync(file)) reject('report file is missing.');
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size === 0) reject('report file is empty or not a regular file.');
  let report;
  try { report = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { reject('report JSON is malformed: ' + e.message); }
  return { report, summary: summarizeReport(report) };
}
function main() {
  const file = path.resolve(process.argv[2] || path.join(process.cwd(), 'artifacts', 'all-results.json'));
  console.log('Playwright quality gate: ' + JSON.stringify(readReport(file).summary));
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { EXPECTED, summarizeReport, readReport };
