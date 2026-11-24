/**
 * Roo Code adapter: markdown command at `.roo/commands/opsx-<id>.md`
 * (heading + description, no frontmatter), MCP in `.roo/mcp.json`, full
 * standards in the tool-owned file `.roo/rules/openspec-pw.md`.
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

// ─── Roo Code adapter ─────────────────────────────────────────────────────

export function getRooCodeCommandPath(id: string): string {
  return join(".roo", "commands", `opsx-${id}.md`);
}

export function getRooCodeCommandPath2(id: string): string {
  return join(".roo", "commands", `openspec-${id}.md`);
}

export function getRooCodeRulesPath(): string {
  return join(".roo", "rules", "openspec-pw.md");
}

/** Roo commands use a markdown heading + description instead of frontmatter. */
const ROOCODE_COMMAND: ArtifactSpec = {
  path: getRooCodeCommandPath,
  naming: "hyphen-prefix",
  header: (meta) => `# ${meta.name}\n\n${meta.description}`,
};

const ROOCODE_COMMAND2: ArtifactSpec = {
  path: getRooCodeCommandPath2,
  naming: "hyphen-prefix",
  header: (meta) => `# ${meta.name}\n\n${meta.description}`,
};

const roocodeDeclaration: AdapterDeclaration = {
  id: "roocode",
  label: "roocode",
  displayName: "Roo Code",
  artifacts: [ROOCODE_COMMAND],
  artifacts2: [ROOCODE_COMMAND2],
  detection: {
    projectPaths: [".roo"],
    globalPaths: [".roo"],
  },
  mcp: {
    kind: "mcp-servers-file",
    path: (root) => join(root, ".roo", "mcp.json"),
  },
  rules: {
    path: (root) => join(root, getRooCodeRulesPath()),
    mode: "full",
  },
};

export const roocodeAdapter = defineAdapter(roocodeDeclaration);
export const roocodeAdapter2 = defineAdapter(roocodeDeclaration, "openspec");

// ─── Named exports (derived from the declaration) ────────────────────────

export function formatRooCodeCommand(meta: CommandMeta): string {
  return formatArtifact(ROOCODE_COMMAND, meta);
}

export function hasRooCode(projectRoot: string, homeDir?: string): boolean {
  return roocodeAdapter.detect(projectRoot, homeDir);
}

registerAdapter(roocodeAdapter);
registerAdapter(roocodeAdapter2);
