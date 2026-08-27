/** Check if the named MCP server is installed in this editor. */
export function isMcpInstalled(adapter, serverName) {
    if (adapter.supportsMcp === false)
        return false;
    return adapter.isMcpInstalled(process.cwd(), serverName);
}
/** Install an MCP server in this editor. Throws on failure. */
export function ensureMcp(adapter, serverName, command) {
    if (adapter.supportsMcp === false) {
        console.log(`  - ${adapter.label}: ${serverName} MCP not supported (no MCP client; use "openspec-pw explore" for browser exploration)`);
        return;
    }
    if (isMcpInstalled(adapter, serverName)) {
        console.log(`  ✓ ${adapter.label}: ${serverName} MCP already installed`);
        return;
    }
    try {
        adapter.installMcp(process.cwd(), serverName, command);
        console.log(`  ✓ ${adapter.label}: ${serverName} MCP installed`);
    }
    catch (err) {
        console.warn(`  ⚠ ${adapter.label}: failed to install ${serverName} MCP`);
        throw err;
    }
}
/** Remove an MCP server from this editor. Does not throw if missing. */
export function removeMcp(adapter, serverName) {
    if (adapter.supportsMcp === false) {
        console.log(`  - ${adapter.label}: ${serverName} MCP not supported (nothing to remove)`);
        return;
    }
    if (!isMcpInstalled(adapter, serverName)) {
        console.log(`  - ${adapter.label}: ${serverName} MCP not installed (nothing to remove)`);
        return;
    }
    try {
        adapter.removeMcp(process.cwd(), serverName);
        console.log(`  ✓ ${adapter.label}: ${serverName} MCP removed`);
    }
    catch {
        console.warn(`  ⚠ ${adapter.label}: failed to remove ${serverName} MCP`);
    }
}
// ─── Playwright MCP conveniences ────────────────────────────────────────
/** Official test-runner MCP server — bundled `playwright` CLI subcommand. */
export const TEST_RUNNER_MCP_SERVER = "playwright-test";
const TEST_RUNNER_MCP_COMMAND = ["npx", "playwright", "run-test-mcp-server"];
// Kept for backward compatibility with projects that still have a
// legacy `@playwright/mcp` entry from older openspec-pw versions — uninstall
// uses this to clean the stale entry out of the project's mcp config.
export function removePlaywrightMcp(adapter) {
    removeMcp(adapter, "playwright");
}
export function isTestRunnerMcpInstalled(adapter) {
    return isMcpInstalled(adapter, TEST_RUNNER_MCP_SERVER);
}
export function ensureTestRunnerMcp(adapter) {
    ensureMcp(adapter, TEST_RUNNER_MCP_SERVER, TEST_RUNNER_MCP_COMMAND);
}
export function removeTestRunnerMcp(adapter) {
    removeMcp(adapter, TEST_RUNNER_MCP_SERVER);
}
//# sourceMappingURL=mcp.js.map