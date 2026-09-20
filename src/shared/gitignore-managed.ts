/**
 * Managed .gitignore block — init/update automatically maintain a marked
 * block at the tail of the project's .gitignore so openspec-pw-generated
 * products that must not be committed (runtime output, credentials) are
 * ignored without the user hand-editing anything.
 *
 * Philosophy (revised from v0.3.86's "never touch .gitignore"): the tool
 * writes ONLY inside its begin/end marker block — lines outside the block
 * are preserved byte-for-byte. Detection is existence-independent:
 * .gitignore is a forward-looking declaration, so paths that do not exist
 * on disk yet (first init, before the first test run) must still be written
 * (review B1) — unlike findUnignoredFiles, whose existsSync gate is correct
 * for the advisory semantics (report files the user already generated).
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import ignore from "ignore";
import { normalizeEol } from "../commands/editors/agents.js";
import { needsShell } from "./platform.js";

/** Managed paths (first-tier names user-decided + precise tests/ trio). */
export const MANAGED_GITIGNORE_PATHS = [
  ".claude/",
  ".cursor/",
  ".opencode/",
  ".cline/",
  ".pi/",
  ".omp/",
  "openspec/",
  "AGENTS.md",
  "CLAUDE.md",
  "app-exploration.md",
  "opencode.json",
  "tests/playwright/test-results/",
  "tests/playwright/credentials.yaml",
  "tests/playwright/credentials.yaml.bak",
] as const;

export const GITIGNORE_BLOCK_BEGIN = "# openspec-pw: begin managed block";
export const GITIGNORE_BLOCK_END = "# openspec-pw: end managed block";

/**
 * Load the run directory's ignore rules (.git/info/exclude first, then
 * .gitignore) — shared semantics with ignore-check.ts (exclude wins).
 */
function loadIgnoreRules(projectRoot: string): ReturnType<typeof ignore> {
  const ig = ignore();
  for (const ruleFile of [join(".git", "info", "exclude"), ".gitignore"]) {
    const abs = join(projectRoot, ruleFile);
    if (existsSync(abs)) ig.add(readFileSync(abs, "utf-8"));
  }
  return ig;
}

/**
 * Managed paths NOT yet covered by any ignore rule — existence-independent
 * (a path that does not exist on disk is exactly the forward-looking case
 * this module exists for). Rule-file read errors are swallowed: an
 * unreadable rule file means "not covered" — the write path then either
 * repairs coverage or fails, and the caller degrades to an advisory.
 */
export function findUncoveredManagedPaths(projectRoot: string): string[] {
  const ig = loadIgnoreRules(projectRoot);
  return MANAGED_GITIGNORE_PATHS.filter((rel) => {
    try {
      return !ig.ignores(rel);
    } catch {
      return true;
    }
  });
}

/** Split a .gitignore's content into lines, CRLF-tolerant. */
function readLines(gitignorePath: string): string[] {
  return readFileSync(gitignorePath, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.replace(/\r$/, ""));
}

/** Locate a well-formed marker block. Returns [-1, -1] when absent. */
function locateBlock(lines: string[]): [number, number] {
  const beginIdx = lines.findIndex((l) => l.trim() === GITIGNORE_BLOCK_BEGIN);
  const endIdx = lines.findIndex((l) => l.trim() === GITIGNORE_BLOCK_END);
  if (beginIdx === -1 || endIdx === -1 || endIdx <= beginIdx) return [-1, -1];
  return [beginIdx, endIdx];
}

/**
 * Ensure every managed path is covered: locate the marker block in the
 * project's .gitignore (CRLF-tolerant) and add missing lines inside it;
 * no block → append one at the file tail; no file → create one containing
 * only the block. Lines outside the block are preserved byte-for-byte
 * (separator rule: an extra blank line is inserted only when the file
 * lacks a trailing newline). Write errors propagate to the caller, which
 * degrades to an advisory.
 */
