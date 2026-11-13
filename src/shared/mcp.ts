/**
 * Shared MCP (Model Context Protocol) utilities.
 *
 * Dispatches Playwright MCP install/remove to the right editor adapter.
 * Each adapter handles its own install mechanism (`claude mcp add` vs
 * editing `opencode.jsonc`), so this layer just routes the call and
 * prints status messages.
 */
import { type EditorAdapter } from "../commands/editors.js";

/** Check if the named MCP server is installed in this editor for `projectRoot`. */
export function isMcpInstalled(
  adapter: EditorAdapter,
  projectRoot: string,
  serverName: string,
): boolean {
  if (adapter.supportsMcp === false) return false;
  return adapter.isMcpInstalled(projectRoot, serverName);
}

/** Install an MCP server in this editor. Throws on failure. */
export function ensureMcp(
  adapter: EditorAdapter,
  projectRoot: string,
  serverName: string,
  command: string[],
): void {
  if (adapter.supportsMcp === false) {
    console.log(
      `  - ${adapter.label}: ${serverName} MCP not supported (no MCP client; use "openspec-pw explore" for browser exploration)`,
    );
    return;
  }
  if (isMcpInstalled(adapter, projectRoot, serverName)) {
    console.log(`  ✓ ${adapter.label}: ${serverName} MCP already installed`);
    return;
  }
  try {
    adapter.installMcp(projectRoot, serverName, command);
    console.log(`  ✓ ${adapter.label}: ${serverName} MCP installed`);
  } catch (err) {
    console.warn(`  ⚠ ${adapter.label}: failed to install ${serverName} MCP`);
    throw err;
  }
}

export interface McpRemovalResult {
  /** True only when an entry was actually removed. */
  removed: boolean;
  /** Error thrown by the adapter when removal was attempted and failed. */
  error?: unknown;
}

/**
 * Remove an MCP server from this editor for `projectRoot`. Does not throw if
 * missing; returns `removed: true` only when an entry was actually removed.
 * A failed attempt carries the adapter error so callers can tell an
 * unwritable config from a logic failure.
 */
export function removeMcp(
  adapter: EditorAdapter,
  projectRoot: string,
  serverName: string,
): McpRemovalResult {
  if (adapter.supportsMcp === false) {
    console.log(`  - ${adapter.label}: ${serverName} MCP not supported (nothing to remove)`);
    return { removed: false };
  }
  if (!isMcpInstalled(adapter, projectRoot, serverName)) {
    console.log(`  - ${adapter.label}: ${serverName} MCP not installed (nothing to remove)`);
    return { removed: false };
  }
  try {
    adapter.removeMcp(projectRoot, serverName);
    console.log(`  ✓ ${adapter.label}: ${serverName} MCP removed`);
    return { removed: true };
  } catch (error) {
    console.warn(`  ⚠ ${adapter.label}: failed to remove ${serverName} MCP`);
    return { removed: false, error };
  }
}

// ─── Playwright MCP conveniences ────────────────────────────────────────

/** Official test-runner MCP server — bundled `playwright` CLI subcommand. */
export const TEST_RUNNER_MCP_SERVER = "playwright-test";
const TEST_RUNNER_MCP_COMMAND = ["npx", "playwright", "run-test-mcp-server"];

// Kept for backward compatibility with projects that still have a
// legacy `@playwright/mcp` entry from older openspec-pw versions — the
// remove command uses this to clean the stale entry out of the project's mcp config.
export function removePlaywrightMcp(adapter: EditorAdapter, projectRoot: string): void {
  removeMcp(adapter, projectRoot, "playwright");
}

export function isTestRunnerMcpInstalled(adapter: EditorAdapter, projectRoot: string): boolean {
  return isMcpInstalled(adapter, projectRoot, TEST_RUNNER_MCP_SERVER);
}

export function ensureTestRunnerMcp(adapter: EditorAdapter, projectRoot: string): void {
  ensureMcp(adapter, projectRoot, TEST_RUNNER_MCP_SERVER, TEST_RUNNER_MCP_COMMAND);
}

export function removeTestRunnerMcp(adapter: EditorAdapter, projectRoot: string): void {
  removeMcp(adapter, projectRoot, TEST_RUNNER_MCP_SERVER);
}
