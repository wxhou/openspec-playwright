/**
 * Shared constants for openspec-playwright CLI.
 */

/** Template files that ship with the package (not user specs). */
export const SHARED_FILE_NAMES = new Set([
  "seed.spec.ts",
  "app-all.spec.ts",
  "auth.setup.ts",
  "credentials.yaml",
  "app-knowledge.md",
  "playwright.config.ts",
  "mcp-tools.md",
]);

/** Timeout values in milliseconds. */
export const TIMEOUT = {
  /** claude mcp list / add / remove */
  MCP_LIST: 10_000,
  /** openspec list --json */
  OPENSPEC_LIST: 30_000,
  /** npm pack */
  NPM_PACK: 30_000,
  /** Playwright page.goto() */
  NAVIGATION: 30_000,
  /** Playwright browser launch */
  BROWSER_LAUNCH: 60_000,
} as const;
