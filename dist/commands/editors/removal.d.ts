import { type EditorAdapter } from "./types.js";
/**
 * The Playwright MCP servers openspec-pw manages. `playwright-test` is the
 * official test-runner server installed today; `playwright` is the legacy
 * @playwright/mcp entry older versions wrote (uninstall removes both).
 * Literals here rather than importing shared/mcp.ts, which imports the
 * editors facade that re-exports this module (import cycle).
 */
export declare const OPENSPEC_PW_MCP_SERVERS: readonly ["playwright-test", "playwright"];
/** The claude-only skill directory retired installs left behind. */
export declare const CLAUDE_LEGACY_SKILL_REL: string;
export interface AdapterArtifactInventory {
    /** Existing openspec-pw command/skill artifact paths (project-relative). */
    commandPaths: string[];
    /** Claude-only legacy skill dir, when present (project-relative). */
    legacySkillPath: string | null;
    /** openspec-pw MCP server entries present in this editor's config. */
    mcpServers: string[];
    /** True when CLAUDE.md holds an openspec-pw wrapper block (claude only). */
    hasClaudeWrapper: boolean;
}
/**
 * Enumerate the openspec-pw artifacts one editor owns in this project —
 * command/skill files (incl. extraArtifacts), MCP server entries, the
 * claude-only legacy skill dir and wrapper. Read-only and silent: this is
 * the source for init's confirmation list, so it must not write, delete,
 * or print.
 */
export declare function enumerateAdapterArtifacts(adapter: EditorAdapter, projectRoot: string): AdapterArtifactInventory;
/** True when this editor has nothing for init to remove. */
export declare function isInventoryEmpty(inv: AdapterArtifactInventory): boolean;
/**
 * Remove the openspec-pw MCP entries for one editor. Only entries passed in
 * `servers` (the enumeration result) are touched — user-owned server entries
 * in the same config file are never written to.
 */
export declare function removeAdapterMcp(adapter: EditorAdapter, projectRoot: string, servers: readonly string[]): void;
/** Delete one editor's openspec-pw command/skill files. Returns the removed project-relative paths. */
export declare function removeAdapterCommandArtifacts(adapter: EditorAdapter, projectRoot: string): string[];
/** Delete claude's retired-install skill directory. Returns the path or null. */
export declare function removeClaudeLegacySkill(projectRoot: string): string | null;
/**
 * Remove the openspec-pw wrapper block from CLAUDE.md (claude-owned
 * territory). Skips symlinked CLAUDE.md entirely — writing through the
 * symlink would strip the shared block out of AGENTS.md.
 */
export declare function removeClaudeWrapper(projectRoot: string): string | null;
/**
 * Delete empty directories up to (not including) `stopAt`. Moved here from
 * uninstall.ts so both the section loop and the per-editor removals share it.
 */
export declare function cleanupEmptyDirs(dir: string, stopAt: string): void;