export function ensureGitignoreEntries(projectRoot: string): {
  changed: boolean;
  added: string[];
} {
  const uncovered = findUncoveredManagedPaths(projectRoot);
  if (uncovered.length === 0) return { changed: false, added: [] };

  const gitignorePath = join(projectRoot, ".gitignore");
  const hadFile = existsSync(gitignorePath);
  // Strip ONE trailing newline before splitting: the trailing "" produced
  // by split is a split artifact, not a real blank line — treating it as
  // content would insert a stray blank line before the block (review O3).
  let lines: string[] = [];
  if (hadFile) {
    let raw = readFileSync(gitignorePath, "utf-8");
    if (raw.endsWith("\n")) raw = raw.slice(0, -1);
    lines = raw.split(/\r?\n/).map((l) => l.replace(/\r$/, ""));
  }
  const [beginIdx, endIdx] = locateBlock(lines);

  let added: string[];
  if (beginIdx !== -1) {
    // Well-formed block: add only the lines missing from its body.
    const body = new Set(lines.slice(beginIdx + 1, endIdx).map((l) => l.trim()));
    added = uncovered.filter((p) => !body.has(p));
    if (added.length === 0) return { changed: false, added: [] };
    lines.splice(beginIdx + 1, 0, ...added);
  } else {
    // No (well-formed) block: append one at the tail. Orphan markers or a
    // duplicated block, if any, stay — they are user-file content. The
    // trailing newline was stripped above, so the block joins seamlessly.
    added = [...uncovered];
    lines.push(GITIGNORE_BLOCK_BEGIN, ...added, GITIGNORE_BLOCK_END);
  }

  writeFileSync(gitignorePath, lines.join("\n") + "\n");
  return { changed: true, added };
}

/**
 * Remove the managed block (uninstall). Block-external lines are preserved;
 * a file left empty by the removal is deleted. No well-formed block →
 * no-op (idempotent). CRLF-tolerant. Write errors propagate.
 */
export function removeManagedBlock(projectRoot: string): {
  removed: boolean;
  fileDeleted: boolean;
} {
  const gitignorePath = join(projectRoot, ".gitignore");
  if (!existsSync(gitignorePath)) return { removed: false, fileDeleted: false };

  const lines = readLines(gitignorePath);
  const [beginIdx, endIdx] = locateBlock(lines);
  if (beginIdx === -1) return { removed: false, fileDeleted: false };

  const kept = [...lines.slice(0, beginIdx), ...lines.slice(endIdx + 1)];
  if (kept.every((l) => l.trim() === "")) {
    rmSync(gitignorePath);
    return { removed: true, fileDeleted: true };
  }
  // Collapse blank runs left behind by the removal, keep a trailing newline.
  const cleaned = kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .trimEnd();
  writeFileSync(gitignorePath, cleaned + "\n");
  return { removed: true, fileDeleted: false };
}

/** Normalize EOL helper re-exported for callers comparing file content. */
export { normalizeEol };

/**
 * Advisory text for the degradation path (managed-block write failed):
 * lists the managed paths that remain UNCOVERED so the user can add them
 * by hand. Generic over the whole managed set — not just credentials
 * (review S4). Callers color it (chalk.yellow), matching ignore-check.
 */
export function managedBlockAdvisoryHint(uncovered: string[]): string {
  return (
    "Could not update .gitignore — these generated paths are NOT ignored: " +
    uncovered.join(", ") +
    " — add them to .gitignore manually"
  );
}

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
export function detectTrackedFiles(projectRoot: string): string[] {
  if (!existsSync(join(projectRoot, ".git"))) return [];
  const args = [
    "-C",
    projectRoot,
    "ls-files",
    "--",
    ...MANAGED_GITIGNORE_PATHS,
  ];
  let stdout: string;
  try {
    stdout = execFileSync("git", args, {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
      shell: needsShell,
      maxBuffer: 1024 * 1024,
    });
  } catch {
    return []; // no git binary / not a repo / timeout — advisory only
  }

  const trackedLines = stdout.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (trackedLines.length === 0) return [];

  const reported: string[] = [];
  let overflow = 0;
  for (const rel of MANAGED_GITIGNORE_PATHS) {
    const isDir = rel.endsWith("/");
    const hits = trackedLines.filter((t) =>
      isDir ? t === rel.replace(/\/$/, "") || t.startsWith(rel) : t === rel,
    );
    if (hits.length === 0) continue;
    if (isDir) {
      reported.push(`${rel} (${hits.length} files tracked)`);
    } else if (overflow < 5 - reported.length) {
      reported.push(rel);
    } else {
      overflow++;
    }
  }
  if (overflow > 0) reported.push(`… +${overflow} more`);
  return reported;
}
