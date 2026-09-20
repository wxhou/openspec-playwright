import { normalizeEol } from "../commands/editors/agents.js";
/** Managed paths (first-tier names user-decided + precise tests/ trio). */
export declare const MANAGED_GITIGNORE_PATHS: readonly [".claude/", ".cursor/", ".opencode/", ".cline/", ".pi/", ".omp/", "openspec/", "AGENTS.md", "CLAUDE.md", "app-exploration.md", "opencode.json", "tests/playwright/test-results/", "tests/playwright/credentials.yaml", "tests/playwright/credentials.yaml.bak"];
export declare const GITIGNORE_BLOCK_BEGIN = "# openspec-pw: begin managed block";
export declare const GITIGNORE_BLOCK_END = "# openspec-pw: end managed block";
/**
 * Managed paths NOT yet covered by any ignore rule — existence-independent
 * (a path that does not exist on disk is exactly the forward-looking case
 * this module exists for). Rule-file read errors are swallowed: an
 * unreadable rule file means "not covered" — the write path then either
 * repairs coverage or fails, and the caller degrades to an advisory.
 */
export declare function findUncoveredManagedPaths(projectRoot: string): string[];
/**
 * Ensure every managed path is covered: locate the marker block in the
 * project's .gitignore (CRLF-tolerant) and add missing lines inside it;
 * no block → append one at the file tail; no file → create one containing
 * only the block. Lines outside the block are preserved byte-for-byte
 * (separator rule: an extra blank line is inserted only when the file
 * lacks a trailing newline). Write errors propagate to the caller, which
 * degrades to an advisory.
 */
export declare function ensureGitignoreEntries(projectRoot: string): {
    changed: boolean;
    added: string[];
};
/**
 * Remove the managed block (uninstall). Block-external lines are preserved;
 * a file left empty by the removal is deleted. No well-formed block →
 * no-op (idempotent). CRLF-tolerant. Write errors propagate.
 */
export declare function removeManagedBlock(projectRoot: string): {
    removed: boolean;
    fileDeleted: boolean;
};
/** Normalize EOL helper re-exported for callers comparing file content. */
export { normalizeEol };
/**
 * Advisory text for the degradation path (managed-block write failed):
 * lists the managed paths that remain UNCOVERED so the user can add them
 * by hand. Generic over the whole managed set — not just credentials
 * (review S4). Callers color it (chalk.yellow), matching ignore-check.
 */
export declare function managedBlockAdvisoryHint(uncovered: string[]): string;
/**
 * Best-effort detection of managed paths already tracked by git (ignore
 * rules do not apply to tracked files — review S2/scenario 3.9). Single
 * `git ls-files` spawn covering all managed paths; aggregates per managed
 * top-level path. Any failure (no git binary, not a repo, timeout) degrades
 * silently to [] — this check is advisory and never blocks.
 *
 * Aggregation: a managed DIRECTORY (e.g. `openspec/`) with any tracked
 * content is reported once as the directory name with a count; managed
 * FILE paths are reported verbatim.
 */
export declare function detectTrackedFiles(projectRoot: string): string[];
