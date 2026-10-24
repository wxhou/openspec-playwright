import type { CommandMeta } from "../types.js";
export declare function getOmpCommandPath(id: string): string;
export declare const ompAdapter: import("../types.js").EditorAdapter;
export declare function formatOmpCommand(meta: CommandMeta): string;
export declare function hasOmp(projectRoot: string, homeDir?: string): boolean;
