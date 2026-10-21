const fs = require('node:fs');
const path = require('node:path');
const { Module } = require('node:module');
const { test, expect } = require('../../src/fixtures/test.fixture');

function loadApplicationDateRanges() {
  const appRoot = process.env.PORTFOLIO_APP_ROOT;
  if (!appRoot) {
    throw new Error('PORTFOLIO_APP_ROOT must point to the pinned, read-only application checkout.');
  }

  const sourcePath = path.join(appRoot, 'lib', 'date-ranges.ts');
  const typescriptPath = path.join(appRoot, 'node_modules', 'typescript');
  if (!fs.existsSync(sourcePath)) throw new Error('Application date-ranges.ts was not found.');
  if (!fs.existsSync(typescriptPath)) throw new Error('Application TypeScript dependency was not installed with npm ci.');

  const typescript = require(typescriptPath);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const result = typescript.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  });
  const errors = (result.diagnostics || []).filter(
    (diagnostic) => diagnostic.category === typescript.DiagnosticCategory.Error,
  );
  if (errors.length) {
    const messages = errors.map((diagnostic) =>
      typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    );
    throw new Error('Application TypeScript transform failed: ' + messages.join('\n'));
  }

  const loaded = new Module(sourcePath, module);
  loaded.filename = sourcePath;
  loaded.paths = Module._nodeModulePaths(path.dirname(sourcePath));
  loaded._compile(result.outputText, sourcePath);
  return loaded.exports;
}

const dateRanges = loadApplicationDateRanges();

test('formats a calendar month and year in a stable UTC label', async () => {
  expect(dateRanges.formatMonthYear({ month: 1, year: 2024 })).toBe('Jan 2024');
});

test('formats the inclusive duration of an explicit range', async () => {
  expect(dateRanges.formatTimelineDuration({
    start: { month: 10, year: 2023 },
    end: { month: 3, year: 2025 },
  })).toBe('1 yr 6 mos');
});

test('formats the complete explicit timeline period', async () => {
  expect(dateRanges.formatTimelinePeriod({
    start: { month: 10, year: 2023 },
    end: { month: 3, year: 2025 },
  })).toBe('Oct 2023 – Mar 2025 · 1 yr 6 mos');
});