/**
 * Git ignore coverage check for credential files — advisory only.
 *
 * Reads the run directory's ignore rules directly (`.gitignore` +
 * `.git/info/exclude`) so it works without a git binary and never writes.
 * Shared single source for init and update: both print the hint text from
 * here so the wording cannot drift between commands.
 */
import { existsSync } from "fs";
import { join } from "path";
import { loadIgnoreRules } from "./gitignore-managed.js";
/** Credential file paths whose git-ignored status matters (relative). */
export const CREDENTIALS_RELPATHS = [
    "tests/playwright/credentials.yaml",
    "tests/playwright/credentials.yaml.bak",
];
/**
 * Advisory text for paths not covered by the project's ignore rules.
 * Callers color it (chalk.yellow) — shared modules return plain text,
 * matching the codegraphHintLines pattern.
 */
export function credentialsIgnoreHint(unignored) {
    return (`Test credentials are not git-ignored: ${unignored.join(", ")}` +
        " — add them to .gitignore (or keep credentials in the" +
        " E2E_USERNAME / E2E_PASSWORD env vars instead)");
}
/**
 * Whether the project's ignore rules cover `relPath`, independent of whether
 * the path exists yet. `findUnignoredFiles` cannot answer this: it skips
 * paths that are not on disk, which makes a not-yet-created `tmp/` look safe.
 */
export function isPathIgnored(projectRoot, relPath) {
    const ig = loadIgnoreRules(projectRoot);
    const clean = relPath.replace(/\/+$/, "");
    // Directory rules such as `tmp/` match only the trailing-slash form.
    return ig.ignores(clean) || ig.ignores(`${clean}/`);
}
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
export function findUnignoredFiles(projectRoot, relPaths) {
    const ig = loadIgnoreRules(projectRoot);
    return relPaths.filter((rel) => existsSync(join(projectRoot, rel)) && !ig.ignores(rel));
}
//# sourceMappingURL=ignore-check.js.map