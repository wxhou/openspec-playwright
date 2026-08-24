/**
 * Cursor adapter: slash command at `.cursor/commands/opsx-<id>.md` (plain
 * markdown) plus an Agent Skill at `.cursor/skills/opsx-<id>/SKILL.md`;
 * MCP lives in `.cursor/mcp.json`. Cursor auto-detects AGENTS.md.
 */
import { existsSync } from "fs";
import { join } from "path";
import { defineAdapter } from "../types.js";
import { escapeYamlValue, transformToHyphenCommands, isMcpServerInFile, installMcpServerInFile, removeMcpServerFromFile, } from "../shared.js";
import { registerAdapter } from "../registry.js";
// ─── Cursor adapter (format / paths) ─────────────────────────────────────
/**
 * Cursor slash commands are plain markdown (no frontmatter); the filename
 * is the command name. `$1` is the change-name argument.
 */
export function formatCursorCommand(meta) {
    const body = transformToHyphenCommands(meta.body);
    return `<!-- Change name: $1 (e.g. /opsx-${meta.id} my-change) -->

${body}
`;
}
export function getCursorCommandPath(id) {
    return join(".cursor", "commands", `opsx-${id}.md`);
}
export function getCursorSkillPath(id) {
    return join(".cursor", "skills", `opsx-${id}`, "SKILL.md");
}
/**
 * Cursor Agent Skill — explicit invocation only (`disable-model-invocation`).
 * No `$1` placeholders (those belong to the slash command file).
 */
export function formatCursorSkill(meta) {
    const body = transformToHyphenCommands(meta.body);
    const skillName = `opsx-${meta.id}`;
    return `---
name: ${escapeYamlValue(skillName)}
description: ${escapeYamlValue(meta.description)}
disable-model-invocation: true
---

${body}
`;
}
export function hasCursor(projectRoot) {
    return existsSync(join(projectRoot, ".cursor"));
}
export const cursorAdapter = defineAdapter({
    id: "cursor",
    label: "cursor",
    displayName: "Cursor",
    detect: hasCursor,
    commandFilePath: getCursorCommandPath,
    formatCommand: formatCursorCommand,
    // Cursor auto-detects AGENTS.md — that's the default.
    isMcpInstalled(projectRoot, serverName) {
        return isMcpServerInFile(cursorMcpPath(projectRoot), serverName);
    },
    installMcp(projectRoot, serverName, command) {
        installMcpServerInFile(cursorMcpPath(projectRoot), serverName, command);
    },
    removeMcp(projectRoot, serverName) {
        removeMcpServerFromFile(cursorMcpPath(projectRoot), serverName);
    },
    extraArtifacts(meta) {
        return [
            {
                relativePath: getCursorSkillPath(meta.id),
                contents: formatCursorSkill(meta),
            },
        ];
    },
});
/** Path to the project-level MCP config file for Cursor. */
function cursorMcpPath(projectRoot) {
    return join(projectRoot, ".cursor", "mcp.json");
}
registerAdapter(cursorAdapter);
//# sourceMappingURL=cursor.js.map