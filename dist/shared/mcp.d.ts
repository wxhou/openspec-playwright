/**
 * Check if Playwright MCP server is installed in Claude Code.
 * Returns true if "playwright" appears in `claude mcp list` output.
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
