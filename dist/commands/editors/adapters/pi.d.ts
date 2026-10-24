import type { CommandMeta } from "../types.js";
export declare function getPiCommandPath(id: string): string;
export declare const piAdapter: import("../types.js").EditorAdapter;
export declare function formatPiCommand(meta: CommandMeta): string;
export declare function hasPi(projectRoot: string, homeDir?: string): boolean;
