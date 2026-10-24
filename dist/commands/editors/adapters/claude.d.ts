import type { CommandMeta } from "../types.js";
export declare function getClaudeCommandPath(id: string): string;
export declare const claudeAdapter: import("../types.js").EditorAdapter;
export declare function formatClaudeCommand(meta: CommandMeta): string;
export declare function hasClaudeCode(projectRoot: string, homeDir?: string): boolean;
