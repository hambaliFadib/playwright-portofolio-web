const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const suite = process.argv[2];
const projects = { api: 'api', unit: 'unit' };
if (!['api', 'unit', 'all'].includes(suite)) {
  console.error('Usage: node scripts/run-playwright-project.js api|unit|all');
  process.exit(2);
}

const root = process.cwd();
const outputName = suite + '-results.json';
const outputFile = path.join(root, 'artifacts', outputName);
fs.mkdirSync(path.dirname(outputFile), { recursive: true });

const args = ['playwright', 'test'];
if (projects[suite]) args.push('--project=' + projects[suite]);

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, args, {
  env: { ...process.env, PLAYWRIGHT_JSON_REPORT: outputFile },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status === null ? 1 : result.status);