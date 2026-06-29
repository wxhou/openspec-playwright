/**
 * Shared MCP (Model Context Protocol) utilities.
 *
 * Dispatches Playwright MCP install/remove to the right editor adapter.
 * Each adapter handles its own install mechanism (`claude mcp add` vs
 * editing `opencode.jsonc`), so this layer just routes the call and
 * prints status messages.
 */
import { type EditorAdapter } from "../commands/editors.js";

/** Check if the named MCP server is installed in this editor. */
export function isMcpInstalled(adapter: EditorAdapter, serverName: string): boolean {
  return adapter.isMcpInstalled(process.cwd(), serverName);
}

/** Install an MCP server in this editor. Throws on failure. */
export function ensureMcp(
  adapter: EditorAdapter,
  serverName: string,
  command: string[],
): void {
  if (isMcpInstalled(adapter, serverName)) {
    console.log(`  ✓ ${adapter.label}: ${serverName} MCP already installed`);
    return;
  }
  try {
    adapter.installMcp(process.cwd(), serverName, command);
    console.log(`  ✓ ${adapter.label}: ${serverName} MCP installed`);
  } catch (err) {
    console.warn(`  ⚠ ${adapter.label}: failed to install ${serverName} MCP`);
    throw err;
  }
}

/** Remove an MCP server from this editor. Does not throw if missing. */
export function removeMcp(adapter: EditorAdapter, serverName: string): void {
  if (!isMcpInstalled(adapter, serverName)) {
    console.log(`  - ${adapter.label}: ${serverName} MCP not installed (nothing to remove)`);
    return;
  }
  try {
    adapter.removeMcp(process.cwd(), serverName);
    console.log(`  ✓ ${adapter.label}: ${serverName} MCP removed`);
  } catch {
    console.warn(`  ⚠ ${adapter.label}: failed to remove ${serverName} MCP`);
  }
}

// ─── Playwright MCP conveniences ────────────────────────────────────────

const PLAYWRIGHT_MCP_COMMAND = ["npx", "@playwright/mcp@latest"];

export function isPlaywrightMcpInstalled(adapter: EditorAdapter): boolean {
  return isMcpInstalled(adapter, "playwright");
}

export function ensurePlaywrightMcp(adapter: EditorAdapter): void {
  ensureMcp(adapter, "playwright", PLAYWRIGHT_MCP_COMMAND);
}

export function removePlaywrightMcp(adapter: EditorAdapter): void {
  removeMcp(adapter, "playwright");
}
