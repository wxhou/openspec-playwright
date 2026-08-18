/**
 * Editor adapter layer.
 *
 * Claude Code, OpenCode, Cline, and Cursor can host the /opsx:e2e command,
 * plus a project-level rules file (CLAUDE.md / AGENTS.md) and an MCP server
 * definition. Each editor has its own conventions — file path, frontmatter
 * shape, MCP install mechanism — so this module exposes a single
 * `EditorAdapter` interface and a registry that callers can iterate.
 *
 * Conventions follow the upstream OpenSpec reference implementation:
 *   - Claude:  `.claude/commands/opsx/<id>.md`, full frontmatter,
 *              `claude mcp add …`, reads CLAUDE.md directly.
 *   - OpenCode: `.opencode/commands/opsx-<id>.md`, description-only
 *              frontmatter, edits `opencode.json(c)`, reads files listed
 *              under `instructions` (CLAUDE.md is a built-in fallback).
 *   - Cline:   `.cline/skills/opsx-<id>/SKILL.md`, name+description
 *              frontmatter, edits `.cline/mcp.json`, auto-detects AGENTS.md.
 *   - Cursor:  `.cursor/commands/opsx-<id>.md` (plain MD) +
 *              `.cursor/skills/opsx-<id>/SKILL.md` (extraArtifacts),
 *              edits `.cursor/mcp.json`, auto-detects AGENTS.md.
 *   - Pi:      `.pi/prompts/opsx-<id>.md` (prompt template), description +
 *              argument-hint frontmatter, NO MCP client (supportsMcp:false),
 *              auto-detects AGENTS.md. Detected via `.pi/` or `~/.pi/agent/`.
 *   - Oh My Pi: `.omp/commands/opsx-<id>.md`, name+description frontmatter,
 *              edits `.omp/mcp.json` (same shape as Cline/Cursor),
 *              auto-detects AGENTS.md. Detected via `.omp/` or `~/.omp/agent/`.
 *   - DeepSeek Harness: `.dsh/skills/opsx-<id>/SKILL.md` (project-dsh skill,
 *              rank 100), name+description frontmatter, NO MCP client
 *              (supportsMcp:false — MCP is configured via cordis.yml plugin
 *              config, not a simple file), auto-detects AGENTS.md. Detected
 *              via `.dsh/` or `~/.dsh/` (DSH_HOME).
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "fs";
import { execFileSync } from "node:child_process";
import { homedir } from "os";
import { join, dirname, basename, resolve as pathResolve } from "path";
import chalk from "chalk";
import {
  modify,
  applyEdits,
  parseTree as parseJsonc,
  findNodeAtLocation,
  getNodeValue,
  type FormattingOptions,
} from "jsonc-parser";
import { TIMEOUT } from "../shared/constants.js";
import { needsShell } from "../shared/platform.js";

// ─── YAML helpers (shared by Claude frontmatter and elsewhere) ───────────

/** Escape a value for safe inclusion in a YAML frontmatter scalar. */
export function escapeYamlValue(value: string): string {
  const needsQuoting = /[:\n\r#{}[\],&*!|>'"%@`]|^\s|\s$/.test(value);
  if (needsQuoting) {
    const escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n");
    return `"${escaped}"`;
  }
  return value;
}

/** Format tags as a YAML inline array. */
export function formatTagsArray(tags: string[]): string {
  return `[${tags.map((t) => escapeYamlValue(t)).join(", ")}]`;
}

// ─── Body transform ──────────────────────────────────────────────────────

/**
 * OpenCode slash-command names are hyphenated (`/opsx-e2e`), Claude's are
 * colon-prefixed (`/opsx:e2e`). Rewrite all `/opsx:` references in a
 * command body for OpenCode installation.
 */
export function transformToHyphenCommands(text: string): string {
  return text.replace(/\/opsx:/g, "/opsx-");
}

// ─── Command metadata ────────────────────────────────────────────────────

export interface CommandMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  body: string;
}

/** Build the command metadata for the /opsx:e2e command. */
export function buildCommandMeta(body: string): CommandMeta {
  return {
    id: "e2e",
    name: "OPSX: E2E",
    description: "Run Playwright E2E verification for an OpenSpec change",
    category: "OpenSpec",
    tags: ["openspec", "playwright", "e2e", "testing"],
    body,
  };
}

// ─── Editor adapter interface ────────────────────────────────────────────

export type EditorId =
  | "claude"
  | "opencode"
  | "cline"
  | "cursor"
  | "pi"
  | "omp"
  | "dsh";

export interface ExtraArtifact {
  relativePath: string;
  contents: string;
}

export interface EditorAdapter {
  id: EditorId;
  /** Short label used in log messages. */
  label: string;
  /** Human-readable name used in user-facing messages. */
  displayName: string;
  /**
   * True if this editor's config dir is present in the project.
   * Some adapters (Pi, Oh My Pi) also treat a global config dir in the
   * user's home as a detection signal — `homeDir` lets tests inject a
   * fake home so detection stays hermetic.
   */
  detect(projectRoot: string, homeDir?: string): boolean;
  /**
   * True when this editor has an MCP client to configure. False skips all
   * MCP install/check/remove phases (Pi has no MCP client).
   */
  supportsMcp?: boolean;
  /** Relative path of the command file inside the project. */
  commandFilePath(id: string): string;
  /** Format command file contents (frontmatter + body). */
  formatCommand(meta: CommandMeta): string;
  /** Absolute path of the project rules file. */
  projectRulesPath(projectRoot: string): string;
  /** True if MCP server `serverName` is already configured. */
  isMcpInstalled(projectRoot: string, serverName: string): boolean;
  /** Install MCP server config in this editor. */
  installMcp(projectRoot: string, serverName: string, command: string[]): void;
  /** Remove MCP server config from this editor. */
  removeMcp(projectRoot: string, serverName: string): void;
  /** Optional: register project rules file path in editor config. */
  registerInstructions?(projectRoot: string, instructions: string[]): void;
  /** Optional: secondary files written alongside commandFilePath (Cursor skill). */
  extraArtifacts?(meta: CommandMeta): ExtraArtifact[];
}

