/**
 * Core types and the `defineAdapter` factory for the editor adapter
 * layer. Zero internal dependencies — every other editors/* module may
 * import from this file.
 */
import { join } from "path";

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
   *
   * detect() is the "any scope" signal: display + interactive pre-select
   * only. It NEVER authorizes writes — use projectSignal for that.
   */
  detect(projectRoot: string, homeDir?: string): boolean;
  /**
   * Project-level signal only (marker dir inside the project). Used for
   * the init non-TTY fallback and anywhere a global dir must not count.
   * Defaults to detect() with a sentinel home so home-blind adapters
   * (claude/opencode/cline/cursor) reuse their detect() unchanged.
   */
  projectSignal?(projectRoot: string): boolean;
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
  /**
   * Optional: project-level-only detection signal. Required to differ from
   * `detect` only for adapters whose detect() also matches a global config
   * dir (pi, omp, dsh).
   */
  projectSignal?: EditorAdapter["projectSignal"];
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

// Sentinel home dir that never exists — scopes detect() to project-level
// signals for adapters that don't declare their own projectSignal (the
// home-blind adapters ignore homeDir entirely).
export const NO_HOME = "\0openspec-pw-no-home";

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
    projectSignal:
      init.projectSignal ?? ((root) => init.detect(root, NO_HOME)),
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
