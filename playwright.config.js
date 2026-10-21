const { defineConfig, devices } = require('@playwright/test');

const jsonReport = process.env.PLAYWRIGHT_JSON_REPORT || 'artifacts/playwright-results.json';

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  fullyParallel: false,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: jsonReport }],
  ],
  use: {
    baseURL: process.env.BASE_URL || undefined,
    actionTimeout: 10_000,
    navigationTimeout: 10_000,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testMatch: '**/e2e/**/*.spec.js',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium' },
    },
    {
      name: 'api',
      testMatch: '**/api/**/*.spec.js',
    },
    {
      name: 'unit',
      testMatch: '**/unit/**/*.spec.js',
    },
  ],
});