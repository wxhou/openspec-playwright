// Seed test for Playwright Test Agents
// Copy this to tests/playwright/seed.spec.ts after running openspec-pw init
// Customize the page object and base URL for your application

import { test, expect, Page } from '@playwright/test';

// Customize these for your application
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Page Object Pattern - customize these selectors for your app
 */
class AppPage {
  constructor(private page: Page) {}

  async goto(path: string = '/') {
    await this.page.goto(`${BASE_URL}${path}`);
  }

  // Add your app's common selectors here
  // Example:
  // async getLoginButton() {
  //   return this.page.locator('button[data-testid="login"]');
  // }
}

/**
 * Helper to create a new page object
 */
function createPage(page: Page): AppPage {
  return new AppPage(page);
}

// ──────────────────────────────────────────────
// Below are example tests - customize for your app
// ──────────────────────────────────────────────

test.describe('Application smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    const app = createPage(page);
    await app.goto('/');
  });

  test('page loads successfully', async ({ page }) => {
    // Verify the page loads without errors
    await expect(page).not.toHaveURL(/.*error.*/);
  });

  test('no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await page.reload();
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
