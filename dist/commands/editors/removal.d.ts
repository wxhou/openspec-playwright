import { type EditorAdapter } from "./types.js";
import { CLAUDE_LEGACY_SKILL_REL } from "./shared.js";
/**
 * The Playwright MCP servers openspec-pw manages. `playwright-test` is the
 * official test-runner server installed today; `playwright` is the legacy
 * @playwright/mcp entry older versions wrote (uninstall removes both).
 * Literals here rather than importing shared/mcp.ts, which imports the
 * editors facade that re-exports this module (import cycle).
 */
export declare const OPENSPEC_PW_MCP_SERVERS: readonly ["playwright-test", "playwright"];
/** Re-exported for uninstall's fixed historical cleanup and the facade. */
export { CLAUDE_LEGACY_SKILL_REL };
export interface AdapterArtifactInventory {
    /** Existing openspec-pw command/skill artifact paths (project-relative). */
    commandPaths: string[];
    /** Declared legacy artifact directories that exist (project-relative). */
    legacyArtifacts: string[];
    /** openspec-pw MCP server entries present in this editor's config. */
    mcpServers: string[];
    /**
     * openspec-pw MCP server entries present in this editor's config that are
     * KEPT because a still-selected editor shares the same MCP config file.
     */
    retainedMcpServers: string[];
    /** True when the adapter's wrapper file (CLAUDE.md / CODEBUDDY.md) holds an openspec-pw wrapper block. */
    hasWrapper: boolean;
}
/**
 * The MCP config files still depended on by the editors that remain selected.
 *
 * Several editors share one MCP config file — Claude Code, CodeBuddy CLI and
 * MiniMax Code all use the project-root `.mcp.json` — so an MCP entry in a
 * shared file serves every one of them. Removing it while another editor
 * still depends on that file would silently break that editor's Playwright
 * MCP, so the removal phase keeps it.
 */
export declare function retainedMcpConfigFiles(selected: readonly EditorAdapter[], projectRoot: string): Set<string>;
/**
 * Enumerate the openspec-pw artifacts one editor owns in this project —
 * command/skill files (incl. extraArtifacts), MCP server entries, the
 * claude-only legacy skill dir and wrapper. Read-only and silent: this is
 * the source for init's confirmation list, so it must not write, delete,
 * or print.
 */
export declare function enumerateAdapterArtifacts(adapter: EditorAdapter, projectRoot: string, retainedFiles?: ReadonlySet<string>): AdapterArtifactInventory;
/** True when this editor has nothing for init to remove. */
export declare function isInventoryEmpty(inv: AdapterArtifactInventory): boolean;
/**
 * Remove the openspec-pw MCP entries for one editor. Only entries passed in
 * `servers` (the enumeration result) are touched — user-owned server entries
 * in the same config file are never written to.
 *
 * When `retainedFiles` names this editor's MCP config file, the entries are
 * kept: a still-selected editor shares that file and depends on the entry.
 */
export declare function removeAdapterMcp(adapter: EditorAdapter, projectRoot: string, servers: readonly string[], retainedFiles?: ReadonlySet<string>): void;
/** Delete one editor's openspec-pw command/skill files. Returns the removed project-relative paths. */
export declare function removeAdapterCommandArtifacts(adapter: EditorAdapter, projectRoot: string): string[];
/**
 * Remove the tool-owned vendored Playwright agent files (claude; init
 * deselection + uninstall). User-owned files are never deleted — each is
 * reported as kept-modified. Returns the removed project-relative paths.
 */
export declare function removeOwnedVendoredAgents(projectRoot: string, adapter: EditorAdapter): string[];
/**
 * Delete one legacy artifact directory declared by the adapter. Returns the
 * removed project-relative path, or null when it does not exist.
 */
export declare function removeLegacyArtifact(adapter: EditorAdapter, projectRoot: string, relPath: string): string | null;
/** Delete claude's retired-install skill directory. Returns the path or null. */
export declare function removeClaudeLegacySkill(projectRoot: string): string | null;
/**
 * Remove the openspec-pw wrapper block from the adapter's wrapper file
 * (CLAUDE.md for claude, CODEBUDDY.md for codebuddy — adapter-owned
 * territory). Skips symlinked wrappers entirely — writing through the
 * symlink would strip the shared block out of AGENTS.md.
 */
export declare function removeWrapper(adapter: EditorAdapter, projectRoot: string): string | null;
/**
 * Delete empty directories up to (not including) `stopAt`. Moved here from
 * uninstall.ts so both the section loop and the per-editor removals share it.
 */
export declare function cleanupEmptyDirs(dir: string, stopAt: string): void;
