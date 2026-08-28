import type { CommandMeta, EditorAdapter, EditorId } from "./types.js";
export declare function getAdapter(id: EditorId): EditorAdapter | undefined;
/** All registered editors, regardless of detection. */
export declare function getAllAdapters(): EditorAdapter[];
export declare function detectAdapters(projectRoot: string, homeDir?: string): EditorAdapter[];
/**
 * Project-scope detection: project-level signals only (no global config
 * dirs). This is the scope the init non-TTY fallback uses; write
 * authorization additionally requires tool-owned artifacts (see
 * hasCommandArtifacts).
 */
export declare function detectProjectAdapters(projectRoot: string): EditorAdapter[];
/**
 * True when any of the adapter's tool-owned command artifacts exist in the
 * project — the write-authorization signal ("existing artifacts are the
 * manifest"). Deliberately does NOT use detect(): a marker directory alone
 * (e.g. a hand-created `.cursor/` with the user's own config) does not
 * authorize openspec-pw writes.
 */
export declare function hasCommandArtifacts(projectRoot: string, adapter: EditorAdapter): boolean;
export declare function registerAdapter(adapter: EditorAdapter): void;
/** Slash-command hint for user-facing messages. */
export declare function slashCommandForAdapter(adapter: EditorAdapter): string;
/** Relative paths installCommand writes for this adapter + meta. */
export declare function listCommandArtifactPaths(adapter: EditorAdapter, meta: CommandMeta): string[];
/** Install the command file (and optional extraArtifacts) for one adapter. */
export declare function installCommand(adapter: EditorAdapter, meta: CommandMeta, projectRoot: string): void;
