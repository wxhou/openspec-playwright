/**
 * Cursor adapter: slash command at `.cursor/commands/opsx-<id>.md` (plain
 * markdown) plus an Agent Skill at `.cursor/skills/opsx-<id>/SKILL.md`;
 * MCP lives in `.cursor/mcp.json`. Cursor auto-detects AGENTS.md.
 */
import { join } from "path";
import { defineAdapter } from "../declaration.js";
import { formatArtifact } from "../shared.js";
import { registerAdapter } from "../registry.js";
// ─── Cursor adapter (format / paths) ─────────────────────────────────────
export function getCursorCommandPath(id) {
    return join(".cursor", "commands", `opsx-${id}.md`);
}
export function getCursorSkillPath(id) {
    return join(".cursor", "skills", `opsx-${id}`, "SKILL.md");
}
/**
 * Cursor slash commands are plain markdown (no frontmatter); the filename
 * is the command name. `$1` is the change-name argument.
 */
const CURSOR_COMMAND = {
    path: getCursorCommandPath,
    naming: "hyphen-prefix",
    header: (meta) => `<!-- Change name: $1 (e.g. /opsx-${meta.id} my-change) -->`,
};
/**
 * Cursor Agent Skill — explicit invocation only (`disable-model-invocation`).
 * No `$1` placeholders (those belong to the slash command file).
 */
const CURSOR_SKILL = {
    path: getCursorSkillPath,
    naming: "hyphen-prefix",
    frontmatter: {
        name: true,
        description: true,
        disableModelInvocation: true,
    },
};
const cursorDeclaration = {
    id: "cursor",
    label: "cursor",
    displayName: "Cursor",
    artifacts: [CURSOR_COMMAND, CURSOR_SKILL],
    detection: {
        projectPaths: [".cursor"],
        intentPaths: [".cursorrules"],
    },
    mcp: {
        kind: "mcp-servers-file",
        path: (root) => join(root, ".cursor", "mcp.json"),
    },
    // Cursor auto-detects AGENTS.md — that's the default rules path.
};
export const cursorAdapter = defineAdapter(cursorDeclaration);
// ─── Named exports (derived from the declaration) ────────────────────────
export function formatCursorCommand(meta) {
    return formatArtifact(CURSOR_COMMAND, meta);
}
export function formatCursorSkill(meta) {
    return formatArtifact(CURSOR_SKILL, meta);
}
export function hasCursor(projectRoot, homeDir) {
    return cursorAdapter.detect(projectRoot, homeDir);
}
registerAdapter(cursorAdapter);
//# sourceMappingURL=cursor.js.map