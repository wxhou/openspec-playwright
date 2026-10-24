/**
 * Pi adapter: native prompt at `.pi/prompts/opsx-<id>.md` (description +
 * argument-hint frontmatter, hyphenated command references). Pi has no MCP
 * client, so the MCP phases are skipped entirely. Detected via `.pi/` or
 * the global `~/.pi/agent/`, but the global dir never authorizes writes.
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

// ─── Pi adapter ──────────────────────────────────────────────────────────

export function getPiCommandPath(id: string): string {
  return join(".pi", "prompts", `opsx-${id}.md`);
}

const PI_ARTIFACT: ArtifactSpec = {
  path: getPiCommandPath,
  naming: "hyphen-prefix",
  frontmatter: { description: true, argumentHint: "<change-name>" },
};

const piDeclaration: AdapterDeclaration = {
  id: "pi",
  label: "pi",
  displayName: "Pi",
  artifacts: [PI_ARTIFACT],
  detection: {
    projectPaths: [".pi"],
    // Global install root: pre-select suggestion only — never a write
    // authorization.
    globalPaths: [join(".pi", "agent")],
  },
  // Pi has no MCP client — shared MCP phases skip this adapter.
  mcp: { kind: "none" },
  // Pi loads AGENTS.md natively (walking up from cwd) — that's the default.
};

export const piAdapter = defineAdapter(piDeclaration);

// ─── Named exports (derived from the declaration) ────────────────────────

export function formatPiCommand(meta: CommandMeta): string {
  return formatArtifact(PI_ARTIFACT, meta);
}

export function hasPi(projectRoot: string, homeDir?: string): boolean {
  return piAdapter.detect(projectRoot, homeDir);
}

registerAdapter(piAdapter);
