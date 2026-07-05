/**
 * Editor adapter layer.
 *
 * Both Claude Code and OpenCode can host the /opsx:e2e command, plus a
 * project-level rules file (CLAUDE.md / AGENTS.md) and an MCP server
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
 */
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "fs";
import { execFileSync } from "node:child_process";
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

export interface EditorAdapter {
  id: "claude" | "opencode";
  /** Short label used in log messages. */
  label: string;
  /** Human-readable name used in user-facing messages. */
  displayName: string;
  /** True if this editor's config dir is present in the project. */
  detect(projectRoot: string): boolean;
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

// ─── Registry ────────────────────────────────────────────────────────────

const ADAPTERS: EditorAdapter[] = [
  // claudeAdapter is declared further down (after the shared mcp helpers)
  // We forward-define it after shared code; the registry is filled in
  // by `registerAdapter` below. See the bottom of this file.
];

export function getAdapter(id: "claude" | "opencode"): EditorAdapter | undefined {
  return ADAPTERS.find((a) => a.id === id);
}

export function detectAdapters(projectRoot: string): EditorAdapter[] {
  return ADAPTERS.filter((a) => a.detect(projectRoot));
}

function registerAdapter(adapter: EditorAdapter): void {
  ADAPTERS.push(adapter);
}

// ─── Install helpers ─────────────────────────────────────────────────────

/** Install the command file for one adapter. */
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
}

// ─── Project rules file (CLAUDE.md / AGENTS.md) ──────────────────────────

/**
 * Install employee-grade standards into the editor's rules file
 * (CLAUDE.md for Claude, AGENTS.md for OpenCode). Wraps content in
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
    console.log(
      chalk.yellow(`  ⚠ ${fileLabel} has incomplete OPENSPEC markers — skipped`),
    );
  }
}

/**
 * Install a thin CLAUDE.md that imports AGENTS.md.
 *
 * Uses the same OPENSPEC:START/END markers as the full standards block so
 * `cleanProjectRules` can remove it uniformly. No-ops if bare `@AGENTS.md`
 * is already present (may have been added by openspec CLI or manually).
 *
 * Also handles migration: if CLAUDE.md has an existing OPENSPEC:START block
 * (old format that wrote standards directly to CLAUDE.md), calling
 * `installOpenSpecBlock` replaces the content with the `@AGENTS.md` import.
 */
export function installClaudeWrapper(projectRoot: string): void {
  const dest = join(projectRoot, "CLAUDE.md");

  // No-op if bare @AGENTS.md already present (added by openspec CLI or user)
  if (existsSync(dest)) {
    const existing = readFileSync(dest, "utf-8");
    if (/^@AGENTS\.md\r?$/m.test(existing)) {
      return;
    }
  }

  // Delegate to installOpenSpecBlock which handles create/update/append
  // with OPENSPEC:START/END markers. Content is just the import line.
  // When CLAUDE.md already has OPENSPEC markers (old-format migration),
  // the existing content between them is replaced with @AGENTS.md.
  installOpenSpecBlock(projectRoot, "@AGENTS.md\n", claudeAdapter);
}

/**
 * Route employee-grade standards into project rules files.
 *
 * AGENTS.md is always the single source of truth, regardless of which
 * editors are detected. If Claude is in use, a thin CLAUDE.md wrapper
 * with `@AGENTS.md` import is created so Claude loads AGENTS.md as
 * its project rules.
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

function claudeMcpOutputIncludes(output: unknown, serverName: string): boolean {
  return String(output ?? "").includes(serverName);
}

export const claudeAdapter: EditorAdapter = {
  id: "claude",
  label: "claude",
  displayName: "Claude Code",
  detect: hasClaudeCode,
  commandFilePath: getClaudeCommandPath,
  formatCommand: formatClaudeCommand,
  projectRulesPath: (root) => join(root, "CLAUDE.md"),
  isMcpInstalled(_root, serverName) {
    try {
      const out = execFileSync("claude", ["mcp", "list"], {
        encoding: "utf-8",
        timeout: TIMEOUT.MCP_LIST,
        stdio: ["pipe", "pipe", "pipe"],
        shell: needsShell,
      });
      return claudeMcpOutputIncludes(out, serverName);
    } catch {
      // Command failed — assume server not installed
      return false;
    }
  },
  installMcp(_root, serverName, command) {
    execFileSync(
      "claude",
      ["mcp", "add", serverName, ...command],
      {
        encoding: "utf-8",
        timeout: TIMEOUT.MCP_LIST,
        stdio: ["pipe", "pipe", "pipe"],
        shell: needsShell,
      },
    );
  },
  removeMcp(_root, serverName) {
    execFileSync("claude", ["mcp", "remove", serverName], {
      encoding: "utf-8",
      timeout: TIMEOUT.MCP_LIST,
      stdio: ["pipe", "pipe", "pipe"],
      shell: needsShell,
    });
  },
};

export const opencodeAdapter: EditorAdapter = {
  id: "opencode",
  label: "opencode",
  displayName: "OpenCode",
  detect: hasOpenCode,
  commandFilePath: getOpenCodeCommandPath,
  formatCommand: formatOpenCodeCommand,
  projectRulesPath: (root) => join(root, "AGENTS.md"),
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
};

// Register the adapters now that the const arrows exist
registerAdapter(claudeAdapter);
registerAdapter(opencodeAdapter);
