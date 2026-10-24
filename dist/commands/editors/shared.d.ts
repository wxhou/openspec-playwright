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
/**
 * Format a skill-based command artifact: `name` + `description` frontmatter
 * over a hyphen-rewritten body.
 *
 * Shared by Cline (`.cline/skills/opsx-<id>/SKILL.md`) and MiniMax Code
 * (`.agents/skills/opsx-<id>/SKILL.md`) so the two skill formats cannot
 * drift. Editors that load skills as slash commands invoke them as
 * `/<name>` — hence the hyphenated `/opsx-` body references.
 */
export declare function formatSkillCommand(meta: CommandMeta): string;
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
