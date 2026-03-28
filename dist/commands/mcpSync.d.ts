export declare const MCP_VERSION_MARKER = "<!-- MCP_VERSION:";
export declare const DEFAULT_HEALER_TOOLS: {
    name: string;
    purpose: string;
}[];
/** Extract MCP version from SKILL.md marker */
export declare function getStoredMcpVersion(skillContent: string): string | null;
/** Replace the Healer tools table in SKILL.md */
export declare function updateHealerTable(skillContent: string, version: string, tools: Array<{
    name: string;
    purpose: string;
}>): string;
/** Fetch latest @playwright/mcp version from npm registry */
export declare function getLatestMcpVersion(): Promise<string | null>;
/**
 * Fetch @playwright/mcp tools from npm package.
 * Downloads the tarball, extracts README, parses tool names.
 */
export declare function fetchMcpTools(version: string): Promise<Array<{
    name: string;
    purpose: string;
}>>;
/**
 * Sync Healer tools table in SKILL.md with latest @playwright/mcp.
 * Returns true if updated, false if already current or failed.
 */
export declare function syncMcpTools(skillDest: string, verbose?: boolean): Promise<boolean>;
