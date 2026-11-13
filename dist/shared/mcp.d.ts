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
export declare function isMcpInstalled(adapter: EditorAdapter, projectRoot: string, serverName: string): boolean;
/** Install an MCP server in this editor. Throws on failure. */
export declare function ensureMcp(adapter: EditorAdapter, projectRoot: string, serverName: string, command: string[]): void;
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
export declare function removeMcp(adapter: EditorAdapter, projectRoot: string, serverName: string): McpRemovalResult;
/** Official test-runner MCP server — bundled `playwright` CLI subcommand. */
export declare const TEST_RUNNER_MCP_SERVER = "playwright-test";
export declare function removePlaywrightMcp(adapter: EditorAdapter, projectRoot: string): void;
export declare function isTestRunnerMcpInstalled(adapter: EditorAdapter, projectRoot: string): boolean;
export declare function ensureTestRunnerMcp(adapter: EditorAdapter, projectRoot: string): void;
export declare function removeTestRunnerMcp(adapter: EditorAdapter, projectRoot: string): void;
