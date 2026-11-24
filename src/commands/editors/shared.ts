/**
 * Cross-editor shared helpers: YAML frontmatter escaping, command body
 * transforms, command metadata, and the mcpServers JSON file family
 * (Cline / Cursor / Oh My Pi).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import type {
  ArtifactSpec,
  ArtifactStyle,
  CommandMeta,
} from "./types.js";

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

// ─── TOML helpers (Gemini CLI command files) ─────────────────────────────

/** C0 controls (except tab/newline/CR) plus DEL are invalid raw in TOML strings. */
const TOML_CONTROL_CHARS = new RegExp(
  "[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]",
  "g",
);

/** Escape a value for a single-line TOML basic string. */
export function escapeTomlBasicString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(TOML_CONTROL_CHARS, (c) =>
      `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
}

/**
 * Escape a value for a TOML multi-line basic string: raw newlines/tabs stay,
 * backslashes are doubled, CRLF is normalized, a run of three quotes would
 * terminate the string, and control characters must be escaped.
 */
export function escapeTomlMultilineBasicString(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\\/g, "\\\\")
    .replace(/"""/g, '""\\"')
    .replace(/\r/g, "\\r")
    .replace(TOML_CONTROL_CHARS, (c) =>
      `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
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

/**
 * The 2.x artifact family already uses hyphens, so its slash command is
 * `/openspec-e2e` — rewriting `/opsx:` the 1.x way would produce the wrong
 * `/opsx-e2e` name.
 */
export function transformToOpenSpecCommands(text: string): string {
  return text.replace(/\/opsx:e2e/g, "/openspec-e2e");
}

/** Frontmatter `name:` for an artifact in the given style. */
export function artifactName(id: string, style: ArtifactStyle): string {
  return style === "openspec" ? `openspec-${id}` : `opsx-${id}`;
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
export function formatArtifact(
  spec: ArtifactSpec,
  meta: CommandMeta,
  style: ArtifactStyle = "opsx",
): string {
  const body =
    style === "openspec"
      ? transformToOpenSpecCommands(meta.body)
      : spec.naming === "hyphen-prefix"
        ? transformToHyphenCommands(meta.body)
        : meta.body;

  // TOML artifacts (Gemini CLI) carry no frontmatter/header — the whole file
  // is the description/prompt pair.
  if (spec.format === "toml") {
    return `description = "${escapeTomlBasicString(meta.description)}"\n\nprompt = """\n${escapeTomlMultilineBasicString(body)}\n"""\n`;
  }

  let out = "";

  // Frontmatter must be the first block in the file — an editor with fatal
  // frontmatter parsing treats anything before `---` as body text.
  if (spec.frontmatter) {
    const lines: string[] = [];
    if (spec.frontmatter.name) {
      lines.push(`name: ${escapeYamlValue(artifactName(meta.id, style))}`);
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
  type?: string;
  command: string;
  args: string[];
}

/** A parsed JSON config whose server map lives under a configurable key. */
export type McpServersFile = Record<string, unknown>;

export interface McpServerFileOptions {
  /** Top-level map key: `mcpServers` (most editors) or `servers` (VS Code). */
  serversKey?: string;
  /** Field added to newly written entries, e.g. `stdio` for VS Code. */
  entryType?: string;
}

function serversKeyOf(options: McpServerFileOptions | undefined): string {
  return options?.serversKey ?? "mcpServers";
}

function serversMap(
  config: McpServersFile,
  serversKey: string,
): Record<string, McpStdioServer> {
  const map = config[serversKey];
  return map && typeof map === "object"
    ? (map as Record<string, McpStdioServer>)
    : {};
}

/**
 * Read an MCP config file with a top-level server map, or null if
 * missing/unparseable. Preserves unknown top-level fields.
 */
export function readMcpServersFile(
  configPath: string,
  options?: McpServerFileOptions,
): McpServersFile | null {
  if (!existsSync(configPath)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(configPath, "utf-8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const raw = parsed as McpServersFile;
    const key = serversKeyOf(options);
    const servers = raw[key];
    if (servers !== undefined) {
      // `typeof [] === "object"`, but JSON.stringify drops named properties on
      // arrays — writing into one would silently lose the entry.
      if (
        servers === null ||
        typeof servers !== "object" ||
        Array.isArray(servers)
      ) {
        return null;
      }
      return raw;
    }
    raw[key] = {};
    return raw;
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
  options?: McpServerFileOptions,
): boolean {
  const config = readMcpServersFile(configPath, options);
  if (!config) return false;
  return serversMap(config, serversKeyOf(options))[serverName] !== undefined;
}

export function installMcpServerInFile(
  configPath: string,
  serverName: string,
  command: string[],
  options?: McpServerFileOptions,
): void {
  let config: McpServersFile = {};
  if (existsSync(configPath)) {
    // A present but unparseable config is user state — refuse to replace it
    // with an empty object rather than silently losing their settings.
    const parsed = readMcpServersFile(configPath, options);
    if (parsed === null) {
      throw new Error(
        `${configPath} exists but is not a valid MCP config — refusing to overwrite it`,
      );
    }
    config = parsed;
  }
  const key = serversKeyOf(options);
  const servers = serversMap(config, key);
  // Replace only the fields this tool owns; user fields such as `env` or
  // `cwd` on an existing entry survive an upgrade. Spread only a plain
  // object — spreading a string/number would splat it into indexed keys.
  const existingEntry = servers[serverName];
  const base =
    existingEntry !== null &&
    typeof existingEntry === "object" &&
    !Array.isArray(existingEntry)
      ? existingEntry
      : {};
  servers[serverName] = {
    ...base,
    ...(options?.entryType ? { type: options.entryType } : {}),
    command: command[0],
    args: command.slice(1),
  };
  config[key] = servers;
  writeMcpServersFile(configPath, config);
}

export function removeMcpServerFromFile(
  configPath: string,
  serverName: string,
  options?: McpServerFileOptions,
): void {
  const config = readMcpServersFile(configPath, options);
  if (!config) {
    // "No file" is a quiet no-op; an unparseable file is user state we cannot
    // safely edit — surface it instead of reporting a successful removal.
    if (existsSync(configPath)) {
      throw new Error(
        `${configPath} exists but is not a valid MCP config — cannot remove ${serverName}`,
      );
    }
    return;
  }
  const key = serversKeyOf(options);
  const servers = serversMap(config, key);
  if (servers[serverName] === undefined) return;
  delete servers[serverName];
  config[key] = servers;
  writeMcpServersFile(configPath, config);
}
