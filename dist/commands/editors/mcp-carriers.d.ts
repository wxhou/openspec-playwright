import type { McpSpec } from "./types.js";
export interface McpRuntime {
    supportsMcp: boolean;
    /** File whose entries may be shared with another selected adapter. */
    mcpConfigPath?: (root: string) => string;
    isMcpInstalled(root: string, serverName: string): boolean;
    installMcp(root: string, serverName: string, command: string[]): void;
    removeMcp(root: string, serverName: string): void;
}
export declare function buildMcpRuntime(spec: McpSpec): McpRuntime;
/** Read the current `instructions` array from opencode.json(c), or undefined. */
export declare function readOpenCodeInstructions(projectRoot: string): string[] | undefined;
/** Replace the `instructions` array in opencode.json(c). */
export declare function writeOpenCodeInstructions(projectRoot: string, instructions: string[]): void;
