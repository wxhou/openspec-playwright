/**
 * Git ignore coverage check for credential files — advisory only.
 *
 * Reads the run directory's ignore rules directly (`.gitignore` +
 * `.git/info/exclude`) so it works without a git binary and never writes.
 * Shared single source for init and update: both print the hint text from
 * here so the wording cannot drift between commands.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import ignore from "ignore";

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
export function credentialsIgnoreHint(unignored: string[]): string {
  return (
    `Test credentials are not git-ignored: ${unignored.join(", ")}` +
    " — add them to .gitignore (or keep credentials in the" +
    " E2E_USERNAME / E2E_PASSWORD env vars instead)"
  );
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
export function findUnignoredFiles(
  projectRoot: string,
  relPaths: string[],
): string[] {
  const ig = ignore();
  for (const ruleFile of [join(".git", "info", "exclude"), ".gitignore"]) {
    const abs = join(projectRoot, ruleFile);
    if (existsSync(abs)) ig.add(readFileSync(abs, "utf-8"));
  }
  return relPaths.filter(
    (rel) => existsSync(join(projectRoot, rel)) && !ig.ignores(rel),
  );
}
