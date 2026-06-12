/**
 * Check if Playwright MCP server is installed in Claude Code.
 * Returns true if "playwright" appears in `claude mcp list` output.
 *
 * Note: `claude mcp list` may exit non-zero if another MCP server is
 * pending approval or unhealthy, while still printing the list. In that
 * case, read stdout/stderr from the thrown error before returning false.
 */
export declare function isPlaywrightMcpInstalled(): boolean;
/**
 * Ensure Playwright MCP server is installed globally.
 * Prints status messages. Throws on failure.
 */
export declare function ensurePlaywrightMcp(): void;
/**
 * Remove Playwright MCP server from Claude Code.
 * Prints status messages. Does not throw if already absent.
 */
export declare function removePlaywrightMcp(): void;
