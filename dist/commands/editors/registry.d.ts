import type { CommandMeta, EditorAdapter, EditorId } from "./types.js";
export declare function getAdapter(id: EditorId): EditorAdapter | undefined;
/** All registered editors, regardless of detection. */
export declare function getAllAdapters(): EditorAdapter[];
export declare function detectAdapters(projectRoot: string, homeDir?: string): EditorAdapter[];
export declare function registerAdapter(adapter: EditorAdapter): void;
/** Slash-command hint for user-facing messages. */
export declare function slashCommandForAdapter(adapter: EditorAdapter): string;
/** Relative paths installCommand writes for this adapter + meta. */
export declare function listCommandArtifactPaths(adapter: EditorAdapter, meta: CommandMeta): string[];
/** Install the command file (and optional extraArtifacts) for one adapter. */
export declare function installCommand(adapter: EditorAdapter, meta: CommandMeta, projectRoot: string): void;
