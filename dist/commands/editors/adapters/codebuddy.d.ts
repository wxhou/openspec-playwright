import type { CommandMeta } from "../types.js";
export declare function getCodebuddyCommandPath(id: string): string;
export declare const codebuddyAdapter: import("../types.js").EditorAdapter;
export declare function formatCodebuddyCommand(meta: CommandMeta): string;
export declare function hasCodebuddy(projectRoot: string, homeDir?: string): boolean;