/**
 * Input shape for `defineAdapter` — declares the contract for an editor
 * adapter with sensible defaults for the no-MCP-client case (Pi, dsh).
 * All required-by-behavior fields are still required; optional ones
 * (supportsMcp, projectRulesPath, isMcpInstalled, installMcp, removeMcp)
 * fall back to defaults.
 */
export interface EditorAdapterInit {
  id: EditorId;
  label: string;
  displayName: string;
  detect: EditorAdapter["detect"];
  commandFilePath: EditorAdapter["commandFilePath"];
  formatCommand: EditorAdapter["formatCommand"];
  /** Optional: true by default; set false for editors without an MCP client. */
  supportsMcp?: boolean;
  /** Optional: defaults to `<root>/AGENTS.md`. Override for Claude (CLAUDE.md). */
  projectRulesPath?: EditorAdapter["projectRulesPath"];
  /** Required when supportsMcp !== false. Defaults to `() => false`. */
  isMcpInstalled?: EditorAdapter["isMcpInstalled"];
  /** Required when supportsMcp !== false. Defaults to a no-op. */
  installMcp?: EditorAdapter["installMcp"];
  /** Required when supportsMcp !== false. Defaults to a no-op. */
  removeMcp?: EditorAdapter["removeMcp"];
  registerInstructions?: EditorAdapter["registerInstructions"];
  extraArtifacts?: EditorAdapter["extraArtifacts"];
}

const noop = () => {};
const alwaysFalse = () => false;

/**
 * Build an `EditorAdapter` from a partial init object. Fills in
 * defaults so each adapter only declares what's actually different.
 */
export function defineAdapter(init: EditorAdapterInit): EditorAdapter {
  return {
    id: init.id,
    label: init.label,
    displayName: init.displayName,
    detect: init.detect,
    commandFilePath: init.commandFilePath,
    formatCommand: init.formatCommand,
    supportsMcp: init.supportsMcp ?? true,
    projectRulesPath:
      init.projectRulesPath ?? ((root) => join(root, "AGENTS.md")),
    isMcpInstalled: init.isMcpInstalled ?? alwaysFalse,
    installMcp: init.installMcp ?? noop,
    removeMcp: init.removeMcp ?? noop,
    registerInstructions: init.registerInstructions,
    extraArtifacts: init.extraArtifacts,
  };
}

// ─── Claude Code adapter ─────────────────────────────────────────────────

export function formatClaudeCommand(meta: CommandMeta): string {
  return `---
name: ${escapeYamlValue(meta.name)}
description: ${escapeYamlValue(meta.description)}
category: ${escapeYamlValue(meta.category)}
tags: ${formatTagsArray(meta.tags)}
---

${meta.body}
`;
}

export function getClaudeCommandPath(id: string): string {
  return join(".claude", "commands", "opsx", `${id}.md`);
}

export function hasClaudeCode(projectRoot: string): boolean {
  return existsSync(join(projectRoot, ".claude"));
}

// ─── OpenCode adapter ────────────────────────────────────────────────────

export function formatOpenCodeCommand(meta: CommandMeta): string {
  const body = transformToHyphenCommands(meta.body);
  return `---
description: ${escapeYamlValue(meta.description)}
---

${body}
`;
}

export function getOpenCodeCommandPath(id: string): string {
  return join(".opencode", "commands", `opsx-${id}.md`);
}

export function hasOpenCode(projectRoot: string): boolean {
  return existsSync(join(projectRoot, ".opencode"));
}

const JSONC_FORMAT: FormattingOptions = { tabSize: 2, insertSpaces: true };

/** Find the first existing opencode.json(c), or null. */
function findOpenCodeConfig(
  projectRoot: string,
): { path: string; text: string } | null {
  for (const name of ["opencode.jsonc", "opencode.json"]) {
    const p = join(projectRoot, name);
    if (existsSync(p)) return { path: p, text: readFileSync(p, "utf-8") };
  }
  return null;
}

/**
 * Set a value at a JSON path inside opencode.json(c), creating the file
 * with a `$schema` scaffold if it doesn't exist. Replaces any existing
 * value at the path (does not merge arrays).
 */
function setOpenCodeValue(
  projectRoot: string,
  keySegments: string[],
  value: unknown,
): void {
  const existing = findOpenCodeConfig(projectRoot);
  const targetPath = existing?.path ?? join(projectRoot, "opencode.jsonc");

  if (!existing) {
    const scaffold: Record<string, unknown> = {
      $schema: "https://opencode.ai/config.json",
    };
    // Build nested scaffold for multi-segment keys (e.g. ["mcp", "playwright"])
    let cursor: Record<string, unknown> = scaffold;
    for (let i = 0; i < keySegments.length - 1; i++) {
      const k = String(keySegments[i]);
      cursor[k] = {};
      cursor = cursor[k] as Record<string, unknown>;
    }
    cursor[String(keySegments[keySegments.length - 1])] = value;
    // ponytail: new file uses 2-space indent; modify branch preserves existing formatting.
    writeFileSync(targetPath, JSON.stringify(scaffold, null, 2) + "\n");
    return;
  }

  const edits = modify(existing.text, keySegments, value, {
    formattingOptions: JSONC_FORMAT,
  });
  writeFileSync(targetPath, applyEdits(existing.text, edits));
}

/** Read the current value at a JSON path (returns undefined if missing). */
function readOpenCodeValue(
  text: string,
  keySegments: string[],
): unknown {
  try {
    const tree = parseJsonc(text);
    if (!tree) return undefined;
    const node = findNodeAtLocation(tree, keySegments);
    return node ? getNodeValue(node) : undefined;
  } catch {
    return undefined;
  }
}

