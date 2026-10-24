/**
 * MCP carrier drivers. Every adapter declares how it carries MCP config
 * (`McpSpec`); this module turns that declaration into the three runtime
 * methods (`isMcpInstalled` / `installMcp` / `removeMcp`) plus the shared
 * file path used by the removal guard.
 *
 * Four carriers:
 *   - none              → no MCP client (Pi)
 *   - mcp-servers-file  → `{ "mcpServers": { ... } }` JSON (Cline, Cursor,
 *                          Oh My Pi, CodeBuddy, MiniMax)
 *   - claude-cli        → read the project `.mcp.json`, write via the CLI
 *   - opencode-json     → exclusive `opencode.json(c)` (`mcp.<server>`)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  applyEdits,
  findNodeAtLocation,
  getNodeValue,
  modify,
  parseTree as parseJsonc,
  type FormattingOptions,
} from "jsonc-parser";
import { TIMEOUT } from "../../shared/constants.js";
import { needsShell } from "../../shared/platform.js";
import type { McpSpec } from "./types.js";
import {
  installMcpServerInFile,
  isMcpServerInFile,
  removeMcpServerFromFile,
} from "./shared.js";

export interface McpRuntime {
  supportsMcp: boolean;
  /** File whose entries may be shared with another selected adapter. */
  mcpConfigPath?: (root: string) => string;
  isMcpInstalled(root: string, serverName: string): boolean;
  installMcp(root: string, serverName: string, command: string[]): void;
  removeMcp(root: string, serverName: string): void;
}

const noop = () => {};

export function buildMcpRuntime(spec: McpSpec): McpRuntime {
  switch (spec.kind) {
    case "none":
      return {
        supportsMcp: false,
        isMcpInstalled: () => false,
        installMcp: noop,
        removeMcp: noop,
      };

    case "mcp-servers-file":
      return {
        supportsMcp: true,
        mcpConfigPath: spec.path,
        isMcpInstalled(root, serverName) {
          return isMcpServerInFile(spec.path(root), serverName);
        },
        installMcp(root, serverName, command) {
          installMcpServerInFile(spec.path(root), serverName, command);
        },
        removeMcp(root, serverName) {
          removeMcpServerFromFile(spec.path(root), serverName);
        },
      };

    case "claude-cli":
      return {
        supportsMcp: true,
        // The file stays the shared-retention unit even though writes go
        // through the CLI: an entry in it serves every editor reading it.
        mcpConfigPath: spec.configPath,
        isMcpInstalled(root, serverName) {
          return isMcpServerInFile(spec.configPath(root), serverName);
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
      };

    case "opencode-json":
      return {
        supportsMcp: true,
        // opencode.json(c) is exclusive to OpenCode, so no other adapter can
        // share its entries — the retention guard never applies.
        isMcpInstalled(root, serverName) {
          const config = findOpenCodeConfig(root);
          if (!config) return false;
          return readOpenCodeValue(config.text, ["mcp", serverName]) !== undefined;
        },
        installMcp(root, serverName, command) {
          setOpenCodeValue(root, ["mcp", serverName], {
            type: "local",
            command,
          });
        },
        removeMcp(root, serverName) {
          const config = findOpenCodeConfig(root);
          if (!config) return;
          const value = readOpenCodeValue(config.text, ["mcp", serverName]);
          if (value === undefined) return;
          const current = readOpenCodeValue(config.text, ["mcp"]);
          if (current && typeof current === "object") {
            const next = { ...(current as Record<string, unknown>) };
            delete next[serverName];
            setOpenCodeValue(root, ["mcp"], next);
          }
        },
      };
  }
}

// ─── OpenCode JSONC helpers ──────────────────────────────────────────────

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
function readOpenCodeValue(text: string, keySegments: string[]): unknown {
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
export function readOpenCodeInstructions(
  projectRoot: string,
): string[] | undefined {
  const config = findOpenCodeConfig(projectRoot);
  if (!config) return undefined;
  const value = readOpenCodeValue(config.text, ["instructions"]);
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return value as string[];
  }
  return undefined;
}

/** Replace the `instructions` array in opencode.json(c). */
export function writeOpenCodeInstructions(
  projectRoot: string,
  instructions: string[],
): void {
  setOpenCodeValue(projectRoot, ["instructions"], instructions);
}
