const base = require('@playwright/test');
const { PortfolioPage } = require('../pages/PortfolioPage');

const test = base.test.extend({
  portfolioPage: async ({ page }, use) => {
    await use(new PortfolioPage(page));
  },
});

module.exports = { test, expect: base.expect };