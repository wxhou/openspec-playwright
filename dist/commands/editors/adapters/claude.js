/**
 * Claude Code adapter: `.claude/commands/opsx/<id>.md` with full
 * frontmatter; reads CLAUDE.md directly (thin wrapper installed by
 * project-rules). Playwright MCP installs at project scope — written to
 * the project-root `.mcp.json` via `claude mcp add --scope project`.
 */
import { existsSync, readFileSync } from "fs";
import { execFileSync } from "node:child_process";
import { join } from "path";
import { TIMEOUT } from "../../../shared/constants.js";
import { needsShell } from "../../../shared/platform.js";
import { defineAdapter } from "../types.js";
import { escapeYamlValue } from "../shared.js";
import { registerAdapter } from "../registry.js";
import { installedAgentsSnapshotDir, loadAgentSnapshots } from "../agents.js";
// ─── Claude Code adapter ─────────────────────────────────────────────────
export function formatClaudeCommand(meta) {
    // Claude Code consumes `description` and `argument-hint`; name/category/tags
    // are ignored there and only made the frontmatter noisier.
    return `---
description: ${escapeYamlValue(meta.description)}
argument-hint: "<change-name|all>"
---

${meta.body}
`;
}
export function getClaudeCommandPath(id) {
    return join(".claude", "commands", "opsx", `${id}.md`);
}
export function hasClaudeCode(projectRoot) {
    return existsSync(join(projectRoot, ".claude"));
}
export const claudeAdapter = defineAdapter({
    id: "claude",
    label: "claude",
    displayName: "Claude Code",
    detect: hasClaudeCode,
    commandFilePath: getClaudeCommandPath,
    formatCommand: formatClaudeCommand,
    // Claude Code reads CLAUDE.md directly — override the AGENTS.md default.
    projectRulesPath: (root) => join(root, "CLAUDE.md"),
    isMcpInstalled(root, serverName) {
        // Project scope: Playwright MCP lives in the project-root .mcp.json.
        // Read the file directly instead of `claude mcp list` — zero CLI
        // dependency, testable, and never confuses a global user-scope entry
        // with a project-scoped one.
        try {
            const mcpJson = readFileSync(join(root, ".mcp.json"), "utf-8");
            const parsed = JSON.parse(mcpJson);
            return (typeof parsed === "object" &&
                parsed !== null &&
                typeof parsed.mcpServers === "object" &&
                parsed.mcpServers !== null &&
                Object.hasOwn(parsed.mcpServers, serverName));
        }
        catch {
            // Missing or unparseable file — server not installed
            return false;
        }
    },
    installMcp(_root, serverName, command) {
        execFileSync("claude", ["mcp", "add", "--scope", "project", serverName, ...command], {
            encoding: "utf-8",
            timeout: TIMEOUT.MCP_LIST,
            stdio: ["pipe", "pipe", "pipe"],
            shell: needsShell,
        });
    },
    removeMcp(_root, serverName) {
        execFileSync("claude", ["mcp", "remove", "--scope", "project", serverName], {
            encoding: "utf-8",
            timeout: TIMEOUT.MCP_LIST,
            stdio: ["pipe", "pipe", "pipe"],
            shell: needsShell,
        });
    },
    // Vendored official Playwright agents (init --agents). Read lazily from
    // the installed package templates; byte-identity with the official
    // init-agents output is load-bearing (content-based ownership), so the
    // files are shipped and written unmodified.
    optionalArtifacts: (install) => (install ? loadAgentSnapshots(installedAgentsSnapshotDir()) : []),
});
registerAdapter(claudeAdapter);
//# sourceMappingURL=claude.js.map