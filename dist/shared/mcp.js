/**
 * Shared MCP (Model Context Protocol) utilities.
 * Centralizes claude mcp check / install / remove logic.
 */
import { execFileSync } from "node:child_process";
import { TIMEOUT } from "./constants.js";
import { needsShell } from "./platform.js";
/**
 * Check if Playwright MCP server is installed in Claude Code.
 * Returns true if "playwright" appears in `claude mcp list` output.
 */
export function isPlaywrightMcpInstalled() {
    try {
        const output = execFileSync("claude", ["mcp", "list"], {
            encoding: "utf-8",
            timeout: TIMEOUT.MCP_LIST,
            stdio: ["pipe", "pipe", "pipe"],
            shell: needsShell,
        });
        return output.includes("playwright");
    }
    catch {
        // claude CLI not available or failed
        return false;
    }
}
/**
 * Ensure Playwright MCP server is installed globally.
 * Prints status messages. Throws on failure.
 */
export function ensurePlaywrightMcp() {
    if (isPlaywrightMcpInstalled()) {
        console.log("  ✓ Playwright MCP already installed");
        return;
    }
    try {
        execFileSync("claude", ["mcp", "add", "playwright", "npx", "@playwright/mcp@latest"], {
            encoding: "utf-8",
            timeout: TIMEOUT.MCP_LIST,
            stdio: ["pipe", "pipe", "pipe"],
            shell: needsShell,
        });
        console.log("  ✓ Playwright MCP installed globally");
    }
    catch {
        console.warn("  ⚠ Failed to install Playwright MCP");
        console.log("  Run manually: claude mcp add playwright npx @playwright/mcp@latest");
        throw new Error("MCP installation failed");
    }
}
/**
 * Remove Playwright MCP server from Claude Code.
 * Prints status messages. Does not throw if already absent.
 */
export function removePlaywrightMcp() {
    if (!isPlaywrightMcpInstalled()) {
        console.log("  ✓ Playwright MCP not installed (nothing to remove)");
        return;
    }
    try {
        execFileSync("claude", ["mcp", "remove", "playwright"], {
            encoding: "utf-8",
            timeout: TIMEOUT.MCP_LIST,
            stdio: ["pipe", "pipe", "pipe"],
            shell: needsShell,
        });
        console.log("  ✓ Playwright MCP removed");
    }
    catch {
        console.warn("  ⚠ Failed to remove Playwright MCP");
        console.log("  Run manually: claude mcp remove playwright");
    }
}
//# sourceMappingURL=mcp.js.map