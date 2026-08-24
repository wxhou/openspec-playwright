import { type EditorAdapter, type CommandMeta } from "../types.js";
export declare function formatClaudeCommand(meta: CommandMeta): string;
export declare function getClaudeCommandPath(id: string): string;
export declare function hasClaudeCode(projectRoot: string): boolean;
export declare const claudeAdapter: EditorAdapter;
