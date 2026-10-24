/**
 * Cline adapter: `.cline/skills/opsx-<id>/SKILL.md` with name+description
 * frontmatter; MCP lives in `.cline/mcp.json`. Cline auto-detects
 * AGENTS.md as project rules — no wrapper file needed.
 */
import { existsSync } from "fs";
import { join } from "path";
import { defineAdapter, type EditorAdapter, type CommandMeta } from "../types.js";
import {
  formatSkillCommand,
  isMcpServerInFile,
  installMcpServerInFile,
  removeMcpServerFromFile,
} from "../shared.js";
import { registerAdapter } from "../registry.js";

// ─── Cline adapter ───────────────────────────────────────────────────────

/**
 * Cline's skill artifact. Delegates to the shared skill formatter so Cline
 * and MiniMax Code emit byte-identical skill files.
 *
 * Cline stores project-level config in `.cline/` (skills/, rules/, mcp.json).
 * `.clinerules/` is the legacy rules-only directory, still auto-detected.
 *
 * Conventions follow the Cline documentation (2026):
 *   - Skills:   `.cline/skills/<name>/SKILL.md` with YAML frontmatter
 *                (name + description). Triggered via `/<name>` slash command.
 *   - MCP:      `.cline/mcp.json` with `{ "mcpServers": { ... } }` structure.
 *   - Rules:    Cline auto-detects `AGENTS.md` — no wrapper file needed.
 */
export function formatClineCommand(meta: CommandMeta): string {
  return formatSkillCommand(meta);
}

export function getClineCommandPath(id: string): string {
  return join(".cline", "skills", `opsx-${id}`, "SKILL.md");
}

export function hasCline(projectRoot: string): boolean {
  return (
    existsSync(join(projectRoot, ".cline")) ||
    existsSync(join(projectRoot, ".clinerules"))
  );
}

export const clineAdapter: EditorAdapter = defineAdapter({
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
  mcpConfigPath: clineMcpPath,
});

/** Path to the project-level MCP config file for Cline. */
function clineMcpPath(projectRoot: string): string {
  return join(projectRoot, ".cline", "mcp.json");
}

registerAdapter(clineAdapter);
