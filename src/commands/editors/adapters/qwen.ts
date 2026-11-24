/**
 * Qwen Code adapter: markdown command at `.qwen/commands/opsx-<id>.md`,
 * MCP in `.qwen/settings.json`, full standards in `QWEN.md`.
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

// ─── Qwen Code adapter ────────────────────────────────────────────────────

export function getQwenCommandPath(id: string): string {
  return join(".qwen", "commands", `opsx-${id}.md`);
}

export function getQwenCommandPath2(id: string): string {
  return join(".qwen", "commands", `openspec-${id}.md`);
}

/** Qwen custom commands: markdown with a `description` frontmatter field. */
const QWEN_COMMAND: ArtifactSpec = {
  path: getQwenCommandPath,
  naming: "hyphen-prefix",
  frontmatter: { description: true },
};

const QWEN_COMMAND2: ArtifactSpec = {
  path: getQwenCommandPath2,
  naming: "hyphen-prefix",
  frontmatter: { description: true },
};

const qwenDeclaration: AdapterDeclaration = {
  id: "qwen",
  label: "qwen",
  displayName: "Qwen Code",
  artifacts: [QWEN_COMMAND],
  artifacts2: [QWEN_COMMAND2],
  detection: {
    projectPaths: [".qwen"],
    globalPaths: [".qwen"],
  },
  mcp: {
    kind: "mcp-servers-file",
    path: (root) => join(root, ".qwen", "settings.json"),
  },
  rules: {
    path: (root) => join(root, "QWEN.md"),
    mode: "full",
  },
};

export const qwenAdapter = defineAdapter(qwenDeclaration);
export const qwenAdapter2 = defineAdapter(qwenDeclaration, "openspec");

// ─── Named exports (derived from the declaration) ────────────────────────

export function formatQwenCommand(meta: CommandMeta): string {
  return formatArtifact(QWEN_COMMAND, meta);
}

export function hasQwen(projectRoot: string, homeDir?: string): boolean {
  return qwenAdapter.detect(projectRoot, homeDir);
}

registerAdapter(qwenAdapter);
registerAdapter(qwenAdapter2);
