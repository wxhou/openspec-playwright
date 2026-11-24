/**
 * Cline adapter: `.cline/skills/opsx-<id>/SKILL.md` with name+description
 * frontmatter; MCP lives in `.cline/mcp.json`. Cline auto-detects
 * AGENTS.md as project rules — no wrapper file needed.
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

// ─── Cline adapter ───────────────────────────────────────────────────────

export function getClineCommandPath(id: string): string {
  return join(".cline", "skills", `opsx-${id}`, "SKILL.md");
}

export function getClineCommandPath2(id: string): string {
  return join(".cline", "skills", `openspec-${id}`, "SKILL.md");
}

/**
 * Cline's skill artifact. The shared `formatArtifact` keeps Cline and
 * MiniMax Code byte-identical for the same shape.
 *
 * Cline stores project-level config in `.cline/` (skills/, rules/, mcp.json).
 * `.clinerules/` is the legacy rules-only directory, still auto-detected.
 */
const CLINE_ARTIFACT: ArtifactSpec = {
  path: getClineCommandPath,
  naming: "hyphen-prefix",
  frontmatter: { name: true, description: true },
};

const CLINE_ARTIFACT2: ArtifactSpec = {
  path: getClineCommandPath2,
  naming: "hyphen-prefix",
  frontmatter: { name: true, description: true },
};

const clineDeclaration: AdapterDeclaration = {
  id: "cline",
  label: "cline",
  displayName: "Cline",
  artifacts: [CLINE_ARTIFACT],
  artifacts2: [CLINE_ARTIFACT2],
  detection: { projectPaths: [".cline", ".clinerules"] },
  mcp: {
    kind: "mcp-servers-file",
    path: (root) => join(root, ".cline", "mcp.json"),
  },
};

export const clineAdapter = defineAdapter(clineDeclaration);
export const clineAdapter2 = defineAdapter(clineDeclaration, "openspec");

// ─── Named exports (derived from the declaration) ────────────────────────

export function formatClineCommand(meta: CommandMeta): string {
  return formatArtifact(CLINE_ARTIFACT, meta);
}

export function hasCline(projectRoot: string, homeDir?: string): boolean {
  return clineAdapter.detect(projectRoot, homeDir);
}

registerAdapter(clineAdapter);
registerAdapter(clineAdapter2);
