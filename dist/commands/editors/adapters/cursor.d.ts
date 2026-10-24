import type { CommandMeta } from "../types.js";
export declare function getCursorCommandPath(id: string): string;
export declare function getCursorSkillPath(id: string): string;
export declare const cursorAdapter: import("../types.js").EditorAdapter;
export declare function formatCursorCommand(meta: CommandMeta): string;
export declare function formatCursorSkill(meta: CommandMeta): string;
export declare function hasCursor(projectRoot: string, homeDir?: string): boolean;
