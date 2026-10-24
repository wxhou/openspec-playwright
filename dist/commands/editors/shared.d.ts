import type { ArtifactSpec, CommandMeta } from "./types.js";
/**
 * The claude-only skill directory retired installs (pre-0.3.74) left
 * behind. Declared by the claude adapter and reused by uninstall's fixed
 * historical cleanup.
 */
export declare const CLAUDE_LEGACY_SKILL_REL: string;
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
export declare function formatArtifact(spec: ArtifactSpec, meta: CommandMeta): string;
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
