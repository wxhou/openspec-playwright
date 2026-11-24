/**
 * Cursor adapter: slash command at `.cursor/commands/opsx-<id>.md` (plain
 * markdown) plus an Agent Skill at `.cursor/skills/opsx-<id>/SKILL.md`;
 * MCP lives in `.cursor/mcp.json`. Cursor auto-detects AGENTS.md.
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

// ─── Cursor adapter (format / paths) ─────────────────────────────────────

export function getCursorCommandPath(id: string): string {
  return join(".cursor", "commands", `opsx-${id}.md`);
}

export function getCursorSkillPath(id: string): string {
  return join(".cursor", "skills", `opsx-${id}`, "SKILL.md");
}

export function getCursorCommandPath2(id: string): string {
  return join(".cursor", "commands", `openspec-${id}.md`);
}

export function getCursorSkillPath2(id: string): string {
  return join(".cursor", "skills", `openspec-${id}`, "SKILL.md");
}

/**
 * Cursor slash commands are plain markdown (no frontmatter); the filename
 * is the command name. `$1` is the change-name argument.
 */
const CURSOR_COMMAND: ArtifactSpec = {
  path: getCursorCommandPath,
  naming: "hyphen-prefix",
  header: (meta) =>
    `<!-- Change name: $1 (e.g. /opsx-${meta.id} my-change) -->`,
};

/**
 * Cursor Agent Skill — explicit invocation only (`disable-model-invocation`).
 * No `$1` placeholders (those belong to the slash command file).
 */
const CURSOR_SKILL: ArtifactSpec = {
  path: getCursorSkillPath,
  naming: "hyphen-prefix",
  frontmatter: {
    name: true,
    description: true,
    disableModelInvocation: true,
  },
};

const CURSOR_COMMAND2: ArtifactSpec = {
  path: getCursorCommandPath2,
  naming: "hyphen-prefix",
  header: (meta) =>
    `<!-- Change name: $1 (e.g. /openspec-${meta.id} my-change) -->`,
};

const CURSOR_SKILL2: ArtifactSpec = {
  path: getCursorSkillPath2,
  naming: "hyphen-prefix",
  frontmatter: {
    name: true,
    description: true,
    disableModelInvocation: true,
  },
};

const cursorDeclaration: AdapterDeclaration = {
  id: "cursor",
  label: "cursor",
  displayName: "Cursor",
  artifacts: [CURSOR_COMMAND, CURSOR_SKILL],
  artifacts2: [CURSOR_COMMAND2, CURSOR_SKILL2],
  detection: {
    projectPaths: [".cursor"],
    intentPaths: [".cursorrules"],
  },
  mcp: {
    kind: "mcp-servers-file",
    path: (root) => join(root, ".cursor", "mcp.json"),
  },
  // Cursor auto-detects AGENTS.md — that's the default rules path.
};

export const cursorAdapter = defineAdapter(cursorDeclaration);
export const cursorAdapter2 = defineAdapter(cursorDeclaration, "openspec");

// ─── Named exports (derived from the declaration) ────────────────────────

export function formatCursorCommand(meta: CommandMeta): string {
  return formatArtifact(CURSOR_COMMAND, meta);
}

export function formatCursorSkill(meta: CommandMeta): string {
  return formatArtifact(CURSOR_SKILL, meta);
}

export function hasCursor(projectRoot: string, homeDir?: string): boolean {
  return cursorAdapter.detect(projectRoot, homeDir);
}

registerAdapter(cursorAdapter);
registerAdapter(cursorAdapter2);
