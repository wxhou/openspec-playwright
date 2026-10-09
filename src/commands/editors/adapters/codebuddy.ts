/**
 * CodeBuddy CLI adapter: `.codebuddy/commands/opsx/<id>.md` (subdirectory
 * colon naming → `/opsx:e2e`), description-only frontmatter; project rules
 * via a thin CODEBUDDY.md wrapper (CodeBuddy prefers CODEBUDDY.md over
 * AGENTS.md); Playwright MCP installs at project scope — written directly
 * to the project-root `.mcp.json` (never via `codebuddy mcp`: the CLI
 * starts a port-bound service that conflicts with running sessions).
 */
import { existsSync } from "fs";
import { join } from "path";
import { defineAdapter, type EditorAdapter, type CommandMeta } from "../types.js";
import {
  escapeYamlValue,
  isMcpServerInFile,
  installMcpServerInFile,
  removeMcpServerFromFile,
} from "../shared.js";
import { registerAdapter } from "../registry.js";

// ─── CodeBuddy CLI adapter ───────────────────────────────────────────────

/**
 * CodeBuddy's documented command frontmatter fields are description,
 * argument-hint, model, allowed-tools, disable-model-invocation — no
 * `name` field (extra keys are ignored). Same shape as Claude's, so the
 * body keeps its `/opsx:` references (subdirectory colon naming).
 */
export function formatCodebuddyCommand(meta: CommandMeta): string {
  return `---
description: ${escapeYamlValue(meta.description)}
argument-hint: "<change-name|all>"
---

${meta.body}
`;
}

export function getCodebuddyCommandPath(id: string): string {
  return join(".codebuddy", "commands", "opsx", `${id}.md`);
}

export function hasCodebuddy(projectRoot: string): boolean {
  return existsSync(join(projectRoot, ".codebuddy"));
}

export const codebuddyAdapter: EditorAdapter = defineAdapter({
  id: "codebuddy",
  label: "codebuddy",
  displayName: "CodeBuddy CLI",
  detect: hasCodebuddy,
  commandFilePath: getCodebuddyCommandPath,
  formatCommand: formatCodebuddyCommand,
  // CodeBuddy prefers CODEBUDDY.md over AGENTS.md when both exist — the
  // wrapper (installProjectRules phase) keeps the standards reachable.
  projectRulesPath: (root) => join(root, "CODEBUDDY.md"),
  isMcpInstalled(projectRoot, serverName) {
    return isMcpServerInFile(codebuddyMcpPath(projectRoot), serverName);
  },
  installMcp(projectRoot, serverName, command) {
    installMcpServerInFile(codebuddyMcpPath(projectRoot), serverName, command);
  },
  removeMcp(projectRoot, serverName) {
    removeMcpServerFromFile(codebuddyMcpPath(projectRoot), serverName);
  },
});

/** Path to the project-scope MCP config file for CodeBuddy CLI. */
function codebuddyMcpPath(projectRoot: string): string {
  return join(projectRoot, ".mcp.json");
}

registerAdapter(codebuddyAdapter);
