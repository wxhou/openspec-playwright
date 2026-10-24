/**
 * MiniMax Code adapter: `.agents/skills/opsx-<id>/SKILL.md` with
 * name+description frontmatter; MCP lives in the project-root `.mcp.json`.
 *
 * MiniMax Code (`mcode`) loads no user-defined command files — the only
 * user-extensible command mechanism it has is Skills, which appear alongside
 * its native slash commands and are invoked as `/<name>`. It reads skills
 * from several workspace roots, `.agents/skills` among them, so the skill
 * lands there.
 *
 * Project rules: MiniMax Code resolves `<workspace>/CLAUDE.md` first and
 * `<workspace>/AGENTS.md` second, so AGENTS.md stays the single source of
 * truth and no MiniMax-specific wrapper file is created.
 */
import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { defineAdapter } from "../types.js";
import { formatSkillCommand, isMcpServerInFile, installMcpServerInFile, removeMcpServerFromFile, } from "../shared.js";
import { registerAdapter } from "../registry.js";
// ─── MiniMax Code adapter ────────────────────────────────────────────────
/**
 * MiniMax Code conventions (verified against the published CLI runtime):
 *   - Skills:   `<root>/skills/<name>/SKILL.md` with YAML frontmatter
 *                (name + description). Workspace roots include
 *                `.minimax/skills`, `.claude/skills` and `.agents/skills`.
 *                Invoked as `/<name>`.
 *   - MCP:      project-root `.mcp.json`, auto-loaded from the workspace.
 *   - Rules:    `<workspace>/CLAUDE.md` then `<workspace>/AGENTS.md`.
 */
export function formatMinimaxSkill(meta) {
    return formatSkillCommand(meta);
}
export function getMinimaxSkillPath(id) {
    return join(".agents", "skills", `opsx-${id}`, "SKILL.md");
}
/**
 * True when the project carries an openspec-pw MiniMax Code skill.
 *
 * The artifact is a detection signal in its own right: Cline's marker dir
 * `.cline/` contains its skill path, so Cline's artifact implies its marker
 * dir — but `.agents/` does not contain `.minimax/`. Without this signal a
 * project holding only the installed skill would be invisible to
 * `detectAdapters()` and drop out of doctor's command hint, the interactive
 * pre-select and the non-TTY fallback.
 *
 * Any `opsx-*` skill counts, not only today's command: the skill directory
 * is named after the command id, so a second command must not need a second
 * detection rule. `opsx-` is the tool's own skill namespace.
 */
function hasMinimaxSkill(projectRoot) {
    const skillsRoot = join(projectRoot, ".agents", "skills");
    let entries;
    try {
        entries = readdirSync(skillsRoot, { withFileTypes: true });
    }
    catch {
        // no skills dir (or unreadable) — nothing installed
        return false;
    }
    return entries.some((entry) => entry.isDirectory() &&
        entry.name.startsWith("opsx-") &&
        existsSync(join(skillsRoot, entry.name, "SKILL.md")));
}
/**
 * Detection: the project's `.minimax/` marker dir, the global CLI install
 * root, or the installed skill artifact.
 *
 * The global signal is a pre-select hint only — `projectSignal` excludes it.
 */
export function hasMinimax(projectRoot, homeDir) {
    const home = homeDir ?? homedir();
    return (existsSync(join(projectRoot, ".minimax")) ||
        existsSync(join(home, ".minimax-code")) ||
        hasMinimaxSkill(projectRoot));
}
/** Project-level signal only: marker dir or the installed skill. */
export function hasMinimaxProjectSignal(projectRoot) {
    return (existsSync(join(projectRoot, ".minimax")) || hasMinimaxSkill(projectRoot));
}
export const minimaxAdapter = defineAdapter({
    id: "minimax",
    label: "minimax",
    displayName: "MiniMax Code",
    detect: hasMinimax,
    projectSignal: hasMinimaxProjectSignal,
    commandFilePath: getMinimaxSkillPath,
    formatCommand: formatMinimaxSkill,
    // MiniMax Code reads AGENTS.md natively — that's the default.
    isMcpInstalled(projectRoot, serverName) {
        return isMcpServerInFile(minimaxMcpPath(projectRoot), serverName);
    },
    installMcp(projectRoot, serverName, command) {
        installMcpServerInFile(minimaxMcpPath(projectRoot), serverName, command);
    },
    removeMcp(projectRoot, serverName) {
        removeMcpServerFromFile(minimaxMcpPath(projectRoot), serverName);
    },
    mcpConfigPath: minimaxMcpPath,
});
/**
 * Path to the MCP config file MiniMax Code loads from the project workspace.
 * Shared with the Claude Code and CodeBuddy CLI adapters — all three read
 * and write the project-root `.mcp.json`.
 */
export function minimaxMcpPath(projectRoot) {
    return join(projectRoot, ".mcp.json");
}
registerAdapter(minimaxAdapter);
//# sourceMappingURL=minimax.js.map