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
export declare function formatClaudeCommand(meta: CommandMeta): string;
export declare function getClaudeCommandPath(id: string): string;
export declare function hasClaudeCode(projectRoot: string): boolean;
export declare function formatOpenCodeCommand(meta: CommandMeta): string;
export declare function getOpenCodeCommandPath(id: string): string;
export declare function hasOpenCode(projectRoot: string): boolean;
export declare function getAdapter(id: "claude" | "opencode"): EditorAdapter | undefined;
export declare function detectAdapters(projectRoot: string): EditorAdapter[];
/** Install the command file for one adapter. */
export declare function installCommand(adapter: EditorAdapter, meta: CommandMeta, projectRoot: string): void;
/**
 * Install employee-grade standards into the editor's rules file
 * (CLAUDE.md for Claude, AGENTS.md for OpenCode). Wraps content in
 * `<!-- OPENSPEC:START -->` / `<!-- OPENSPEC:END -->` markers so future
 * updates can replace the block without touching the rest of the file.
 */
export declare function installOpenSpecBlock(projectRoot: string, standardsContent: string, adapter?: EditorAdapter): void;
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
export declare function installClaudeWrapper(projectRoot: string): void;
/**
 * Route employee-grade standards into project rules files.
 *
 * AGENTS.md is always the single source of truth, regardless of which
 * editors are detected. If Claude is in use, a thin CLAUDE.md wrapper
 * with `@AGENTS.md` import is created so Claude loads AGENTS.md as
 * its project rules.
 */
export declare function installProjectRules(projectRoot: string, standardsContent: string, detected: EditorAdapter[]): void;
/** Remove all OpenSpec marker blocks from AGENTS.md (always) and CLAUDE.md (for claude adapter). */
export declare function cleanProjectRules(adapter: EditorAdapter, projectRoot: string): void;
/** Read the employee-grade standards source file (empty string if missing). */
export declare function readEmployeeStandards(srcPath: string): string;
export declare const claudeAdapter: EditorAdapter;
export declare const opencodeAdapter: EditorAdapter;
