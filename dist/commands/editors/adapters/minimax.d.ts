import { type EditorAdapter, type CommandMeta } from "../types.js";
/**
 * MiniMax Code conventions (verified against the published CLI runtime):
 *   - Skills:   `<root>/skills/<name>/SKILL.md` with YAML frontmatter
 *                (name + description). Workspace roots include
 *                `.minimax/skills`, `.claude/skills` and `.agents/skills`.
 *                Invoked as `/<name>`.
 *   - MCP:      project-root `.mcp.json`, auto-loaded from the workspace.
 *   - Rules:    `<workspace>/CLAUDE.md` then `<workspace>/AGENTS.md`.
 */
export declare function formatMinimaxSkill(meta: CommandMeta): string;
export declare function getMinimaxSkillPath(id: string): string;
/**
 * Detection: the project's `.minimax/` marker dir, the global CLI install
 * root, or the installed skill artifact.
 *
 * The global signal is a pre-select hint only — `projectSignal` excludes it.
 */
export declare function hasMinimax(projectRoot: string, homeDir?: string): boolean;
/** Project-level signal only: marker dir or the installed skill. */
export declare function hasMinimaxProjectSignal(projectRoot: string): boolean;
export declare const minimaxAdapter: EditorAdapter;
/**
 * Path to the MCP config file MiniMax Code loads from the project workspace.
 * Shared with the Claude Code and CodeBuddy CLI adapters — all three read
 * and write the project-root `.mcp.json`.
 */
export declare function minimaxMcpPath(projectRoot: string): string;
