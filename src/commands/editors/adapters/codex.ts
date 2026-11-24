/**
 * Codex adapter: skill bundle at `.agents/skills/opsx-<id>/SKILL.md`,
 * invoked as `$opsx-<id>`.
 *
 * `.agents/skills` is also MiniMax Code's skill root, so the artifact is
 * marked `shared`: it is installed and removed, but confers no configured
 * status and no write authorization, and is neither a detection signal nor
 * deleted while a selected editor still declares the same path.
 *
 * No project-level JSON MCP carrier: Codex reads `.codex/config.toml`
 * (`[mcp_servers]`, TOML), which this tool's MCP carrier contract does not
 * support. Project rules live in AGENTS.md (the default).
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

// ─── Codex adapter ────────────────────────────────────────────────────────

export function getCodexSkillPath(id: string): string {
  return join(".agents", "skills", `opsx-${id}`, "SKILL.md");
}

export function getCodexSkillPath2(id: string): string {
  return join(".agents", "skills", `openspec-${id}`, "SKILL.md");
}

const CODEX_SKILL: ArtifactSpec = {
  path: getCodexSkillPath,
  naming: "hyphen-prefix",
  shared: true,
  frontmatter: { name: true, description: true },
};

const CODEX_SKILL2: ArtifactSpec = {
  path: getCodexSkillPath2,
  naming: "hyphen-prefix",
  shared: true,
  frontmatter: { name: true, description: true },
};

const codexDeclaration: AdapterDeclaration = {
  id: "codex",
  label: "codex",
  displayName: "Codex",
  artifacts: [CODEX_SKILL],
  artifacts2: [CODEX_SKILL2],
  detection: {
    // `.agents/skills` is shared with MiniMax Code — never a detection signal.
    projectPaths: [".codex"],
    globalPaths: [".codex"],
  },
  mcp: { kind: "none" },
  invocationHint: "$opsx-e2e",
  invocationHint2: "$openspec-e2e",
};

export const codexAdapter = defineAdapter(codexDeclaration);
export const codexAdapter2 = defineAdapter(codexDeclaration, "openspec");

// ─── Named exports (derived from the declaration) ────────────────────────

export function formatCodexSkill(meta: CommandMeta): string {
  return formatArtifact(CODEX_SKILL, meta);
}

export function hasCodex(projectRoot: string, homeDir?: string): boolean {
  return codexAdapter.detect(projectRoot, homeDir);
}

registerAdapter(codexAdapter);
registerAdapter(codexAdapter2);
