import { type EditorAdapter, type CommandMeta } from "../types.js";
export declare function formatOpenCodeCommand(meta: CommandMeta): string;
export declare function getOpenCodeCommandPath(id: string): string;
export declare function hasOpenCode(projectRoot: string): boolean;
/** Read the current `instructions` array from opencode.json(c), or undefined. */
declare function readOpenCodeInstructions(projectRoot: string): string[] | undefined;
export declare const opencodeAdapter: EditorAdapter;
export { readOpenCodeInstructions };
