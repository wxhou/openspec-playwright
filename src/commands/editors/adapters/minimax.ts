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
import { join } from "path";
import type {
  AdapterDeclaration,
  ArtifactSpec,
  CommandMeta,
} from "../types.js";
import { defineAdapter } from "../declaration.js";
import { formatArtifact } from "../shared.js";
import { registerAdapter } from "../registry.js";

// ─── MiniMax Code adapter ────────────────────────────────────────────────

export function getMinimaxSkillPath(id: string): string {
  return join(".agents", "skills", `opsx-${id}`, "SKILL.md");
}

/**
 * Path to the MCP config file MiniMax Code loads from the project workspace.
 * Shared with the Claude Code and CodeBuddy CLI adapters — all three read
 * and write the project-root `.mcp.json`.
 */
export function minimaxMcpPath(projectRoot: string): string {
  return join(projectRoot, ".mcp.json");
}

/**
 * Skills: `<root>/skills/<name>/SKILL.md` with YAML frontmatter
 * (name + description). Workspace roots include `.minimax/skills`,
 * `.claude/skills` and `.agents/skills`. Invoked as `/<name>`.
 */
const MINIMAX_ARTIFACT: ArtifactSpec = {
  path: getMinimaxSkillPath,
  naming: "hyphen-prefix",
  frontmatter: { name: true, description: true },
};

const minimaxDeclaration: AdapterDeclaration = {
  id: "minimax",
  label: "minimax",
  displayName: "MiniMax Code",
  artifacts: [MINIMAX_ARTIFACT],
  detection: {
    projectPaths: [".minimax"],
    globalPaths: [".minimax-code"],
    // `.agents/skills` is NOT contained by `.minimax/`, so the installed
    // skill is its own project signal. Any `opsx-*` skill counts, not only
    // today's command — the directory is named after the command id, so a
    // second command must not need a second detection rule.
    artifactRoots: [
      { dir: join(".agents", "skills"), prefix: "opsx-", entry: "SKILL.md" },
    ],
  },
  // Shared with Claude Code and CodeBuddy CLI.
  mcp: { kind: "mcp-servers-file", path: minimaxMcpPath },
  // MiniMax Code reads AGENTS.md natively — that's the default.
};

export const minimaxAdapter = defineAdapter(minimaxDeclaration);

// ─── Named exports (derived from the declaration) ────────────────────────

export function formatMinimaxSkill(meta: CommandMeta): string {
  return formatArtifact(MINIMAX_ARTIFACT, meta);
}

/**
 * Detection: the project's `.minimax/` marker dir, the global CLI install
 * root, or the installed skill artifact.
 *
 * The global signal is a pre-select hint only — `hasMinimaxProjectSignal`
 * excludes it.
 */
export function hasMinimax(projectRoot: string, homeDir?: string): boolean {
  return minimaxAdapter.detect(projectRoot, homeDir);
}

/** Project-level signal only: marker dir or the installed skill. */
export function hasMinimaxProjectSignal(projectRoot: string): boolean {
  return minimaxAdapter.projectSignal!(projectRoot);
}

registerAdapter(minimaxAdapter);
