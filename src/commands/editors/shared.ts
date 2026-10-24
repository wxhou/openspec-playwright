/**
 * Cross-editor shared helpers: YAML frontmatter escaping, command body
 * transforms, command metadata, and the mcpServers JSON file family
 * (Cline / Cursor / Oh My Pi).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { ArtifactSpec, CommandMeta } from "./types.js";

/**
 * The claude-only skill directory retired installs (pre-0.3.74) left
 * behind. Declared by the claude adapter and reused by uninstall's fixed
 * historical cleanup.
 */
export const CLAUDE_LEGACY_SKILL_REL = join(
  ".claude",
  "skills",
  "openspec-e2e",
);

// ─── YAML helpers (shared by Claude frontmatter and elsewhere) ───────────

/** Escape a value for safe inclusion in a YAML frontmatter scalar. */
export function escapeYamlValue(value: string): string {
  const needsQuoting = /[:\n\r#{}[\],&*!|>'"%@`]|^\s|\s$/.test(value);
  if (needsQuoting) {
    return quoteYamlScalar(value);
  }
  return value;
}

/**
 * Always double-quote a YAML scalar. Used for values that are conventionally
 * quoted even when safe (argument hints), so a value containing quotes or
 * backslashes cannot produce invalid YAML.
 */
function quoteYamlScalar(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
  return `"${escaped}"`;
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

// ─── Command artifact formatting ─────────────────────────────────────────

/**
 * Render one artifact from its declaration. The naming convention is the
 * single source of truth for both the invocation form and the body rewrite:
 * `hyphen-prefix` artifacts invoke as `/opsx-<id>` and get their `/opsx:`
 * references rewritten; `namespace-dir` artifacts invoke as `/opsx:<id>`
 * and keep the body unchanged.
 *
 * Frontmatter fields always emit in the order name → description →
 * argument-hint → disable-model-invocation so artifacts stay byte-stable.
 */
export function formatArtifact(spec: ArtifactSpec, meta: CommandMeta): string {
  const body =
    spec.naming === "hyphen-prefix"
      ? transformToHyphenCommands(meta.body)
      : meta.body;

  let out = "";

  // Frontmatter must be the first block in the file — an editor with fatal
  // frontmatter parsing treats anything before `---` as body text.
  if (spec.frontmatter) {
    const lines: string[] = [];
    if (spec.frontmatter.name) {
      lines.push(`name: ${escapeYamlValue(`opsx-${meta.id}`)}`);
    }
    if (spec.frontmatter.description) {
      lines.push(`description: ${escapeYamlValue(meta.description)}`);
    }
    if (spec.frontmatter.argumentHint !== undefined) {
      lines.push(`argument-hint: ${quoteYamlScalar(spec.frontmatter.argumentHint)}`);
    }
    if (spec.frontmatter.disableModelInvocation) {
      lines.push("disable-model-invocation: true");
    }
    out += `---\n${lines.join("\n")}\n---\n\n`;
  }

  if (spec.header !== undefined) {
    const header =
      typeof spec.header === "function" ? spec.header(meta) : spec.header;
    out += `${header}\n\n`;
  }

  return `${out}${body}\n`;
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