/** Read the current `instructions` array from opencode.json(c), or undefined. */
function readOpenCodeInstructions(projectRoot: string): string[] | undefined {
  const config = findOpenCodeConfig(projectRoot);
  if (!config) return undefined;
  const value = readOpenCodeValue(config.text, ["instructions"]);
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return value as string[];
  }
  return undefined;
}

// ─── Cline adapter ───────────────────────────────────────────────────────

/**
 * Cline stores project-level config in `.cline/` (skills/, rules/, mcp.json).
 * `.clinerules/` is the legacy rules-only directory, still auto-detected.
 *
 * Conventions follow the Cline documentation (2026):
 *   - Skills:   `.cline/skills/<name>/SKILL.md` with YAML frontmatter
 *                (name + description). Triggered via `/<name>` slash command.
 *   - MCP:      `.cline/mcp.json` with `{ "mcpServers": { ... } }` structure.
 *   - Rules:    Cline auto-detects `AGENTS.md` — no wrapper file needed.
 */
export function formatClineCommand(meta: CommandMeta): string {
  const body = transformToHyphenCommands(meta.body);
  const skillName = `opsx-${meta.id}`;
  return `---
name: ${escapeYamlValue(skillName)}
description: ${escapeYamlValue(meta.description)}
---

${body}
`;
}

export function getClineCommandPath(id: string): string {
  return join(".cline", "skills", `opsx-${id}`, "SKILL.md");
}

export function hasCline(projectRoot: string): boolean {
  return (
    existsSync(join(projectRoot, ".cline")) ||
    existsSync(join(projectRoot, ".clinerules"))
  );
}

// ─── Shared mcpServers JSON helpers (Cline + Cursor) ─────────────────────

export interface McpStdioServer {
  command: string;
  args: string[];
}

export type McpServersFile = Record<string, unknown> & {
  mcpServers: Record<string, McpStdioServer>;
};

/**
 * Read an MCP config file with a top-level `mcpServers` map, or null if
 * missing/unparseable. Preserves unknown top-level fields.
 */
