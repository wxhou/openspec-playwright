/** Credential file paths whose git-ignored status matters (relative). */
export declare const CREDENTIALS_RELPATHS: string[];
/**
 * Advisory text for paths not covered by the project's ignore rules.
 * Callers color it (chalk.yellow) — shared modules return plain text,
 * matching the codegraphHintLines pattern.
 */
export declare function credentialsIgnoreHint(unignored: string[]): string;
/**
 * Return the subset of `relPaths` that exist on disk but are NOT covered
 * by the project's ignore rules. Empty result = fully covered.
 *
 * Precedence: git gives `.gitignore` priority over `.git/info/exclude`;
 * an `ignore()` instance resolves last-match-wins, so the lower-priority
 * source is added first and `.gitignore` last. Missing rule files simply
 * contribute nothing (a directory with no rules leaves every existing
 * path uncovered).
 */
export declare function findUnignoredFiles(projectRoot: string, relPaths: string[]): string[];
