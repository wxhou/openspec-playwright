/**
 * Kimi Code adapter: skill bundle at `.kimi-code/skills/opsx-<id>/SKILL.md`
 * (invoked as `/skill:opsx-<id>`), project MCP in `.kimi-code/mcp.json`
 * (`mcpServers`), project rules in AGENTS.md (the default; Kimi's automatic
 * AGENTS.md loading is not documented — see the change design).
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

// ─── Kimi Code adapter ────────────────────────────────────────────────────

export function getKimiSkillPath(id: string): string {
  return join(".kimi-code", "skills", `opsx-${id}`, "SKILL.md");
}

const KIMI_SKILL: ArtifactSpec = {
  path: getKimiSkillPath,
  naming: "hyphen-prefix",
  frontmatter: { name: true, description: true },
};

const kimiDeclaration: AdapterDeclaration = {
  id: "kimi",
  label: "kimi",
  displayName: "Kimi Code",
  artifacts: [KIMI_SKILL],
  detection: {
    projectPaths: [".kimi-code", ".kimi"],
    globalPaths: [".kimi-code"],
  },
  mcp: {
    kind: "mcp-servers-file",
    path: (root) => join(root, ".kimi-code", "mcp.json"),
  },
  invocationHint: "/skill:opsx-e2e",
};

export const kimiAdapter = defineAdapter(kimiDeclaration);

// ─── Named exports (derived from the declaration) ────────────────────────

export function formatKimiSkill(meta: CommandMeta): string {
  return formatArtifact(KIMI_SKILL, meta);
}

export function hasKimi(projectRoot: string, homeDir?: string): boolean {
  return kimiAdapter.detect(projectRoot, homeDir);
}

registerAdapter(kimiAdapter);
