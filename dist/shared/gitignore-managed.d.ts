import { normalizeEol } from "../commands/editors/agents.js";
/** Managed paths (first-tier names user-decided + precise tests/ trio). */
export declare const MANAGED_GITIGNORE_PATHS: readonly [".claude/", ".cursor/", ".opencode/", ".cline/", ".pi/", ".omp/", "openspec/", "AGENTS.md", "CLAUDE.md", "app-exploration.md", "opencode.json", "tests/playwright/test-results/", "tests/playwright/credentials.yaml", "tests/playwright/credentials.yaml.bak"];
export declare const GITIGNORE_BLOCK_BEGIN = "# openspec-pw: begin managed block";
export declare const GITIGNORE_BLOCK_END = "# openspec-pw: end managed block";
/**
 * Managed paths NOT yet covered by any ignore rule — existence-independent
 * (a path that does not exist on disk is exactly the forward-looking case
 * this module exists for). Never throws (review F1): rule-file read errors
 * are swallowed by loadIgnoreRules; the ignore matcher itself cannot throw
 * on plain path strings.
 */
export declare function findUncoveredManagedPaths(projectRoot: string): string[];
/**
 * Ensure every managed path is covered: locate the marker block in the
 * project's .gitignore (CRLF-tolerant) and add missing lines inside it;
 * no block → append one at the file tail; no file → create one containing
 * only the block. Lines outside the block keep their bytes — including
 * CRLF endings (F2) and blank-line structure (F5). Write errors propagate
 * to the caller, which degrades to an advisory.
 */
export declare function ensureGitignoreEntries(projectRoot: string): {
    changed: boolean;
    added: string[];
};
/**
 * Remove the managed block (uninstall). Block-external lines are preserved
 * byte-for-byte — no blank-run collapsing, no leading/trailing whitespace
 * trims (review F5); the file's original trailing-newline state is kept.
 * A file left with no content at all is deleted. No well-formed block →
 * no-op (idempotent; malformed marker pairs are user-file content, F3).
 * Write errors propagate.
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
 * silently to [] — this check is advisory and never blocks. Works from a
 * repo subdirectory too: the old `existsSync(projectRoot/.git)` gate made
 * the advisory dead there while the block itself still got written
 * (review F6) — git resolves the repo upward from -C on its own.
 */
export declare function detectTrackedFiles(projectRoot: string): string[];
