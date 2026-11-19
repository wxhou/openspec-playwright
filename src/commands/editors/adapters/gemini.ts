/**
 * Gemini CLI adapter: TOML command at `.gemini/commands/opsx/<id>.toml`,
 * MCP in `.gemini/settings.json`, full standards in `GEMINI.md`.
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

// ─── Gemini CLI adapter ───────────────────────────────────────────────────

export function getGeminiCommandPath(id: string): string {
  return join(".gemini", "commands", "opsx", `${id}.toml`);
}

/** Gemini custom commands are TOML: `description` + multi-line `prompt`. */
const GEMINI_COMMAND: ArtifactSpec = {
  path: getGeminiCommandPath,
  naming: "namespace-dir",
  format: "toml",
};

const geminiDeclaration: AdapterDeclaration = {
  id: "gemini",
  label: "gemini",
  displayName: "Gemini CLI",
  artifacts: [GEMINI_COMMAND],
  detection: {
    projectPaths: [".gemini"],
    globalPaths: [".gemini"],
  },
  mcp: {
    kind: "mcp-servers-file",
    path: (root) => join(root, ".gemini", "settings.json"),
  },
  rules: {
    path: (root) => join(root, "GEMINI.md"),
    mode: "full",
  },
};

export const geminiAdapter = defineAdapter(geminiDeclaration);

// ─── Named exports (derived from the declaration) ────────────────────────

export function formatGeminiCommand(meta: CommandMeta): string {
  return formatArtifact(GEMINI_COMMAND, meta);
}

export function hasGemini(projectRoot: string, homeDir?: string): boolean {
  return geminiAdapter.detect(projectRoot, homeDir);
}

registerAdapter(geminiAdapter);
