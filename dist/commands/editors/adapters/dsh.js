/**
 * DeepSeek Harness adapter: skill bundle at `.dsh/skills/opsx-<id>/SKILL.md`
 * (project-dsh root, rank 100). NO simple MCP file — cordis.yml plugin
 * config instead, so `supportsMcp: false`. Detected via `.dsh/` or
 * global `~/.dsh/` (DSH_HOME).
 */
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { defineAdapter } from "../types.js";
import { escapeYamlValue, transformToHyphenCommands } from "../shared.js";
import { registerAdapter } from "../registry.js";
// ─── DeepSeek Harness adapter ────────────────────────────────────────────
/**
 * DeepSeek Harness (dsh) stores project skills in `.dsh/skills/` — the
 * `project-dsh` local provider root, rank 100 (highest local priority).
 * Skills are directory bundles (`<name>/SKILL.md`) with YAML frontmatter
 * (name + description); the kebab-case name becomes the model-invocable
 * skill name (`opsx-e2e`).
 *
 * Conventions follow the dsh skills subsystem (docs/subsystems/skills.md):
 *   - Skills:   `.dsh/skills/<name>/SKILL.md`, invoked via the `skill` tool.
 *   - Rules:    dsh reads `AGENTS.md` / `CLAUDE.md` natively (default
 *               instructionFileCandidates) — no wrapper file needed.
 *   - MCP:      dsh configures MCP via `cordis.yml` plugin config
 *               (@deepseek-ai/dsh-mcp-client), not a simple mcpServers file —
 *               the adapter declares `supportsMcp: false` so shared MCP phases
 *               skip it (configure Playwright MCP manually in cordis.yml).
 *   - Detected via `.dsh/` or the global `~/.dsh/` (DSH_HOME).
 */
export function formatDshCommand(meta) {
    const body = transformToHyphenCommands(meta.body);
    const skillName = `opsx-${meta.id}`;
    return `---
name: ${escapeYamlValue(skillName)}
description: ${escapeYamlValue(meta.description)}
---

${body}
`;
}
export function getDshCommandPath(id) {
    return join(".dsh", "skills", `opsx-${id}`, "SKILL.md");
}
/**
 * True when DeepSeek Harness is in use: a project `.dsh/` dir, or the global
 * dsh home (`~/.dsh/`, DSH_HOME). The home signal lets `openspec-pw init`
 * detect dsh in a fresh project that has no `.dsh/` yet.
 */
export function hasDsh(projectRoot, homeDir = homedir()) {
    return (existsSync(join(projectRoot, ".dsh")) ||
        existsSync(join(homeDir, ".dsh")));
}
export const dshAdapter = defineAdapter({
    id: "dsh",
    label: "dsh",
    displayName: "DeepSeek Harness",
    detect: hasDsh,
    // dsh configures MCP via cordis.yml plugin config, not a simple file —
    // shared MCP phases skip this adapter (configure Playwright MCP manually).
    supportsMcp: false,
    commandFilePath: getDshCommandPath,
    formatCommand: formatDshCommand,
    // dsh reads AGENTS.md natively — that's the default.
});
registerAdapter(dshAdapter);
//# sourceMappingURL=dsh.js.map