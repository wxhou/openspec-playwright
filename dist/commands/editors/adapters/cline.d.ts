import type { CommandMeta } from "../types.js";
export declare function getClineCommandPath(id: string): string;
export declare const clineAdapter: import("../types.js").EditorAdapter;
export declare function formatClineCommand(meta: CommandMeta): string;
export declare function hasCline(projectRoot: string, homeDir?: string): boolean;