export function readMcpServersFile(configPath: string): McpServersFile | null {
  if (!existsSync(configPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8")) as Record<
      string,
      unknown
    >;
    if (raw.mcpServers && typeof raw.mcpServers === "object") {
      return raw as McpServersFile;
    }
    raw.mcpServers = {};
    return raw as McpServersFile;
  } catch {
    return null;
  }
}

/** Write an MCP config file, creating parent directories if needed. */
export function writeMcpServersFile(
  configPath: string,
  config: McpServersFile,
): void {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

export function isMcpServerInFile(
  configPath: string,
  serverName: string,
): boolean {
  const config = readMcpServersFile(configPath);
  if (!config) return false;
  return config.mcpServers[serverName] !== undefined;
}

export function installMcpServerInFile(
  configPath: string,
  serverName: string,
  command: string[],
): void {
  const config = readMcpServersFile(configPath) ?? { mcpServers: {} };
  config.mcpServers[serverName] = {
    command: command[0],
    args: command.slice(1),
  };
  writeMcpServersFile(configPath, config);
}

export function removeMcpServerFromFile(
  configPath: string,
  serverName: string,
): void {
  const config = readMcpServersFile(configPath);
  if (!config) return;
  if (config.mcpServers[serverName] === undefined) return;
  delete config.mcpServers[serverName];
  writeMcpServersFile(configPath, config);
}

/** Path to the project-level MCP config file for Cline. */
function clineMcpPath(projectRoot: string): string {
  return join(projectRoot, ".cline", "mcp.json");
}

/** Path to the project-level MCP config file for Cursor. */
function cursorMcpPath(projectRoot: string): string {
  return join(projectRoot, ".cursor", "mcp.json");
}

/** Path to the project-level MCP config file for Oh My Pi. */
function ompMcpPath(projectRoot: string): string {
  return join(projectRoot, ".omp", "mcp.json");
}

// ─── Cursor adapter (format / paths) ─────────────────────────────────────

/**
 * Cursor slash commands are plain markdown (no frontmatter); the filename
 * is the command name. `$1` is the change-name argument.
 */
export function formatCursorCommand(meta: CommandMeta): string {
  const body = transformToHyphenCommands(meta.body);
  return `<!-- Change name: $1 (e.g. /opsx-${meta.id} my-change) -->

${body}
`;
}

export function getCursorCommandPath(id: string): string {
  return join(".cursor", "commands", `opsx-${id}.md`);
}

export function getCursorSkillPath(id: string): string {
  return join(".cursor", "skills", `opsx-${id}`, "SKILL.md");
}

/**
 * Cursor Agent Skill — explicit invocation only (`disable-model-invocation`).
 * No `$1` placeholders (those belong to the slash command file).
 */
export function formatCursorSkill(meta: CommandMeta): string {
  const body = transformToHyphenCommands(meta.body);
  const skillName = `opsx-${meta.id}`;
  return `---
name: ${escapeYamlValue(skillName)}
description: ${escapeYamlValue(meta.description)}
disable-model-invocation: true
---

${body}
`;
}

export function hasCursor(projectRoot: string): boolean {
  return existsSync(join(projectRoot, ".cursor"));
}

// ─── Pi adapter ──────────────────────────────────────────────────────────

/**
 * Pi stores project resources in `.pi/` (skills/, prompts/, extensions/).
 * Prompt templates are Markdown with optional YAML frontmatter; the
 * filename becomes the slash command name (`opsx-e2e.md` → `/opsx-e2e`),
 * `description` feeds autocomplete, and `argument-hint` shows expected
 * arguments. `$1` / `$ARGUMENTS` placeholders expand at prompt time.
 *
 * Conventions follow the Pi docs (packages/coding-agent/docs):
 *   - Prompts:   `.pi/prompts/*.md`, invoked via `/name`.
 *   - Skills:    `.pi/skills/` (root `.md` files or `SKILL.md` dirs),
 *                invoked via `/skill:name`.
 *   - Rules:     Pi loads `AGENTS.md` (or `CLAUDE.md`) walking up from cwd
 *                natively — no wrapper file needed.
 *   - MCP:       Pi has NO MCP client (built-in tools only). The adapter
 *                still implements the interface with no-ops and declares
 *                `supportsMcp: false` so shared MCP phases skip it.
 */
export function formatPiCommand(meta: CommandMeta): string {
  const body = transformToHyphenCommands(meta.body);
  return `---
description: ${escapeYamlValue(meta.description)}
argument-hint: "<change-name>"
---

${body}
`;
}

export function getPiCommandPath(id: string): string {
  return join(".pi", "prompts", `opsx-${id}.md`);
}

/**
 * True when Pi is in use: a project `.pi/` dir, or a global Pi config dir
 * (`~/.pi/agent/`, created by Pi on first run). The home signal lets
 * `openspec-pw init` detect Pi in a fresh project that has no `.pi/` yet.
 */
export function hasPi(
  projectRoot: string,
  homeDir = homedir(),
): boolean {
  return (
    existsSync(join(projectRoot, ".pi")) ||
    existsSync(join(homeDir, ".pi", "agent"))
  );
}

// ─── Oh My Pi adapter ────────────────────────────────────────────────────

/**
 * Oh My Pi (omp) stores project slash commands in `.omp/commands/*.md`
 * (non-recursive scan, project before user). Native commands are parsed
 * with FATAL frontmatter parsing, so the YAML must be valid; `name`
 * overrides the filename and `description` feeds autocomplete. `$1` /
 * `$ARGUMENTS` placeholders expand at prompt time.
 *
 * Conventions follow the omp docs (docs/slash-command-internals.md,
 * docs/mcp-config.md):
 *   - Commands:  `.omp/commands/*.md`, invoked via `/name`.
 *   - MCP:       `.omp/mcp.json` with `{ "mcpServers": { ... } }` — same
 *                shape as Cline/Cursor. omp also inherits `.claude/` /
 *                `.cursor/` / opencode MCP configs when present.
 *   - Rules:     omp reads `AGENTS.md` natively — no wrapper file needed.
 */
export function formatOmpCommand(meta: CommandMeta): string {
  const body = transformToHyphenCommands(meta.body);
  const cmdName = `opsx-${meta.id}`;
  return `---
name: ${escapeYamlValue(cmdName)}
description: ${escapeYamlValue(meta.description)}
---

${body}
`;
}

export function getOmpCommandPath(id: string): string {
  return join(".omp", "commands", `opsx-${id}.md`);
}

/**
 * True when Oh My Pi is in use: a project `.omp/` dir, or a global omp
 * config dir (`~/.omp/agent/`, created by omp on first run).
 */
export function hasOmp(
  projectRoot: string,
  homeDir = homedir(),
): boolean {
  return (
    existsSync(join(projectRoot, ".omp")) ||
    existsSync(join(homeDir, ".omp", "agent"))
  );
}

// ─── DeepSeek Harness adapter ────────────────────────────────────────────

/**
 * DeepSeek Harness (dsh) stores project skills in `.dsh/skills/` — the
 * `project-dsh` local provider root, rank 100 (highest local priority).
 * Skills are directory bundles (`<name>/SKILL.md`) with YAML frontmatter
 * (name + description); the kebab-case name becomes the model-invocable
 * skill name (`opsx-e2e`).
 *
 * Conventions follow the dsh skills subsystem (docs/subsystems/skills.md):
 *   - Skills:   `.dsh/skills/<name>/SKILL.md`, invoked via the `skill` tool.
 *   - Rules:    dsh reads `AGENTS.md` / `CLAUDE.md` natively (default
 *               instructionFileCandidates) — no wrapper file needed.
 *   - MCP:      dsh configures MCP via `cordis.yml` plugin config
 *               (@deepseek-ai/dsh-mcp-client), not a simple mcpServers file —
 *               the adapter declares `supportsMcp: false` so shared MCP phases
 *               skip it (configure Playwright MCP manually in cordis.yml).
 *   - Detected via `.dsh/` or the global `~/.dsh/` (DSH_HOME).
 */
export function formatDshCommand(meta: CommandMeta): string {
  const body = transformToHyphenCommands(meta.body);
  const skillName = `opsx-${meta.id}`;
  return `---
name: ${escapeYamlValue(skillName)}
description: ${escapeYamlValue(meta.description)}
---

${body}
`;
}

export function getDshCommandPath(id: string): string {
  return join(".dsh", "skills", `opsx-${id}`, "SKILL.md");
}

/**
 * True when DeepSeek Harness is in use: a project `.dsh/` dir, or the global
 * dsh home (`~/.dsh/`, DSH_HOME). The home signal lets `openspec-pw init`
 * detect dsh in a fresh project that has no `.dsh/` yet.
 */
export function hasDsh(
  projectRoot: string,
  homeDir = homedir(),
): boolean {
  return (
    existsSync(join(projectRoot, ".dsh")) ||
    existsSync(join(homeDir, ".dsh"))
  );
}

// ─── Registry ────────────────────────────────────────────────────────────

const ADAPTERS: EditorAdapter[] = [
  // Adapters are registered after const declarations at the bottom of this file.
];

// ─── Tool selection (--tools flag) ───────────────────────────────────────

/** Aliases accepted by `--tools` in addition to canonical EditorIds. */
const TOOL_ID_ALIASES: Record<string, EditorId> = {
  "oh-my-pi": "omp",
};

const RESERVED_TOOLS = new Set(["all", "none"]);

/**
 * Parse the `--tools` flag value for `openspec-pw init`.
 *
 * Returns the selected editor ids, or `null` when the flag was not provided.
 * Mirrors the upstream OpenSpec `openspec init --tools` semantics:
 *   - "all" → every registered editor
 *   - "none" → no editors
 *   - comma-separated ids, case-insensitive; "oh-my-pi" aliases "omp"
 *   - mixing "all"/"none" with specific ids, or unknown ids, throw
 *   - duplicate ids are deduplicated preserving first-occurrence order
 */
export function resolveToolsArg(
  toolsArg: string | undefined,
): EditorId[] | null {
  if (typeof toolsArg === "undefined") return null;

  const raw = toolsArg.trim();
  if (raw.length === 0) {
    throw new Error(
      'The --tools option requires a value. Use "all", "none", or a comma-separated list of editor ids.',
    );
  }

  const editorIds = ADAPTERS.map((a) => a.id);
  const availableList = ["all", "none", ...editorIds].join(", ");

  const lowerRaw = raw.toLowerCase();
  if (lowerRaw === "all") return [...editorIds];
  if (lowerRaw === "none") return [];

  const tokens = raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) {
    throw new Error(
      'The --tools option requires at least one editor id when not using "all" or "none".',
    );
  }

  const normalized: string[] = tokens.map((t) => {
    const lower = t.toLowerCase();
    return TOOL_ID_ALIASES[lower] ?? lower;
  });

  if (normalized.some((t) => RESERVED_TOOLS.has(t))) {
    throw new Error(
      'Cannot combine reserved values "all" or "none" with specific editor ids.',
    );
  }

  const invalid = normalized.filter((t) => !editorIds.includes(t as EditorId));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid tool id(s): ${invalid.join(", ")}. Available values: ${availableList}`,
    );
  }

  // Deduplicate while preserving order
  const deduped: EditorId[] = [];
  for (const id of normalized) {
    const editorId = id as EditorId;
    if (!deduped.includes(editorId)) deduped.push(editorId);
  }
  return deduped;
}

export function getAdapter(id: EditorId): EditorAdapter | undefined {
  return ADAPTERS.find((a) => a.id === id);
}

/** All registered editors, regardless of detection. */
export function getAllAdapters(): EditorAdapter[] {
  return [...ADAPTERS];
}

export function detectAdapters(
  projectRoot: string,
  homeDir?: string,
): EditorAdapter[] {
  return ADAPTERS.filter((a) => a.detect(projectRoot, homeDir));
}

function registerAdapter(adapter: EditorAdapter): void {
  ADAPTERS.push(adapter);
}

/** Slash-command hint for user-facing messages. */
export function slashCommandForAdapter(adapter: EditorAdapter): string {
  return adapter.id === "claude" ? "/opsx:e2e" : "/opsx-e2e";
}

/** Relative paths installCommand writes for this adapter + meta. */
export function listCommandArtifactPaths(
  adapter: EditorAdapter,
  meta: CommandMeta,
): string[] {
  const paths = [adapter.commandFilePath(meta.id)];
  for (const extra of adapter.extraArtifacts?.(meta) ?? []) {
    paths.push(extra.relativePath);
  }
  return paths;
}

// ─── Install helpers ─────────────────────────────────────────────────────

/** Install the command file (and optional extraArtifacts) for one adapter. */
export function installCommand(
  adapter: EditorAdapter,
  meta: CommandMeta,
  projectRoot: string,
): void {
  const relPath = adapter.commandFilePath(meta.id);
  const absPath = pathResolve(projectRoot, relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, adapter.formatCommand(meta));
  console.log(chalk.green(`  ✓ ${adapter.label}: ${relPath}`));

  for (const extra of adapter.extraArtifacts?.(meta) ?? []) {
    const extraAbs = pathResolve(projectRoot, extra.relativePath);
    mkdirSync(dirname(extraAbs), { recursive: true });
    writeFileSync(extraAbs, extra.contents);
    console.log(chalk.green(`  ✓ ${adapter.label}: ${extra.relativePath}`));
  }
}

// ─── Project rules file (CLAUDE.md / AGENTS.md) ──────────────────────────

/**
 * Read the OPENSPEC marker block from a rules file, or `null` when the file
 * is missing / has no markers. Used by drift detection and update to decide
 * whether a rules file needs rewriting.
 */
export function readOpenSpecBlock(projectRoot: string, adapter: EditorAdapter): string | null {
  const dest = adapter.projectRulesPath(projectRoot);
  if (!existsSync(dest)) return null;
  const content = readFileSync(dest, "utf-8");
  const startIdx = content.indexOf("<!-- OPENSPEC:START -->");
  const endIdx = content.indexOf("<!-- OPENSPEC:END -->");
  if (startIdx === -1 || endIdx === -1) return null;
  return content.slice(startIdx + "<!-- OPENSPEC:START -->".length, endIdx).trim();
}

/**
 * Whether a rules file's OPENSPEC block matches the expected content.
 * A missing file or absent/truncated markers counts as "does not match"
 * (the caller will rewrite it), which keeps update idempotent but safe.
 */
export function blockMatchesExpected(
  projectRoot: string,
  adapter: EditorAdapter,
  expected: string,
): boolean {
  const block = readOpenSpecBlock(projectRoot, adapter);
  if (block === null) return false;
  return block === expected.trim();
}

/**
 * Install employee-grade standards into the editor's rules file
 * (CLAUDE.md for Claude, AGENTS.md for OpenCode, Cline, and Cursor). Wraps content in
 * `<!-- OPENSPEC:START -->` / `<!-- OPENSPEC:END -->` markers so future
 * updates can replace the block without touching the rest of the file.
 */
export function installOpenSpecBlock(
  projectRoot: string,
  standardsContent: string,
  adapter: EditorAdapter = claudeAdapter,
): void {
  const dest = adapter.projectRulesPath(projectRoot);
  const fileLabel = basename(dest);
  const markerStart = "<!-- OPENSPEC:START -->";
  const markerEnd = "<!-- OPENSPEC:END -->";

  if (!existsSync(dest)) {
    const projName = projectRoot.split("/").pop() ?? "Project";
    const content = `# ${projName}\n\n${markerStart}\n\n${standardsContent.trim()}\n\n${markerEnd}\n`;
    writeFileSync(dest, content);
    console.log(
      chalk.green(`  ✓ ${fileLabel}: created with employee-grade standards`),
    );
    return;
  }

  const existing = readFileSync(dest, "utf-8");
  const hasStart = existing.includes(markerStart);
  const hasEnd = existing.includes(markerEnd);

  if (hasStart && hasEnd) {
    const startIdx = existing.indexOf(markerStart);
    const endIdx = existing.indexOf(markerEnd) + markerEnd.length;
    const before = existing.slice(0, startIdx).trimEnd();
    const after = existing.slice(endIdx);
    const updated =
      before +
      "\n" +
      markerStart +
      "\n\n" +
      standardsContent.trim() +
      "\n\n" +
      markerEnd +
      after;
    writeFileSync(dest, updated);
    console.log(
      chalk.green(
        `  ✓ ${fileLabel}: updated employee-grade standards (markers preserved, content refreshed)`,
      ),
    );
  } else if (!hasStart && !hasEnd) {
    const updated =
      existing.trim() +
      "\n\n" +
      markerStart +
      "\n\n" +
      standardsContent.trim() +
      "\n\n" +
      markerEnd +
      "\n";
    writeFileSync(dest, updated);
    console.log(
      chalk.green(`  ✓ ${fileLabel}: appended employee-grade standards with markers`),
    );
  } else {
    // Incomplete markers (only START, or only END) — corrupted tool territory.
    // Keep everything before the first marker (user content), discard the
    // truncated tool output after it, and write a clean complete block so
    // `doctor`/`update` converge instead of dead-ending on a skipped file.
    const firstIdx = hasStart
      ? existing.indexOf(markerStart)
      : existing.indexOf(markerEnd);
    const header = existing.slice(0, firstIdx).trimEnd();
    const updated =
      header +
      "\n\n" +
      markerStart +
      "\n\n" +
      standardsContent.trim() +
      "\n\n" +
      markerEnd +
      "\n";
    writeFileSync(dest, updated);
    console.log(
      chalk.green(
        `  ✓ ${fileLabel}: repaired incomplete OPENSPEC markers with employee-grade standards`,
      ),
    );
  }
}

