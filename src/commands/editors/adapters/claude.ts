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
import { formatArtifact } from "../shared.js";
import { registerAdapter } from "../registry.js";
import { installedAgentsSnapshotDir, loadAgentSnapshots } from "../agents.js";

// ─── Claude Code adapter ─────────────────────────────────────────────────

export function getClaudeCommandPath(id: string): string {
  return join(".claude", "commands", "opsx", `${id}.md`);
}

/** 2.x: Claude loads a real skill directory (a copy, not a symlink). */
export function getClaudeSkillPath(id: string): string {
  return join(".claude", "skills", `openspec-${id}`, "SKILL.md");
}

/** 2.x: the shared skill bundle other skill editors also read. */
export function getClaudeSharedSkillPath(id: string): string {
  return join(".agents", "skills", `openspec-${id}`, "SKILL.md");
}

const CLAUDE_ARTIFACT: ArtifactSpec = {
  path: getClaudeCommandPath,
  naming: "namespace-dir",
  // Claude Code consumes `description` and `argument-hint`; name/category/tags
  // are ignored there and only made the frontmatter noisier.
  frontmatter: { description: true, argumentHint: "<change-name|all>" },
};

const CLAUDE_SKILL2: ArtifactSpec = {
  path: getClaudeSkillPath,
  naming: "hyphen-prefix",
  frontmatter: { name: true, description: true },
};

const CLAUDE_SHARED_SKILL2: ArtifactSpec = {
  path: getClaudeSharedSkillPath,
  naming: "hyphen-prefix",
  shared: true,
  frontmatter: { name: true, description: true },
};

const claudeDeclaration: AdapterDeclaration = {
  id: "claude",
  label: "claude",
  displayName: "Claude Code",
  artifacts: [CLAUDE_ARTIFACT],
  artifacts2: [CLAUDE_SKILL2, CLAUDE_SHARED_SKILL2],
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
  // Vendored official Playwright agents (init --agents). Read lazily from
  // the installed package templates; byte-identity with the official
  // init-agents output is load-bearing (content-based ownership), so the
  // files are shipped and written unmodified.
  optionalArtifacts: (install) =>
    install ? loadAgentSnapshots(installedAgentsSnapshotDir()) : [],
};

export const claudeAdapter = defineAdapter(claudeDeclaration);
export const claudeAdapter2 = defineAdapter(claudeDeclaration, "openspec");

// ─── Named exports (derived from the declaration) ────────────────────────

export function formatClaudeCommand(meta: CommandMeta): string {
  return formatArtifact(CLAUDE_ARTIFACT, meta);
}

export function formatClaudeSkill(meta: CommandMeta): string {
  return formatArtifact(CLAUDE_SKILL2, meta, "openspec");
}

export function hasClaudeCode(projectRoot: string, homeDir?: string): boolean {
  return claudeAdapter.detect(projectRoot, homeDir);
}

registerAdapter(claudeAdapter);
registerAdapter(claudeAdapter2);
