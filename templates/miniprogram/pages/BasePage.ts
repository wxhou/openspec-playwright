// BasePage — shared selectors and state helpers for mini-program page objects.
// Tool-owned: `openspec-pw update` overwrites this file; extend it in
// tests/playwright/pages/<PageName>.ts instead.

import { type FrameLocator, type Locator } from '@playwright/test';
import type { MiniProgram } from '@open-wxa/wxa-runner-playwright';
import { expect } from '../wxa-test';

export class BasePage {
  protected miniProgram: MiniProgram;

  constructor(miniProgram: MiniProgram) {
    this.miniProgram = miniProgram;
  }

  /** The current page's frame; follows navigation automatically. */
  get current(): FrameLocator {
    return this.miniProgram.current;
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  /** Open a page, e.g. `pages/detail/detail?id=1`. Defaults to the home page. */
  async open(pagePath?: string) {
    await this.miniProgram.open(pagePath);
  }

  async waitForPage(pagePath: string, timeout?: number) {
    await this.miniProgram.waitForPage(pagePath, timeout);
  }

  // ─── Page state ────────────────────────────────────────────────────────────

  async pageData(pagePath?: string): Promise<Awaited<ReturnType<MiniProgram['pageData']>>> {
    return this.miniProgram.pageData(pagePath);
  }

  async errors(): Promise<Awaited<ReturnType<MiniProgram['errors']>>> {
    return this.miniProgram.errors();
  }

  async requests(pattern?: string): Promise<Awaited<ReturnType<MiniProgram['requests']>>> {
    return this.miniProgram.requests(pattern);
  }

  // ─── Selector helpers — use in priority order ──────────────────────────────

  byRole(
    role: Parameters<FrameLocator['getByRole']>[0],
    options?: { name?: string | RegExp; exact?: boolean },
  ): Locator {
    return this.current.getByRole(role, options);
  }

  byLabel(label: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.current.getByLabel(label, options);
  }

  byText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.current.getByText(text, options);
  }

  byTestId(id: string): Locator {
    return this.current.getByTestId(id);
  }

  locator(selector: string): Locator {
    return this.current.locator(selector);
  }

  // ─── Safe interactions ──────────────────────────────────────────────────────

  async click(selector: Locator | string, options?: Parameters<Locator['click']>[0]) {
    const el = typeof selector === 'string' ? this.locator(selector) : selector;
    await el.scrollIntoViewIfNeeded();
    await el.click(options);
  }

  async fill(selector: Locator | string, value: string) {
    const el = typeof selector === 'string' ? this.locator(selector) : selector;
    await el.scrollIntoViewIfNeeded();
    await el.fill(value);
    await el.blur();
  }

  async fillAndVerify(selector: Locator | string, value: string) {
    await this.fill(selector, value);
    const el = typeof selector === 'string' ? this.locator(selector) : selector;
    await expect(el).toHaveValue(value);
  }

  // ─── Assertion shortcuts ───────────────────────────────────────────────────

  /** Assert the current page path; retries until the timeout. */
  async expectPath(pagePath: string, timeout?: number) {
    await expect(this.miniProgram).toHavePath(pagePath, { timeout });
  }

  /** Assert the current page data contains the given fields; retries. */
  async expectPageData(data: Record<string, unknown>, options?: { path?: string; timeout?: number }) {
    await expect(this.miniProgram).toHavePageData(data, options);
  }
}
