import type { CommandMeta } from "../types.js";
export declare function getOpenCodeCommandPath(id: string): string;
export declare const opencodeAdapter: import("../types.js").EditorAdapter;
export declare function formatOpenCodeCommand(meta: CommandMeta): string;
export declare function hasOpenCode(projectRoot: string, homeDir?: string): boolean;
export { readOpenCodeInstructions } from "../mcp-carriers.js";
