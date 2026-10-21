const { test, expect } = require('../../../src/fixtures/test.fixture');

test('homepage renders the hero and its home navigation returns to the top anchor', async ({ page, portfolioPage }) => {
  await portfolioPage.goto();

  await expect(page).toHaveTitle(/Hambali Fadib/);
  await expect(portfolioPage.heroHeading).toBeVisible();
  await expect(portfolioPage.primaryNavigation).toBeVisible();

  await portfolioPage.followHomeLink();

  await expect(page).toHaveURL(/#top$/);
  await expect(portfolioPage.heroHeading).toBeVisible();
});