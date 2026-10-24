import type { CommandMeta } from "../types.js";
export declare function getMinimaxSkillPath(id: string): string;
/**
 * Path to the MCP config file MiniMax Code loads from the project workspace.
 * Shared with the Claude Code and CodeBuddy CLI adapters — all three read
 * and write the project-root `.mcp.json`.
 */
export declare function minimaxMcpPath(projectRoot: string): string;
export declare const minimaxAdapter: import("../types.js").EditorAdapter;
export declare function formatMinimaxSkill(meta: CommandMeta): string;
/**
 * Detection: the project's `.minimax/` marker dir, the global CLI install
 * root, or the installed skill artifact.
 *
 * The global signal is a pre-select hint only — `hasMinimaxProjectSignal`
 * excludes it.
 */
export declare function hasMinimax(projectRoot: string, homeDir?: string): boolean;
/** Project-level signal only: marker dir or the installed skill. */
export declare function hasMinimaxProjectSignal(projectRoot: string): boolean;
