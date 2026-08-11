/** Escape a value for safe inclusion in a YAML frontmatter scalar. */
export declare function escapeYamlValue(value: string): string;
/** Format tags as a YAML inline array. */
export declare function formatTagsArray(tags: string[]): string;
/**
 * OpenCode slash-command names are hyphenated (`/opsx-e2e`), Claude's are
 * colon-prefixed (`/opsx:e2e`). Rewrite all `/opsx:` references in a
 * command body for OpenCode installation.
 */
export declare function transformToHyphenCommands(text: string): string;
export interface CommandMeta {
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    body: string;
}
/** Build the command metadata for the /opsx:e2e command. */
export declare function buildCommandMeta(body: string): CommandMeta;
export type EditorId = "claude" | "opencode" | "cline" | "cursor" | "pi" | "omp";
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
export declare function formatClaudeCommand(meta: CommandMeta): string;
export declare function getClaudeCommandPath(id: string): string;
export declare function hasClaudeCode(projectRoot: string): boolean;
export declare function formatOpenCodeCommand(meta: CommandMeta): string;
export declare function getOpenCodeCommandPath(id: string): string;
export declare function hasOpenCode(projectRoot: string): boolean;
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
export declare function formatClineCommand(meta: CommandMeta): string;
export declare function getClineCommandPath(id: string): string;
export declare function hasCline(projectRoot: string): boolean;
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
export declare function readMcpServersFile(configPath: string): McpServersFile | null;
/** Write an MCP config file, creating parent directories if needed. */
export declare function writeMcpServersFile(configPath: string, config: McpServersFile): void;
export declare function isMcpServerInFile(configPath: string, serverName: string): boolean;
export declare function installMcpServerInFile(configPath: string, serverName: string, command: string[]): void;
export declare function removeMcpServerFromFile(configPath: string, serverName: string): void;
/**
 * Cursor slash commands are plain markdown (no frontmatter); the filename
 * is the command name. `$1` is the change-name argument.
 */
export declare function formatCursorCommand(meta: CommandMeta): string;
export declare function getCursorCommandPath(id: string): string;
export declare function getCursorSkillPath(id: string): string;
/**
 * Cursor Agent Skill — explicit invocation only (`disable-model-invocation`).
 * No `$1` placeholders (those belong to the slash command file).
 */
export declare function formatCursorSkill(meta: CommandMeta): string;
export declare function hasCursor(projectRoot: string): boolean;
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
export declare function formatPiCommand(meta: CommandMeta): string;
export declare function getPiCommandPath(id: string): string;
/**
 * True when Pi is in use: a project `.pi/` dir, or a global Pi config dir
 * (`~/.pi/agent/`, created by Pi on first run). The home signal lets
 * `openspec-pw init` detect Pi in a fresh project that has no `.pi/` yet.
 */
export declare function hasPi(projectRoot: string, homeDir?: string): boolean;
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
export declare function formatOmpCommand(meta: CommandMeta): string;
export declare function getOmpCommandPath(id: string): string;
/**
 * True when Oh My Pi is in use: a project `.omp/` dir, or a global omp
 * config dir (`~/.omp/agent/`, created by omp on first run).
 */
export declare function hasOmp(projectRoot: string, homeDir?: string): boolean;
export declare function getAdapter(id: EditorId): EditorAdapter | undefined;
export declare function detectAdapters(projectRoot: string, homeDir?: string): EditorAdapter[];
/** Slash-command hint for user-facing messages. */
export declare function slashCommandForAdapter(adapter: EditorAdapter): string;
/** Relative paths installCommand writes for this adapter + meta. */
export declare function listCommandArtifactPaths(adapter: EditorAdapter, meta: CommandMeta): string[];
/** Install the command file (and optional extraArtifacts) for one adapter. */
export declare function installCommand(adapter: EditorAdapter, meta: CommandMeta, projectRoot: string): void;
/**
 * Read the OPENSPEC marker block from a rules file, or `null` when the file
 * is missing / has no markers. Used by drift detection and update to decide
 * whether a rules file needs rewriting.
 */
export declare function readOpenSpecBlock(projectRoot: string, adapter: EditorAdapter): string | null;
/**
 * Whether a rules file's OPENSPEC block matches the expected content.
 * A missing file or absent/truncated markers counts as "does not match"
 * (the caller will rewrite it), which keeps update idempotent but safe.
 */
export declare function blockMatchesExpected(projectRoot: string, adapter: EditorAdapter, expected: string): boolean;
/**
 * Install employee-grade standards into the editor's rules file
 * (CLAUDE.md for Claude, AGENTS.md for OpenCode, Cline, and Cursor). Wraps content in
 * `<!-- OPENSPEC:START -->` / `<!-- OPENSPEC:END -->` markers so future
 * updates can replace the block without touching the rest of the file.
 */
export declare function installOpenSpecBlock(projectRoot: string, standardsContent: string, adapter?: EditorAdapter): void;
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
export declare function claudeWrapperStandardsContent(): string;
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
export declare function installClaudeWrapper(projectRoot: string): void;
/**
 * Route employee-grade standards into project rules files.
 *
 * AGENTS.md is always the single source of truth, regardless of which
 * editors are detected. If Claude is in use, a thin CLAUDE.md wrapper
 * with `@AGENTS.md` import is created so Claude loads AGENTS.md as
 * its project rules. Cline and Cursor auto-detect AGENTS.md natively — no
 * wrapper needed.
 */
export declare function installProjectRules(projectRoot: string, standardsContent: string, detected: EditorAdapter[]): void;
/** Remove all OpenSpec marker blocks from AGENTS.md (always) and CLAUDE.md (for claude adapter). */
export declare function cleanProjectRules(adapter: EditorAdapter, projectRoot: string): void;
/** Read the employee-grade standards source file (empty string if missing). */
export declare function readEmployeeStandards(srcPath: string): string;
export declare const claudeAdapter: EditorAdapter;
export declare const opencodeAdapter: EditorAdapter;
export declare const clineAdapter: EditorAdapter;
export declare const cursorAdapter: EditorAdapter;
export declare const piAdapter: EditorAdapter;
export declare const ompAdapter: EditorAdapter;
