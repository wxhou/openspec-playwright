import { type EditorAdapter, type CommandMeta } from "../types.js";
/**
 * Cursor slash commands are plain markdown (no frontmatter); the filename
 * is the command name. `$1` is the change-name argument.
 */
export declare function formatCursorCommand(meta: CommandMeta): string;
export declare function getCursorCommandPath(id: string): string;
export declare function getCursorSkillPath(id: string): string;
/**
 * Cursor Agent Skill — explicit invocation only (`disable-model-invocation`).
 * No `$1` placeholders (those belong to the slash command file).
 */
export declare function formatCursorSkill(meta: CommandMeta): string;
export declare function hasCursor(projectRoot: string): boolean;
export declare const cursorAdapter: EditorAdapter;
