/** Record of tool name -> purpose description */
export interface McpTool {
    name: string;
    title: string;
    description: string;
    purpose: string;
}
/**
 * Download and parse the @playwright/mcp README to extract all browser_* tools.
 */
export declare function fetchMcpTools(): McpTool[];
/**
 * Update the Healer MCP tools table in SKILL.md.
 * Only syncs the 5 core Healer tools; all other MCP tools are
 * general-purpose automation not specific to healing.
 * Deduplicates by tool name.
 */
export declare function updateSkillHealerTable(skillPath: string, tools: McpTool[]): void;
/**
 * Main entry point: fetch tools and update SKILL.md.
 * Call this after installing the skill in init.ts and update.ts.
 */
export declare function syncMcpTools(skillPath: string): void;
