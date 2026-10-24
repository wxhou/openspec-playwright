/**
 * CodeBuddy CLI adapter: `.codebuddy/commands/opsx/<id>.md` (subdirectory
 * colon naming → `/opsx:e2e`), description-only frontmatter; project rules
 * via a thin CODEBUDDY.md wrapper (CodeBuddy prefers CODEBUDDY.md over
 * AGENTS.md); Playwright MCP installs at project scope — written directly
 * to the project-root `.mcp.json` (never via `codebuddy mcp`: the CLI
 * starts a port-bound service that conflicts with running sessions).
 */
import { join } from "path";
import type {
  AdapterDeclaration,
  ArtifactSpec,
  CommandMeta,
} from "../types.js";
import { defineAdapter } from "../declaration.js";
import { formatArtifact } from "../shared.js";
import { registerAdapter } from "../registry.js";

// ─── CodeBuddy CLI adapter ───────────────────────────────────────────────

export function getCodebuddyCommandPath(id: string): string {
  return join(".codebuddy", "commands", "opsx", `${id}.md`);
}

const CODEBUDDY_ARTIFACT: ArtifactSpec = {
  path: getCodebuddyCommandPath,
  naming: "namespace-dir",
  // CodeBuddy's documented frontmatter fields are description,
  // argument-hint, model, allowed-tools, disable-model-invocation — no
  // `name` field (extra keys are ignored). Same shape as Claude's.
  frontmatter: { description: true, argumentHint: "<change-name|all>" },
};

const codebuddyDeclaration: AdapterDeclaration = {
  id: "codebuddy",
  label: "codebuddy",
  displayName: "CodeBuddy CLI",
  artifacts: [CODEBUDDY_ARTIFACT],
  detection: {
    projectPaths: [".codebuddy"],
    intentPaths: ["CODEBUDDY.md"],
  },
  // Shared with Claude Code and MiniMax Code.
  mcp: { kind: "mcp-servers-file", path: (root) => join(root, ".mcp.json") },
  // CodeBuddy prefers CODEBUDDY.md over AGENTS.md when both exist — the
  // wrapper (installProjectRules phase) keeps the standards reachable.
  rules: { path: (root) => join(root, "CODEBUDDY.md") },
};

export const codebuddyAdapter = defineAdapter(codebuddyDeclaration);

// ─── Named exports (derived from the declaration) ────────────────────────

export function formatCodebuddyCommand(meta: CommandMeta): string {
  return formatArtifact(CODEBUDDY_ARTIFACT, meta);
}

export function hasCodebuddy(projectRoot: string, homeDir?: string): boolean {
  return codebuddyAdapter.detect(projectRoot, homeDir);
}

registerAdapter(codebuddyAdapter);
