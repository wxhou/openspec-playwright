/** Check if the named MCP server is installed in this editor. */
export function isMcpInstalled(adapter, serverName) {
    return adapter.isMcpInstalled(process.cwd(), serverName);
}
/** Install an MCP server in this editor. Throws on failure. */
export function ensureMcp(adapter, serverName, command) {
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
const PLAYWRIGHT_MCP_COMMAND = ["npx", "@playwright/mcp@latest"];
export function isPlaywrightMcpInstalled(adapter) {
    return isMcpInstalled(adapter, "playwright");
}
export function ensurePlaywrightMcp(adapter) {
    ensureMcp(adapter, "playwright", PLAYWRIGHT_MCP_COMMAND);
}
export function removePlaywrightMcp(adapter) {
    removeMcp(adapter, "playwright");
}
//# sourceMappingURL=mcp.js.map