/**
 * CodeGraph-first guidance prepended to the Claude wrapper so the model sees
 * it in the main rules file instead of relying on the AGENTS.md import
 * (imported content ranks lower and is treated as optional by the model).
 */
const CODE_GRAPH_FIRST_BLOCK = `## CodeGraph 优先 🔴

存在 \`.codegraph/\` 时：结构性任务（定位定义、调用链、影响面、流程）**默认第一步**调用 \`codegraph_explore\`，直接用结果回答，不要先 grep/read；grep/read 仅用于字面文本、已打开文件、或结果不足时补查。不派子 agent 重建索引。无 \`.codegraph/\` 跳过。`;

/**
 * The expected OPENSPEC block content for a thin CLAUDE.md wrapper
 * (CodeGraph-first guidance + `@AGENTS.md` import). Exported so drift
 * detection / update can compare against it.
 *
 * The `@AGENTS.md` line is Claude Code's documented way to reuse AGENTS.md
 * inside CLAUDE.md — AGENTS.md is NOT read by default ("Claude Code reads
 * CLAUDE.md, not AGENTS.md"). Contract per
 * https://code.claude.com/docs/en/memory.md:
 * - Position is irrelevant — the doc says "@ ... anywhere in your CLAUDE.md"
 *   (examples even inline it mid-sentence or in a list item). The one real
 *   constraint: the `@` line must NOT sit inside a code span (backticks) or
 *   a fenced code block — the resolver skips those. This wrapper keeps the
 *   import at the end of the block as a bare line.
 * - The path resolves relative to the importing CLAUDE.md; import recursion
 *   is capped at 4 hops.
 * - Block-level HTML comments (`<!-- ... -->`) are stripped before context
 *   injection, so the OPENSPEC markers vanish while the live `@AGENTS.md`
 *   line inside them is still honored.
 */
