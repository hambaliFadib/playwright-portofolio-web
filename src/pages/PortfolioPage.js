const HERO_HEADLINE = 'Clarity before speed. Quality before release.';
const FULLSTACK_HEADLINE = 'Thoughtful software. Built with intent.';

class PortfolioPage {
  constructor(page) {
    this.page = page;
    this.heroHeading = page.getByRole('heading', { name: HERO_HEADLINE });
    this.fullStackHeroHeading = page.getByRole('heading', { name: FULLSTACK_HEADLINE });
    this.fullStackRole = page.getByText('FULL STACK ENGINEER', { exact: true });
    this.primaryNavigation = page.getByRole('navigation', { name: 'Primary' });
    this.homeLink = page.getByRole('link', { name: 'Home', exact: true });
    this.projectsSection = page.locator('#projects');
    this.wordmark = page.getByRole('button', { name: /Switch to (Full Stack Engineer|QA Engineer)$/ });
    this.identitySurface = page.locator('#portfolio-identity');
    this.themeToggle = page.getByRole('button', { name: /Switch to (light|dark) mode/ });
  }

  async goto({ initialTheme, persona, theme } = {}) {
    if (initialTheme) {
      if (!['dark', 'light'].includes(initialTheme)) {
        throw new Error('initialTheme must be dark or light.');
      }
      // SSR derives its initial appearance from URL/cookie, not localStorage.
      // Use the URL contract for deterministic first render.
    }
    const query = [];
    if (persona) query.push(`persona=${encodeURIComponent(persona)}`);
    if (theme || initialTheme) query.push(`theme=${encodeURIComponent(theme || initialTheme)}`);
    await this.page.goto(query.length ? `/?${query.join('&')}` : '/');
  }

  async reload() {
    await this.page.reload();
  }

  async followHomeLink() {
    await this.homeLink.click();
  }

  async scrollToProjects() {
    await this.projectsSection.scrollIntoViewIfNeeded();
  }

  async switchPersona() {
    await this.wordmark.click();
  }

  async switchPersonaWithKey(key) {
    await this.wordmark.focus();
    await this.page.keyboard.press(key);
  }

  async toggleTheme() {
    await this.themeToggle.click();
  }

  async getThemeState() {
    return this.page.locator('html').evaluate((root) => {
      const rootTheme = root.classList.contains('light')
        ? 'light'
        : root.classList.contains('dark')
          ? 'dark'
          : null;

      return {
        rootTheme,
        storedTheme: window.localStorage.getItem('theme'),
        appearance: document.querySelector('#portfolio-identity')?.getAttribute('data-appearance') || null,
      };
    });
  }
}

module.exports = { PortfolioPage };
