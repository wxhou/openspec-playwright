/**
 * A removal that failed. `modified` tells the batch orchestrator how far the
 * cleanup got; `unwritable` marks a permission failure, which the batch counts
 * as skipped only when nothing changed (no writability precheck — it is
 * unreliable on Windows). The original error is kept as `cause`.
 */
export declare class RemoveError extends Error {
    readonly modified: string[];
    /** True when the failure was a filesystem permission error (project not writable). */
    readonly unwritable: boolean;
    constructor(message: string, modified: string[], 
    /** True when the failure was a filesystem permission error (project not writable). */
    unwritable?: boolean, cause?: unknown);
}
/**
 * Remove every openspec-pw product from one project. Tool-owned artifacts
 * are deleted, user-modified copies are kept with a notice, and user data
 * (credentials, tests, openspec specs) is never touched. Idempotent: an
 * already-clean project produces only skip lines.
 *
 * `all` is the batch mode: it skips the legacy `playwright` entry, whose name
 * cannot be told apart from a user's own server.
 *
 * Returns the project-relative paths (and coarse markers like `mcp:…`) that
 * were changed, so a failed run can report how far it got.
 */
export declare function removeInProject(projectRoot: string, options?: {
    all?: boolean;
}): Promise<string[]>;
/** Single-project entry: returns the process exit code (0 ok, 1 failed). */
export declare function removeSingle(projectRoot?: string): Promise<number>;
export interface RemoveAllOptions {
    yes?: boolean;
    root?: string[];
    cwd?: string;
}
/** Usage error for an invalid option combination; null when valid. */
export declare function removeOptionError(options: {
    all?: boolean;
    yes?: boolean;
    root?: string[];
}): string | null;
/**
 * Machine-wide removal. Without `yes` this only prints the plan and never
 * writes; with `yes` every discovered project is cleaned, one project's
 * failure never stops the rest, and a nonzero exit code signals failures.
 */
export declare function runRemoveAll(options?: RemoveAllOptions): Promise<number>;
