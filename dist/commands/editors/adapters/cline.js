/**
 * Cline adapter: `.cline/skills/opsx-<id>/SKILL.md` with name+description
 * frontmatter; MCP lives in `.cline/mcp.json`. Cline auto-detects
 * AGENTS.md as project rules — no wrapper file needed.
 */
import { existsSync } from "fs";
import { join } from "path";
import { defineAdapter } from "../types.js";
import { escapeYamlValue, transformToHyphenCommands, isMcpServerInFile, installMcpServerInFile, removeMcpServerFromFile, } from "../shared.js";
import { registerAdapter } from "../registry.js";
// ─── Cline adapter ───────────────────────────────────────────────────────
/**
 * Cline stores project-level config in `.cline/` (skills/, rules/, mcp.json).
 * `.clinerules/` is the legacy rules-only directory, still auto-detected.
 *
 * Conventions follow the Cline documentation (2026):
 *   - Skills:   `.cline/skills/<name>/SKILL.md` with YAML frontmatter
 *                (name + description). Triggered via `/<name>` slash command.
 *   - MCP:      `.cline/mcp.json` with `{ "mcpServers": { ... } }` structure.
 *   - Rules:    Cline auto-detects `AGENTS.md` — no wrapper file needed.
 */
export function formatClineCommand(meta) {
    const body = transformToHyphenCommands(meta.body);
    const skillName = `opsx-${meta.id}`;
    return `---
name: ${escapeYamlValue(skillName)}
description: ${escapeYamlValue(meta.description)}
---

${body}
`;
}
export function getClineCommandPath(id) {
    return join(".cline", "skills", `opsx-${id}`, "SKILL.md");
}
export function hasCline(projectRoot) {
    return (existsSync(join(projectRoot, ".cline")) ||
        existsSync(join(projectRoot, ".clinerules")));
}
export const clineAdapter = defineAdapter({
    id: "cline",
    label: "cline",
    displayName: "Cline",
    detect: hasCline,
    commandFilePath: getClineCommandPath,
    formatCommand: formatClineCommand,
    // Cline auto-detects AGENTS.md — that's the default.
    isMcpInstalled(projectRoot, serverName) {
        return isMcpServerInFile(clineMcpPath(projectRoot), serverName);
    },
    installMcp(projectRoot, serverName, command) {
        installMcpServerInFile(clineMcpPath(projectRoot), serverName, command);
    },
    removeMcp(projectRoot, serverName) {
        removeMcpServerFromFile(clineMcpPath(projectRoot), serverName);
    },
});
/** Path to the project-level MCP config file for Cline. */
function clineMcpPath(projectRoot) {
    return join(projectRoot, ".cline", "mcp.json");
}
registerAdapter(clineAdapter);
//# sourceMappingURL=cline.js.map