export function claudeWrapperStandardsContent(): string {
  return `${CODE_GRAPH_FIRST_BLOCK}\n\n@AGENTS.md\n`;
}

/**
 * Install a thin CLAUDE.md that imports AGENTS.md.
 *
 * Uses the same OPENSPEC:START/END markers as the full standards block so
 * `cleanProjectRules` can remove it uniformly. The CodeGraph-first block is
 * written directly into CLAUDE.md (before the @AGENTS.md import) so Claude
 * Code picks it up without depending on the import.
 *
 * Also handles migration: if CLAUDE.md has an existing OPENSPEC:START block
 * (old format that wrote standards directly to CLAUDE.md), calling
 * `installOpenSpecBlock` replaces the content with the CodeGraph block +
 * `@AGENTS.md` import.
 */
export function installClaudeWrapper(projectRoot: string): void {
  const dest = join(projectRoot, "CLAUDE.md");

  // CLAUDE.md symlinked (typically → AGENTS.md, the officially documented
  // reuse pattern): AGENTS.md itself is what Claude Code reads, and
  // installProjectRules already keeps the full standards in it. Writing a
  // wrapper here would overwrite them through the symlink (and the wrapper's
  // @AGENTS.md import would self-reference). Skip instead.
  if (existsSync(dest)) {
    if (lstatSync(dest).isSymbolicLink()) {
      console.log(
        chalk.gray(
          "  - CLAUDE.md is a symlink to AGENTS.md — standards live there, no wrapper needed",
        ),
      );
      return;
    }
  }

  // No-op if our full wrapper (CodeGraph block + @AGENTS.md import) is already
  // in place — content-equal, so a user edit inside the markers is detected.
  // A bare @AGENTS.md without our markers (added by openspec CLI or the user)
  // is left untouched — but tell the user CodeGraph-first won't be written.
  if (existsSync(dest)) {
    const existing = readFileSync(dest, "utf-8");
    const hasMarkers = existing.includes("<!-- OPENSPEC:START -->");
    if (!hasMarkers && /^@AGENTS\.md\r?$/m.test(existing)) {
      console.log(
        chalk.yellow(
          "  ⚠ CLAUDE.md 是裸 @AGENTS.md 导入（无 OPENSPEC 标记），CodeGraph 优先约束未写入。如需启用：删除该行后重跑 openspec-pw update。",
        ),
      );
      return;
    }
    if (hasMarkers && blockMatchesExpected(projectRoot, claudeAdapter, claudeWrapperStandardsContent())) {
      return;
    }
  }

  // Delegate to installOpenSpecBlock which handles create/update/append
  // with OPENSPEC:START/END markers.
  installOpenSpecBlock(
    projectRoot,
    claudeWrapperStandardsContent(),
    claudeAdapter,
  );
}

