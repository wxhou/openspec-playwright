/**
 * Oh My Pi adapter: native command at `.omp/commands/opsx-<id>.md`
 * (FATAL frontmatter parsing — keep YAML valid); MCP in `.omp/mcp.json`.
 * Detected via `.omp/` or global `~/.omp/agent/`.
 */
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { defineAdapter, type EditorAdapter, type CommandMeta } from "../types.js";
import {
  escapeYamlValue,
  transformToHyphenCommands,
  isMcpServerInFile,
  installMcpServerInFile,
  removeMcpServerFromFile,
} from "../shared.js";
import { registerAdapter } from "../registry.js";

// ─── Oh My Pi adapter ────────────────────────────────────────────────────

/**
 * Oh My Pi (omp) stores project slash commands in `.omp/commands/*.md`
 * (non-recursive scan, project before user). Native commands are parsed
 * with FATAL frontmatter parsing, so the YAML must be valid; `name`
 * overrides the filename and `description` feeds autocomplete. `$1` /
 * `$ARGUMENTS` placeholders expand at prompt time.
 *
 * Conventions follow the omp docs (docs/slash-command-internals.md,
 * docs/mcp-config.md):
 *   - Commands:  `.omp/commands/*.md`, invoked via `/name`.
 *   - MCP:       `.omp/mcp.json` with `{ "mcpServers": { ... } }` — same
 *                shape as Cline/Cursor. omp also inherits `.claude/` /
 *                `.cursor/` / opencode MCP configs when present.
 *   - Rules:     omp reads `AGENTS.md` natively — no wrapper file needed.
 */
export function formatOmpCommand(meta: CommandMeta): string {
  const body = transformToHyphenCommands(meta.body);
  const cmdName = `opsx-${meta.id}`;
  return `---
name: ${escapeYamlValue(cmdName)}
description: ${escapeYamlValue(meta.description)}
---

${body}
`;
}

export function getOmpCommandPath(id: string): string {
  return join(".omp", "commands", `opsx-${id}.md`);
}

/**
 * True when Oh My Pi is in use: a project `.omp/` dir, or a global omp
 * config dir (`~/.omp/agent/`, created by omp on first run).
 */
export function hasOmp(
  projectRoot: string,
  homeDir = homedir(),
): boolean {
  return (
    existsSync(join(projectRoot, ".omp")) ||
    existsSync(join(homeDir, ".omp", "agent"))
  );
}

export const ompAdapter: EditorAdapter = defineAdapter({
  id: "omp",
  label: "omp",
  displayName: "Oh My Pi",
  detect: hasOmp,
  commandFilePath: getOmpCommandPath,
  formatCommand: formatOmpCommand,
  // omp reads AGENTS.md natively — that's the default.
  isMcpInstalled(projectRoot, serverName) {
    return isMcpServerInFile(ompMcpPath(projectRoot), serverName);
  },
  installMcp(projectRoot, serverName, command) {
    installMcpServerInFile(ompMcpPath(projectRoot), serverName, command);
  },
  removeMcp(projectRoot, serverName) {
    removeMcpServerFromFile(ompMcpPath(projectRoot), serverName);
  },
});

/** Path to the project-level MCP config file for Oh My Pi. */
function ompMcpPath(projectRoot: string): string {
  return join(projectRoot, ".omp", "mcp.json");
}

registerAdapter(ompAdapter);
