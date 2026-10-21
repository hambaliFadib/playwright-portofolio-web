const HERO_HEADLINE = 'Clarity before speed. Quality before release.';

class PortfolioPage {
  constructor(page) {
    this.page = page;
    this.heroHeading = page.getByRole('heading', { name: HERO_HEADLINE });
    this.primaryNavigation = page.getByRole('navigation', { name: 'Primary' });
    this.homeLink = page.getByRole('link', { name: 'Hambali Fadib — back to top' });
    this.themeToggle = page.getByRole('button', { name: /Switch to (light|dark) mode/ });
  }

  async goto({ initialTheme } = {}) {
    if (initialTheme) {
      if (!['dark', 'light'].includes(initialTheme)) {
        throw new Error('initialTheme must be dark or light.');
      }
      await this.page.addInitScript((theme) => {
        if (window.localStorage.getItem('theme') === null) {
          window.localStorage.setItem('theme', theme);
        }
      }, initialTheme);
    }
    await this.page.goto('/');
  }

  async reload() {
    await this.page.reload();
  }

  async followHomeLink() {
    await this.homeLink.click();
  }

  async toggleTheme() {
    await this.themeToggle.click();
  }

  async getThemeState() {
    return this.page.locator('html').evaluate((root) => {
      const scene = document.querySelector('svg[data-state][data-progress]');
      const rootTheme = root.classList.contains('light')
        ? 'light'
        : root.classList.contains('dark')
          ? 'dark'
          : null;

      return {
        rootTheme,
        storedTheme: window.localStorage.getItem('theme'),
        sceneState: scene?.getAttribute('data-state') || null,
      };
    });
  }
}

module.exports = { PortfolioPage };