/**
 * Route employee-grade standards into project rules files.
 *
 * AGENTS.md is always the single source of truth, regardless of which
 * editors are detected. If Claude is in use, a thin CLAUDE.md wrapper
 * with `@AGENTS.md` import is created so Claude loads AGENTS.md as
 * its project rules. Cline and Cursor auto-detect AGENTS.md natively — no
 * wrapper needed.
 */
export function installProjectRules(
  projectRoot: string,
  standardsContent: string,
  detected: EditorAdapter[],
): void {
  if (detected.length === 0) return;

  // AGENTS.md is always the single source of truth
  installOpenSpecBlock(projectRoot, standardsContent, opencodeAdapter);

  // Thin CLAUDE.md with @AGENTS.md import if Claude is in use
  if (detected.some((a) => a.id === "claude")) {
    installClaudeWrapper(projectRoot);
  }

  // Register AGENTS.md in opencode.json for OpenCode
  if (detected.some((a) => a.id === "opencode") && opencodeAdapter.registerInstructions) {
    const existing = readOpenCodeInstructions(projectRoot);
    const next = Array.from(new Set([...(existing ?? []), "AGENTS.md"]));
    opencodeAdapter.registerInstructions(projectRoot, next);
  }
}

/** Remove all OpenSpec marker blocks from AGENTS.md (always) and CLAUDE.md (for claude adapter). */
export function cleanProjectRules(adapter: EditorAdapter, projectRoot: string): void {
  // AGENTS.md always has the employee standards (SSOT)
  removeMarkersFromFile(join(projectRoot, "AGENTS.md"), "AGENTS.md");

  // CLAUDE.md may have the wrapper import if Claude is detected
  if (adapter.id === "claude") {
    removeMarkersFromFile(adapter.projectRulesPath(projectRoot), basename(adapter.projectRulesPath(projectRoot)));
  }
}

/** Remove OpenSpec marker blocks from a single file. Only edits within markers. */
function removeMarkersFromFile(dest: string, fileLabel: string): void {
  if (!existsSync(dest)) {
    console.log(chalk.gray(`  - ${fileLabel} not found, skipping`));
    return;
  }
  const existing = readFileSync(dest, "utf-8");

  if (!existing.includes("<!-- OPENSPEC:START -->")) {
    console.log(chalk.gray(`  - No OpenSpec markers found in ${fileLabel}`));
    return;
  }

  // Remove markers and their content, consuming surrounding whitespace.
  // Then collapse runs of 3+ blank lines to at most 2 for a clean result.
  let updated = existing.replace(
    /\s*<!-- OPENSPEC:START -->[\s\S]*?<!-- OPENSPEC:END -->\s*/g,
    "\n\n",
  ).replace(/\n{3,}/g, "\n\n").trim();

  // Delete empty file rather than leaving a ghost.
  if (updated === "") {
    rmSync(dest);
    console.log(chalk.green(`  ✓ Removed empty ${fileLabel}`));
    return;
  }

  writeFileSync(dest, updated + "\n");
  console.log(chalk.green(`  ✓ Removed OpenSpec markers from ${fileLabel}`));
}

/** Read the employee-grade standards source file (empty string if missing). */
export function readEmployeeStandards(srcPath: string): string {
  return existsSync(srcPath) ? readFileSync(srcPath, "utf-8") : "";
}

// ─── Adapter instances (registered after helpers above are defined) ──────
//
// We declare them here (not at the top) so they can reference the helper
// functions defined in this same module. JS hoisting covers `function`
// declarations; `const` arrows don't get hoisted, so the order matters.

export const claudeAdapter: EditorAdapter = defineAdapter({
  id: "claude",
  label: "claude",
  displayName: "Claude Code",
  detect: hasClaudeCode,
  commandFilePath: getClaudeCommandPath,
  formatCommand: formatClaudeCommand,
  // Claude Code reads CLAUDE.md directly — override the AGENTS.md default.
  projectRulesPath: (root) => join(root, "CLAUDE.md"),
  isMcpInstalled(root, serverName) {
    // Project scope: Playwright MCP lives in the project-root .mcp.json.
    // Read the file directly instead of `claude mcp list` — zero CLI
    // dependency, testable, and never confuses a global user-scope entry
    // with a project-scoped one.
    try {
      const mcpJson = readFileSync(join(root, ".mcp.json"), "utf-8");
      const parsed = JSON.parse(mcpJson);
      return (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof parsed.mcpServers === "object" &&
        parsed.mcpServers !== null &&
        Object.hasOwn(parsed.mcpServers, serverName)
      );
    } catch {
      // Missing or unparseable file — server not installed
      return false;
    }
  },
  installMcp(_root, serverName, command) {
    execFileSync(
      "claude",
      ["mcp", "add", "--scope", "project", serverName, ...command],
      {
        encoding: "utf-8",
        timeout: TIMEOUT.MCP_LIST,
        stdio: ["pipe", "pipe", "pipe"],
        shell: needsShell,
      },
    );
  },
  removeMcp(_root, serverName) {
    execFileSync(
      "claude",
      ["mcp", "remove", "--scope", "project", serverName],
      {
        encoding: "utf-8",
        timeout: TIMEOUT.MCP_LIST,
        stdio: ["pipe", "pipe", "pipe"],
        shell: needsShell,
      },
    );
  },
});

