import type { CommandMeta } from "../types.js";
export declare function getDshSkillPath(id: string): string;
export declare const dshAdapter: import("../types.js").EditorAdapter;
export declare function formatDshSkill(meta: CommandMeta): string;
export declare function hasDsh(projectRoot: string, homeDir?: string): boolean;
export declare function hasDshProjectSignal(projectRoot: string): boolean;
