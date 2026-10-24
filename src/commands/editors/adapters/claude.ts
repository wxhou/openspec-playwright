/**
 * Claude Code adapter: `.claude/commands/opsx/<id>.md` with description +
 * argument-hint frontmatter (subdirectory colon naming → `/opsx:e2e`);
 * reads CLAUDE.md directly (thin wrapper installed by project-rules).
 * Playwright MCP installs at project scope — written to the project-root
 * `.mcp.json` via `claude mcp add --scope project`.
 */
import { join } from "path";
import type {
  AdapterDeclaration,
  ArtifactSpec,
  CommandMeta,
} from "../types.js";
import { defineAdapter } from "../declaration.js";
import { CLAUDE_LEGACY_SKILL_REL, formatArtifact } from "../shared.js";
import { registerAdapter } from "../registry.js";
import { installedAgentsSnapshotDir, loadAgentSnapshots } from "../agents.js";

// ─── Claude Code adapter ─────────────────────────────────────────────────

export function getClaudeCommandPath(id: string): string {
  return join(".claude", "commands", "opsx", `${id}.md`);
}

const CLAUDE_ARTIFACT: ArtifactSpec = {
  path: getClaudeCommandPath,
  naming: "namespace-dir",
  // Claude Code consumes `description` and `argument-hint`; name/category/tags
  // are ignored there and only made the frontmatter noisier.
  frontmatter: { description: true, argumentHint: "<change-name|all>" },
};

const claudeDeclaration: AdapterDeclaration = {
  id: "claude",
  label: "claude",
  displayName: "Claude Code",
  artifacts: [CLAUDE_ARTIFACT],
  detection: {
    projectPaths: [".claude"],
    // A root CLAUDE.md means the project already uses Claude Code — first-run
    // pre-select only, never write authorization.
    intentPaths: ["CLAUDE.md"],
  },
  // Claude Code's project scope IS the project-root .mcp.json — the same
  // file CodeBuddy CLI and MiniMax Code read and write. Writes go through
  // the CLI (`claude mcp add --scope project`), reads hit the file directly.
  mcp: { kind: "claude-cli", configPath: (root) => join(root, ".mcp.json") },
  rules: { path: (root) => join(root, "CLAUDE.md") },
  // Pre-0.3.74 installs wrote a skill directory instead of a command file.
  legacyArtifacts: [CLAUDE_LEGACY_SKILL_REL],
  // Vendored official Playwright agents (init --agents). Read lazily from
  // the installed package templates; byte-identity with the official
  // init-agents output is load-bearing (content-based ownership), so the
  // files are shipped and written unmodified.
  optionalArtifacts: (install) =>
    install ? loadAgentSnapshots(installedAgentsSnapshotDir()) : [],
};

export const claudeAdapter = defineAdapter(claudeDeclaration);

// ─── Named exports (derived from the declaration) ────────────────────────

export function formatClaudeCommand(meta: CommandMeta): string {
  return formatArtifact(CLAUDE_ARTIFACT, meta);
}

export function hasClaudeCode(projectRoot: string, homeDir?: string): boolean {
  return claudeAdapter.detect(projectRoot, homeDir);
}

registerAdapter(claudeAdapter);
