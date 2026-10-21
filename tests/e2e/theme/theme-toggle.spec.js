const { test, expect } = require('../../../src/fixtures/test.fixture');

test('Dark to Light commits the theme and persists it after reload', async ({ portfolioPage }) => {
  await portfolioPage.goto();

  await expect(portfolioPage.heroHeading).toBeVisible();
  await expect.poll(() => portfolioPage.getThemeState()).toMatchObject({ rootTheme: 'dark' });

  await portfolioPage.toggleTheme();

  await expect.poll(() => portfolioPage.getThemeState()).toMatchObject({
    rootTheme: 'light',
    storedTheme: 'light',
    sceneState: 'idle',
  });

  await portfolioPage.reload();

  await expect.poll(() => portfolioPage.getThemeState()).toMatchObject({
    rootTheme: 'light',
    storedTheme: 'light',
  });
});

test('Light to Dark commits the theme and persists it after reload', async ({ portfolioPage }) => {
  await portfolioPage.goto({ initialTheme: 'light' });

  await expect(portfolioPage.heroHeading).toBeVisible();
  await expect.poll(() => portfolioPage.getThemeState()).toMatchObject({
    rootTheme: 'light',
    storedTheme: 'light',
  });

  await portfolioPage.toggleTheme();

  await expect.poll(() => portfolioPage.getThemeState()).toMatchObject({
    rootTheme: 'dark',
    storedTheme: 'dark',
    sceneState: 'idle',
  });

  await portfolioPage.reload();

  await expect.poll(() => portfolioPage.getThemeState()).toMatchObject({
    rootTheme: 'dark',
    storedTheme: 'dark',
  });
});