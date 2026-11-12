/**
 * A removal that failed after some files were already changed. `modified`
 * lets the batch orchestrator tell "nothing touchable" (skipped) from
 * "half-cleaned" (failed) without a writability precheck, which is
 * unreliable on Windows.
 */
export declare class RemoveError extends Error {
    readonly modified: string[];
    constructor(message: string, modified: string[]);
}
/**
 * Remove every openspec-pw product from one project. Tool-owned artifacts
 * are deleted, user-modified copies are kept with a notice, and user data
 * (credentials, tests, openspec specs) is never touched. Idempotent: an
 * uninstalled project produces only skip lines.
 *
 * Returns the project-relative paths (and coarse markers like `mcp:…`) that
 * were changed, so a failed run can report how far it got.
 */
export declare function removeInProject(projectRoot: string): Promise<string[]>;
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
