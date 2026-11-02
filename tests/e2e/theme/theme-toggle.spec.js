const { test, expect } = require('../../../src/fixtures/test.fixture');

test('Dark to Light commits the theme and persists it after reload', async ({ portfolioPage }) => {
  await portfolioPage.goto();

  await expect(portfolioPage.heroHeading).toBeVisible();
  await expect.poll(() => portfolioPage.getThemeState()).toMatchObject({ rootTheme: 'dark' });

  await expect(portfolioPage.themeToggle).toHaveAccessibleName('Switch to light mode');
  await portfolioPage.toggleTheme();

  await expect.poll(() => portfolioPage.getThemeState()).toMatchObject({
    rootTheme: 'light',
    storedTheme: 'light',
    appearance: 'light',
  });

  await expect(portfolioPage.themeToggle).toHaveAccessibleName('Switch to dark mode');
  await portfolioPage.reload();

  await expect.poll(() => portfolioPage.getThemeState()).toMatchObject({
    rootTheme: 'light',
    storedTheme: 'light',
    appearance: 'light',
  });
});

test('Light to Dark commits the theme and persists it after reload', async ({ portfolioPage }) => {
  await portfolioPage.goto({ initialTheme: 'light' });

  await expect(portfolioPage.heroHeading).toBeVisible();
  // The URL controls the initial server render. localStorage is persisted only
  // after the user toggles appearance; a clean browser starts without that key.
  await expect.poll(() => portfolioPage.getThemeState()).toMatchObject({
    rootTheme: 'light',
    storedTheme: null,
    appearance: 'light',
  });

  await expect(portfolioPage.themeToggle).toHaveAccessibleName('Switch to dark mode');
  await portfolioPage.toggleTheme();

  await expect.poll(() => portfolioPage.getThemeState()).toMatchObject({
    rootTheme: 'dark',
    storedTheme: 'dark',
    appearance: 'dark',
  });

  await expect(portfolioPage.themeToggle).toHaveAccessibleName('Switch to light mode');
  await portfolioPage.reload();

  await expect.poll(() => portfolioPage.getThemeState()).toMatchObject({
    rootTheme: 'dark',
    storedTheme: 'dark',
    appearance: 'dark',
  });
});