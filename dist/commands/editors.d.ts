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
export declare function installProjectClaudeMd(projectRoot: string, standardsContent: string, adapter?: EditorAdapter): void;
/**
 * Route the employee-grade standards into the right rules file(s) for the
 * detected editors:
 *
 *   - 1 editor detected → write to that editor's rules file
 *     (CLAUDE.md for Claude, AGENTS.md for OpenCode)
 *   - 2 editors detected → write CLAUDE.md (OpenCode reads it natively)
 *     and register `CLAUDE.md` in `opencode.json[c].instructions`
 *     so OpenCode treats it as a project rule.
 */
export declare function installProjectRules(projectRoot: string, standardsContent: string, detected: EditorAdapter[]): void;
/** Remove the OPENSPEC markers block from a rules file (CLAUDE.md / AGENTS.md). */
export declare function cleanProjectRules(adapter: EditorAdapter, projectRoot: string): void;
/** Read the employee-grade standards source file (empty string if missing). */
export declare function readEmployeeStandards(srcPath: string): string;
export declare const claudeAdapter: EditorAdapter;
export declare const opencodeAdapter: EditorAdapter;
