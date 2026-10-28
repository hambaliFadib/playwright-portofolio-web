const { test, expect } = require('../../../src/fixtures/test.fixture');

test('homepage renders QA, Home navigation stays in QA, and the wordmark switches personas at Home', async ({ page, portfolioPage }) => {
  await portfolioPage.goto({ persona: 'qa', theme: 'dark' });

  await expect(page).toHaveTitle(/Hambali Fadib/);
  await expect(portfolioPage.heroHeading).toBeVisible();
  await expect(portfolioPage.primaryNavigation).toBeVisible();

  await portfolioPage.scrollToProjects();
  await portfolioPage.followHomeLink();
  await expect(page).toHaveURL(/#top$/);
  await expect(portfolioPage.wordmark).toHaveAttribute('aria-label', 'Switch to Full Stack Engineer');
  await expect(portfolioPage.heroHeading).toBeVisible();

  await portfolioPage.switchPersonaWithKey('Space');
  await page.waitForURL((url) => url.pathname === '/' && url.searchParams.get('persona') === 'fullstack' && url.searchParams.get('theme') === 'dark' && url.hash === '#top');
  await expect(portfolioPage.identitySurface).toHaveAttribute('aria-busy', 'false');
  await expect(portfolioPage.wordmark).toHaveAttribute('aria-label', 'Switch to QA Engineer');
  await expect(portfolioPage.fullStackRole).toBeVisible();
  await expect(portfolioPage.fullStackHeroHeading).toBeVisible();

  await portfolioPage.switchPersonaWithKey('Enter');
  await page.waitForURL((url) => url.pathname === '/' && url.searchParams.get('persona') === 'qa' && url.searchParams.get('theme') === 'dark' && url.hash === '#top');
  await expect(portfolioPage.identitySurface).toHaveAttribute('aria-busy', 'false');
  await expect(portfolioPage.wordmark).toHaveAttribute('aria-label', 'Switch to Full Stack Engineer');
  await expect(portfolioPage.heroHeading).toBeVisible();

  await page.goBack();
  await page.waitForURL((url) => url.searchParams.get('persona') === 'fullstack' && url.searchParams.get('theme') === 'dark' && url.hash === '#top');
  await expect(portfolioPage.identitySurface).toHaveAttribute('aria-busy', 'false');
  await expect(portfolioPage.fullStackHeroHeading).toBeVisible();

  await page.goForward();
  await page.waitForURL((url) => url.searchParams.get('persona') === 'qa' && url.searchParams.get('theme') === 'dark' && url.hash === '#top');
  await expect(portfolioPage.identitySurface).toHaveAttribute('aria-busy', 'false');
  await expect(portfolioPage.heroHeading).toBeVisible();
});
