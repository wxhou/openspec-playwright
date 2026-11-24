/**
 * Trae adapter: markdown command at `.trae/commands/opsx-<id>.md`
 * (name + description frontmatter), project MCP in `.trae/mcp.json`
 * (`mcpServers`, Project MCP beta), full standards in the tool-owned file
 * `.trae/rules/project_rules.md`.
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

// ─── Trae adapter ─────────────────────────────────────────────────────────

export function getTraeCommandPath(id: string): string {
  return join(".trae", "commands", `opsx-${id}.md`);
}

export function getTraeCommandPath2(id: string): string {
  return join(".trae", "commands", `openspec-${id}.md`);
}

export function getTraeRulesPath(): string {
  return join(".trae", "rules", "project_rules.md");
}

const TRAE_COMMAND: ArtifactSpec = {
  path: getTraeCommandPath,
  naming: "hyphen-prefix",
  frontmatter: { name: true, description: true },
};

const TRAE_COMMAND2: ArtifactSpec = {
  path: getTraeCommandPath2,
  naming: "hyphen-prefix",
  frontmatter: { name: true, description: true },
};

const traeDeclaration: AdapterDeclaration = {
  id: "trae",
  label: "trae",
  displayName: "Trae",
  artifacts: [TRAE_COMMAND],
  artifacts2: [TRAE_COMMAND2],
  detection: {
    // No reliable user-level `.trae` config-dir convention: project only.
    projectPaths: [".trae"],
  },
  mcp: {
    kind: "mcp-servers-file",
    path: (root) => join(root, ".trae", "mcp.json"),
  },
  rules: {
    path: (root) => join(root, getTraeRulesPath()),
    mode: "full",
  },
};

export const traeAdapter = defineAdapter(traeDeclaration);
export const traeAdapter2 = defineAdapter(traeDeclaration, "openspec");

// ─── Named exports (derived from the declaration) ────────────────────────

export function formatTraeCommand(meta: CommandMeta): string {
  return formatArtifact(TRAE_COMMAND, meta);
}

export function hasTrae(projectRoot: string, homeDir?: string): boolean {
  return traeAdapter.detect(projectRoot, homeDir);
}

registerAdapter(traeAdapter);
registerAdapter(traeAdapter2);
