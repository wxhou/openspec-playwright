/**
 * OpenCode adapter: `.opencode/commands/opsx-<id>.md`, description-only
 * frontmatter; edits `opencode.json(c)` for both MCP (`mcp.playwright`)
 * and the `instructions` list that routes AGENTS.md into context.
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

// ─── OpenCode adapter ────────────────────────────────────────────────────

export function getOpenCodeCommandPath(id: string): string {
  return join(".opencode", "commands", `opsx-${id}.md`);
}

const OPENCODE_ARTIFACT: ArtifactSpec = {
  path: getOpenCodeCommandPath,
  naming: "hyphen-prefix",
  frontmatter: { description: true },
};

const opencodeDeclaration: AdapterDeclaration = {
  id: "opencode",
  label: "opencode",
  displayName: "OpenCode",
  artifacts: [OPENCODE_ARTIFACT],
  detection: {
    projectPaths: [".opencode"],
    intentPaths: ["opencode.json", "opencode.jsonc"],
  },
  // opencode.json(c) is exclusive to OpenCode — not a shared-retention file.
  mcp: { kind: "opencode-json" },
  rules: {
    // AGENTS.md is the default path, but OpenCode only loads it when the
    // file is registered in its `instructions` array.
    path: (root) => join(root, "AGENTS.md"),
    registerInConfig: "opencode-json",
  },
};

export const opencodeAdapter = defineAdapter(opencodeDeclaration);

// ─── Named exports (derived from the declaration) ────────────────────────

export function formatOpenCodeCommand(meta: CommandMeta): string {
  return formatArtifact(OPENCODE_ARTIFACT, meta);
}

export function hasOpenCode(projectRoot: string, homeDir?: string): boolean {
  return opencodeAdapter.detect(projectRoot, homeDir);
}

// Kept for project-rules and the public facade; implementation moved to the
// opencode-json MCP carrier.
export { readOpenCodeInstructions } from "../mcp-carriers.js";

registerAdapter(opencodeAdapter);
