// BasePage — shared navigation and selector utilities for all page objects
// Extends this class in tests/playwright/pages/<PageName>.ts to build page objects
// Customize: add page-specific selectors as getters or methods

import { Page, Locator, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ─── Navigation ──────────────────────────────────────────────────────────────

  /**
   * Navigate to a path. Uses 'domcontentloaded' by default for speed.
   * Pass { waitUntil: 'networkidle' } for SPAs that fetch data on mount.
   */
  async goto(
    path: string,
    options?: { waitUntil?: 'domcontentloaded' | 'load' | 'networkidle' | 'commit' },
  ) {
    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    await this.page.goto(url, {
      waitUntil: options?.waitUntil ?? 'domcontentloaded',
    });
  }

  // ─── Selector helpers — use in priority order ───────────────────────────────

  /**
   * Best: data-testid survives style changes and text refactors.
   * Use when the dev team adds data-testid to elements.
   */
  byTestId(id: string): Locator {
    return this.page.getByTestId(id);
  }

  /**
   * Good: semantic role selectors survive DOM restructuring.
   * Use for buttons, links, form fields, dialogs.
   */
  byRole(role: Parameters<typeof this.page.getByRole>[0], options?: { name?: string | RegExp; exact?: boolean }): Locator {
    return this.page.getByRole(role, options);
  }

  /**
   * Good: label selectors are stable for form fields.
   * Use for inputs, selects, textareas with visible labels.
   */
  byLabel(label: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.page.getByLabel(label, options);
  }

  /**
   * Okay: text selectors are visible to users but may break on copy changes.
   * Use for assertions, not interactions.
   */
  byText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.page.getByText(text, options);
  }

  /**
   * Fallback: placeholder text. Stable for form inputs.
   */
  byPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.page.getByPlaceholder(text, options);
  }

  // ─── Safe interactions ──────────────────────────────────────────────────────

  /**
   * Click with automatic scroll-into-view. Prevents "element not interactable" errors.
   */
  async click(selector: Locator | string, options?: Parameters<Locator['click']>[0]) {
    const el = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await el.scrollIntoViewIfNeeded();
    await el.click(options);
  }

  /**
   * Fill with automatic scroll-into-view. Clears existing value first.
   */
  async fill(selector: Locator | string, value: string) {
    const el = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await el.scrollIntoViewIfNeeded();
    await el.fill(value);
  }

  /**
   * Type with character-by-character input. Triggers keydown/keyup events.
   * Use for editors and inputs that listen to keystroke events.
   */
  async type(selector: Locator | string, text: string) {
    const el = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await el.scrollIntoViewIfNeeded();
    await el.click();
    await this.page.keyboard.type(text);
  }

  // ─── Wait utilities ─────────────────────────────────────────────────────────

  /**
   * Wait for a toast / snackbar / alert message to appear and optionally assert its text.
   */
  async waitForToast(text?: string | RegExp, timeout = 5000): Promise<Locator> {
    const toast = text
      ? this.page.getByText(text, { exact: false }).last()
      : this.page.locator('[role="alert"], .toast, .snackbar, [aria-live="polite"]').last();
    await toast.waitFor({ state: 'visible', timeout });
    return toast;
  }

  /**
   * Wait for a spinner / loading indicator to disappear.
   * Call after navigation or async actions.
   * Times out silently — callers should add their own assertion if needed.
   */
  async waitForLoad(spinnerSelector = '[role="progressbar"], .spinner, .loading', timeout = 10000) {
    const spinner = this.page.locator(spinnerSelector);
    if (await spinner.isVisible().catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout }).catch(() => {
        // Spinner did not disappear within timeout — caller should assert if needed
      });
    }
  }

  /**
   * Wait for URL to match a pattern. Use after redirects or navigation clicks.
   */
  async waitForURL(pattern: string | RegExp, timeout = 10000) {
    await this.page.waitForURL(pattern, { timeout });
  }

  // ─── Assertion shortcuts ───────────────────────────────────────────────────

  /**
   * Assert current URL matches pattern (after navigation or redirect).
   */
  async expectURL(pattern: string | RegExp) {
    await expect(this.page).toHaveURL(pattern);
  }

  /**
   * Assert page displays specific text.
   * Note: exact option only applies to string text; RegExp is always partial match.
   */
  async expectText(text: string | RegExp) {
    await expect(this.page.getByText(text)).toBeVisible();
  }

  // ─── Auth helpers ──────────────────────────────────────────────────────────

  /**
   * Assert user is on a guest (login) page.
   * Use after logout or to verify auth guard redirects correctly.
   */
  async expectGuest() {
    await expect(this.page.getByRole('button', { name: /login|sign in|登录/i })).toBeVisible();
  }

  /**
   * Reload page and wait for hydration (for SPAs).
   */
  async reload(waitFor = 'domcontentloaded') {
    await this.page.reload({ waitUntil: waitFor as 'domcontentloaded' });
  }
}