export const opencodeAdapter: EditorAdapter = defineAdapter({
  id: "opencode",
  label: "opencode",
  displayName: "OpenCode",
  detect: hasOpenCode,
  commandFilePath: getOpenCodeCommandPath,
  formatCommand: formatOpenCodeCommand,
  // AGENTS.md is the default; not declared explicitly.
  isMcpInstalled(projectRoot, serverName) {
    const config = findOpenCodeConfig(projectRoot);
    if (!config) return false;
    const value = readOpenCodeValue(config.text, ["mcp", serverName]);
    return value !== undefined;
  },
  installMcp(projectRoot, serverName, command) {
    setOpenCodeValue(projectRoot, ["mcp", serverName], {
      type: "local",
      command,
    });
  },
  removeMcp(projectRoot, serverName) {
    // Read current mcp map, rebuild without this server, write back
    const config = findOpenCodeConfig(projectRoot);
    if (!config) return;
    const value = readOpenCodeValue(config.text, ["mcp", serverName]);
    if (value === undefined) return;
    const current = readOpenCodeValue(config.text, ["mcp"]);
    if (current && typeof current === "object") {
      const next = { ...(current as Record<string, unknown>) };
      delete next[serverName];
      setOpenCodeValue(projectRoot, ["mcp"], next);
    }
  },
  registerInstructions(projectRoot, instructions) {
    setOpenCodeValue(projectRoot, ["instructions"], instructions);
  },
});

export const clineAdapter: EditorAdapter = defineAdapter({
  id: "cline",
  label: "cline",
  displayName: "Cline",
  detect: hasCline,
  commandFilePath: getClineCommandPath,
  formatCommand: formatClineCommand,
  // Cline auto-detects AGENTS.md — that's the default.
  isMcpInstalled(projectRoot, serverName) {
    return isMcpServerInFile(clineMcpPath(projectRoot), serverName);
  },
  installMcp(projectRoot, serverName, command) {
    installMcpServerInFile(clineMcpPath(projectRoot), serverName, command);
  },
  removeMcp(projectRoot, serverName) {
    removeMcpServerFromFile(clineMcpPath(projectRoot), serverName);
  },
});

export const cursorAdapter: EditorAdapter = defineAdapter({
  id: "cursor",
  label: "cursor",
  displayName: "Cursor",
  detect: hasCursor,
  commandFilePath: getCursorCommandPath,
  formatCommand: formatCursorCommand,
  // Cursor auto-detects AGENTS.md — that's the default.
  isMcpInstalled(projectRoot, serverName) {
    return isMcpServerInFile(cursorMcpPath(projectRoot), serverName);
  },
  installMcp(projectRoot, serverName, command) {
    installMcpServerInFile(cursorMcpPath(projectRoot), serverName, command);
  },
  removeMcp(projectRoot, serverName) {
    removeMcpServerFromFile(cursorMcpPath(projectRoot), serverName);
  },
  extraArtifacts(meta) {
    return [
      {
        relativePath: getCursorSkillPath(meta.id),
        contents: formatCursorSkill(meta),
      },
    ];
  },
});

export const piAdapter: EditorAdapter = defineAdapter({
  id: "pi",
  label: "pi",
  displayName: "Pi",
  detect: hasPi,
  // Pi has no MCP client — shared MCP phases skip this adapter.
  supportsMcp: false,
  commandFilePath: getPiCommandPath,
  formatCommand: formatPiCommand,
  // Pi loads AGENTS.md natively (walking up from cwd) — that's the default.
});

export const ompAdapter: EditorAdapter = defineAdapter({
  id: "omp",
  label: "omp",
  displayName: "Oh My Pi",
  detect: hasOmp,
  commandFilePath: getOmpCommandPath,
  formatCommand: formatOmpCommand,
  // omp reads AGENTS.md natively — that's the default.
  isMcpInstalled(projectRoot, serverName) {
    return isMcpServerInFile(ompMcpPath(projectRoot), serverName);
  },
  installMcp(projectRoot, serverName, command) {
    installMcpServerInFile(ompMcpPath(projectRoot), serverName, command);
  },
  removeMcp(projectRoot, serverName) {
    removeMcpServerFromFile(ompMcpPath(projectRoot), serverName);
  },
});

export const dshAdapter: EditorAdapter = defineAdapter({
  id: "dsh",
  label: "dsh",
  displayName: "DeepSeek Harness",
  detect: hasDsh,
  // dsh configures MCP via cordis.yml plugin config, not a simple file —
  // shared MCP phases skip this adapter (configure Playwright MCP manually).
  supportsMcp: false,
  commandFilePath: getDshCommandPath,
  formatCommand: formatDshCommand,
  // dsh reads AGENTS.md natively — that's the default.
});

// Register the adapters now that the const arrows exist
registerAdapter(claudeAdapter);
registerAdapter(opencodeAdapter);
registerAdapter(clineAdapter);
registerAdapter(cursorAdapter);
registerAdapter(piAdapter);
registerAdapter(ompAdapter);
registerAdapter(dshAdapter);
