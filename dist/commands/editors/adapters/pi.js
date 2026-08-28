/**
 * Pi adapter: prompt template at `.pi/prompts/opsx-<id>.md` (filename =
 * slash command). NO MCP client — `supportsMcp: false` makes shared MCP
 * phases skip it. Detected via `.pi/` or global `~/.pi/agent/`.
 */
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { defineAdapter } from "../types.js";
import { escapeYamlValue, transformToHyphenCommands } from "../shared.js";
import { registerAdapter } from "../registry.js";
// ─── Pi adapter ──────────────────────────────────────────────────────────
/**
 * Pi stores project resources in `.pi/` (skills/, prompts/, extensions/).
 * Prompt templates are Markdown with optional YAML frontmatter; the
 * filename becomes the slash command name (`opsx-e2e.md` → `/opsx-e2e`),
 * `description` feeds autocomplete, and `argument-hint` shows expected
 * arguments. `$1` / `$ARGUMENTS` placeholders expand at prompt time.
 *
 * Conventions follow the Pi docs (packages/coding-agent/docs):
 *   - Prompts:   `.pi/prompts/*.md`, invoked via `/name`.
 *   - Skills:    `.pi/skills/` (root `.md` files or `SKILL.md` dirs),
 *                invoked via `/skill:name`.
 *   - Rules:     Pi loads `AGENTS.md` (or `CLAUDE.md`) walking up from cwd
 *                natively — no wrapper file needed.
 *   - MCP:       Pi has NO MCP client (built-in tools only). The adapter
 *                still implements the interface with no-ops and declares
 *                `supportsMcp: false` so shared MCP phases skip it.
 */
export function formatPiCommand(meta) {
    const body = transformToHyphenCommands(meta.body);
    return `---
description: ${escapeYamlValue(meta.description)}
argument-hint: "<change-name>"
---

${body}
`;
}
export function getPiCommandPath(id) {
    return join(".pi", "prompts", `opsx-${id}.md`);
}
/**
 * True when Pi is in use: a project `.pi/` dir, or a global Pi config dir
 * (`~/.pi/agent/`, created by Pi on first run). The home signal lets
 * `openspec-pw init` detect Pi in a fresh project that has no `.pi/` yet.
 */
export function hasPi(projectRoot, homeDir = homedir()) {
    return (existsSync(join(projectRoot, ".pi")) ||
        existsSync(join(homeDir, ".pi", "agent")));
}
export const piAdapter = defineAdapter({
    id: "pi",
    label: "pi",
    displayName: "Pi",
    detect: hasPi,
    // Project-level signal only — global ~/.pi/agent is a pre-select
    // suggestion, never a write authorization.
    projectSignal: (projectRoot) => existsSync(join(projectRoot, ".pi")),
    // Pi has no MCP client — shared MCP phases skip this adapter.
    supportsMcp: false,
    commandFilePath: getPiCommandPath,
    formatCommand: formatPiCommand,
    // Pi loads AGENTS.md natively (walking up from cwd) — that's the default.
});
registerAdapter(piAdapter);
//# sourceMappingURL=pi.js.map