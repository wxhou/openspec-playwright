/**
 * Managed .gitignore block — init/update automatically maintain a marked
 * block at the tail of the project's .gitignore so openspec-pw-generated
 * products that must not be committed (runtime output, credentials) are
 * ignored without the user hand-editing anything.
 *
 * Philosophy (revised from v0.3.86's "never touch .gitignore"): the tool
 * writes ONLY inside its begin/end marker block — lines outside the block
 * are preserved byte-for-byte, including their original CRLF line endings
 * (code-review F2) and blank-line structure (F5). Detection is
 * existence-independent: .gitignore is a forward-looking declaration, so
 * paths that do not exist on disk yet (first init, before the first test
 * run) must still be written (review B1) — unlike findUnignoredFiles,
 * whose existsSync gate is correct for the advisory semantics.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join, relative, sep } from "path";
import ignore from "ignore";
import { normalizeEol } from "../commands/editors/agents.js";
import { execFileSync } from "./exec.js";
import { readTextFileCapped } from "./file-read.js";
import { isPathInsideProjectRoot } from "./path-guard.js";

/** Managed paths (user-decided artifacts/config + credentials + regenerable local data). */
export const MANAGED_GITIGNORE_PATHS = [
  ".claude/",
  ".cursor/",
  ".opencode/",
  ".cline/",
  ".pi/",
  ".omp/",
  ".codebuddy/",
  ".agents/",
  ".dsh/",
  ".gemini/",
  ".qwen/",
  ".kimi-code/",
  ".github/prompts/",
  ".roo/commands/opsx-e2e.md",
  ".roo/commands/openspec-e2e.md",
  ".trae/commands/opsx-e2e.md",
  ".trae/commands/openspec-e2e.md",
  ".codegraph/",
  ".playwright-mcp/",
  "openspec/",
  "AGENTS.md",
  "CLAUDE.md",
  "CODEBUDDY.md",
  "GEMINI.md",
  "QWEN.md",
  ".github/copilot-instructions.md",
  ".roo/rules/openspec-pw.md",
  ".trae/rules/project_rules.md",
  "app-exploration.md",
  "opencode.json",
  "opencode.jsonc",
  ".mcp.json",
  ".roo/mcp.json",
  ".trae/mcp.json",
  "tmp/",
  "playwright/.auth/",
  "tests/playwright/test-results/",
  "tests/playwright/screenshots/",
  "tests/playwright/credentials.yaml",
  "tests/playwright/credentials.yaml.bak",
] as const;

export const GITIGNORE_BLOCK_BEGIN = "# openspec-pw: begin managed block";
export const GITIGNORE_BLOCK_END = "# openspec-pw: end managed block";

/**
 * Paths the tool owns outright: always ignored, never offered for opt-out.
 * Skipping them would commit a file into which every init/update injects a
 * regenerated block.
 */
export const LOCKED_GITIGNORE_PATHS = [
  "AGENTS.md",
  "CLAUDE.md",
  "CODEBUDDY.md",
  "GEMINI.md",
  "QWEN.md",
  ".github/copilot-instructions.md",
  ".roo/rules/openspec-pw.md",
  ".trae/rules/project_rules.md",
] as const;

/** Block-header line recording the init-time opt-outs, honored by later runs. */
const SKIP_LINE_PREFIX = "# openspec-pw: skip=";

/**
 * Per-editor rules copies the `--no-rule-files` opt-out can exit: every locked
 * carrier except AGENTS.md (the SSOT, always installed and always ignored).
 * Kept explicit — deriving it from LOCKED_GITIGNORE_PATHS would silently add
 * any future locked non-rules path to the exit set.
 */
export const RULE_COPY_GITIGNORE_PATHS = [
  "CLAUDE.md",
  "CODEBUDDY.md",
  "GEMINI.md",
  "QWEN.md",
  ".github/copilot-instructions.md",
  ".roo/rules/openspec-pw.md",
  ".trae/rules/project_rules.md",
] as const;

/**
 * Project-relative POSIX path used by the managed block — the form recorded
 * on the skip line, so rule-copy decisions compare on the same string.
 */
export function managedPathFor(
  projectRoot: string,
  absPath: string,
): string {
  return relative(projectRoot, absPath).split(sep).join("/");
}

/**
 * Load the run directory's ignore rules (.git/info/exclude first, then
 * .gitignore). Per-file read tolerance (review F1): an unreadable rule
 * file is skipped — "not covered by that file's rules" — so detectors
 * built on this never throw while degrading an advisory.
 */
export function loadIgnoreRules(projectRoot: string): ReturnType<typeof ignore> {
  const ig = ignore();
  for (const ruleFile of [join(".git", "info", "exclude"), ".gitignore"]) {
    const abs = join(projectRoot, ruleFile);
    try {
      if (existsSync(abs)) ig.add(readFileSync(abs, "utf-8"));
    } catch {
      /* unreadable rule file — treat as absent (review F1) */
    }
  }
  return ig;
}

/**
 * Do two managed-path strings overlap? True when they are equal or when one
 * is a directory that contains the other. Directory-ness comes from the
 * trailing slash the managed set uses, so a file never swallows a sibling
 * file (`credentials.yaml` vs `credentials.yaml.bak`).
 *
 * Overlap decides an opt-out's reach: ignoring a directory also ignores
 * everything under it, so a recorded skip inside a managed directory keeps
 * that directory out of the managed set.
 */
export function managedPathsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.endsWith("/") && b.startsWith(a)) return true;
  if (b.endsWith("/") && a.startsWith(b)) return true;
  return false;
}

/**
 * One-way coverage: a directory entry covers lines beneath it, never the
 * reverse. `managedPathsOverlap` is symmetric — using it to prune would let a
 * narrow child delete a broad user line such as `.roo/`.
 */
function coversLine(entry: string, line: string): boolean {
  return entry === line || (entry.endsWith("/") && line.startsWith(entry));
}

/** Is this managed path covered by any recorded opt-out? */
export function coveredBySkips(
  path: string,
  skips: Iterable<string>,
): boolean {
  for (const s of skips) {
    if (managedPathsOverlap(path, s)) return true;
  }
  return false;
}

/**
 * Does this managed path contain a recorded opt-out? Only a directory can
 * contain one. Such a path cannot be offered as "keep ignoring": ignoring
 * the directory would ignore the opted-out path inside it.
 */
export function containsSkip(
  path: string,
  skips: Iterable<string>,
): boolean {
  if (!path.endsWith("/")) return false;
  for (const s of skips) {
    if (s !== path && s.startsWith(path)) return true;
  }
  return false;
}

/**
 * Candidates for the init selection prompt: managed paths minus locked/omitted
 * and minus paths that contain a recorded opt-out. An exactly recorded opt-out
 * stays a candidate — the prompt is where the user re-checks it.
 */
export function skippableManagedPaths(
  omit: readonly string[] = [],
  recordedSkips: readonly string[] = [],
): string[] {
  const locked = new Set<string>(LOCKED_GITIGNORE_PATHS);
  return MANAGED_GITIGNORE_PATHS.filter(
    (p) =>
      !locked.has(p) &&
      !coveredBySkips(p, omit) &&
      !containsSkip(p, recordedSkips),
  );
}

/**
 * Managed paths NOT yet covered by any ignore rule — existence-independent
 * (a path that does not exist on disk is exactly the forward-looking case
 * this module exists for). Never throws (review F1): rule-file read errors
 * are swallowed by loadIgnoreRules; the ignore matcher itself cannot throw
 * on plain path strings.
 *
 * `omit` drops paths from the managed set for callers that need one of them
 * committed (the auto pipeline needs `openspec/` in the tree). A skip inside
 * a managed directory keeps the whole directory out — ignoring the directory
 * would ignore the user's own files too.
 */
export function findUncoveredManagedPaths(
  projectRoot: string,
  omit: readonly string[] = [],
): string[] {
  const ig = loadIgnoreRules(projectRoot);
  return MANAGED_GITIGNORE_PATHS.filter(
    (rel) => !coveredBySkips(rel, omit) && !ig.ignores(rel),
  );
}

/** Is this path ignored by any rule file the repo applies? */
export function isIgnoredPath(projectRoot: string, rel: string): boolean {
  return loadIgnoreRules(projectRoot).ignores(rel);
}

/** Split content into lines, keeping each line's original `\r` (F2). */
function toLines(content: string): string[] {
  return content.split("\n").map((l) => l.replace(/\n$/, ""));
}
/** Locate a well-formed marker block: the first BEGIN whose next marker
 * (before any other BEGIN) is an END. An orphan BEGIN followed by another
 * BEGIN means the pair is malformed — reported as absent (review F3:
 * a malformed pair must never swallow user lines between its markers,
 * on write or on remove). */
function locateBlock(lines: string[]): [number, number] {
  for (let b = 0; b < lines.length; b++) {
    if (lines[b].trim() !== GITIGNORE_BLOCK_BEGIN) continue;
    for (let e = b + 1; e < lines.length; e++) {
      const t = lines[e].trim();
      if (t === GITIGNORE_BLOCK_BEGIN) break; // nested/orphaned BEGIN → malformed
      if (t === GITIGNORE_BLOCK_END) return [b, e];
    }
  }
  return [-1, -1];
}

/**
 * True when `content` holds a managed block removal would actually delete.
 * Shared by the remove plan and discovery so neither promises a removal that
 * `removeManagedBlock` skips as malformed.
 */
export function hasRemovableManagedBlock(content: string): boolean {
  return locateBlock(toLines(content))[0] !== -1;
}

/** Paths recorded on a skip line; `undefined` line → none. */
function parseSkipLine(line: string | undefined): string[] {
  const t = line?.trim() ?? "";
  if (!t.startsWith(SKIP_LINE_PREFIX)) return [];
  return t
    .slice(SKIP_LINE_PREFIX.length)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Paths the user opted out of ignoring at init, read from the block-header
 * skip line. Update honors them so a later run never re-adds what the user
 * chose to commit. Unreadable .gitignore propagates — the caller degrades to
 * an advisory rather than silently resurrecting the skipped paths.
 */
export function readManagedSkips(projectRoot: string): string[] {
  const gitignorePath = join(projectRoot, ".gitignore");
  if (!existsSync(gitignorePath)) return [];
  const lines = toLines(readFileSync(gitignorePath, "utf-8"));
  const [beginIdx, endIdx] = locateBlock(lines);
  if (beginIdx === -1) return [];
  return parseSkipLine(
    lines
      .slice(beginIdx + 1, endIdx)
      .find((l) => l.trim().startsWith(SKIP_LINE_PREFIX)),
  );
}

/**
 * Tolerant `readManagedSkips` for callers that must keep running when the
 * file is unreadable (doctor/update diagnosis, init's install decision).
 * Losing the record degrades to the pre-opt-out behavior; init's write-side
 * advisory reports the cause.
 */
export function readManagedSkipsSafe(projectRoot: string): string[] {
  try {
    return readManagedSkips(projectRoot);
  } catch {
    return [];
  }
}

/**
 * Ensure every managed path is covered: locate the marker block in the
 * project's .gitignore (CRLF-tolerant) and add missing lines inside it;
 * no block → append one at the file tail; no file → create one containing
 * only the block. Lines outside the block keep their bytes — including
 * CRLF endings (F2) and blank-line structure (F5). Write errors propagate
 * to the caller, which degrades to an advisory.
 *
 * `omit` names paths that must stay committable for this run only: they are
 * never added, and an existing line for them is dropped from the managed
 * block (the block is tool-owned territory; rules outside it are the user's
 * and stay untouched) — but nothing is recorded, or the next run would
 * inherit a pipeline-only decision.
 *
 * `skip` is the user's init-time opt-out: same removal, plus a skip line in
 * the block header so later runs keep honoring it. Passing `skip` replaces
 * that line; leaving it undefined preserves whatever the block records.
 */
export function ensureGitignoreEntries(
  projectRoot: string,
  opts: { omit?: readonly string[]; skip?: readonly string[] } = {},
): {
  changed: boolean;
  added: string[];
  removed: string[];
  /** Redundant entries dropped from the block — not opt-out driven. */
  pruned: string[];
} {
  const omitted = new Set(opts.omit ?? []);
  // `skip: undefined` means "keep the block's record in force", not "reset":
  // the recorded paths then supply the opt-outs. A recorded choice is never
  // intersected with `omit` — a pipeline run is transient, the choice is not.
  const requestedSkips =
    opts.skip === undefined ? undefined : [...new Set(opts.skip)];

  const gitignorePath = join(projectRoot, ".gitignore");
  const hadFile = existsSync(gitignorePath);
  // Raw line model (F2 + O3): each element keeps its original bytes (CRLF
  // lines keep their \r); ONE trailing newline is stripped before splitting
  // so the split never leaves a phantom empty last line — the write below
  // restores exactly one trailing newline when the file had one.
  let lines: string[] = [];
  let hadTrailingNewline = false;
  if (hadFile) {
    let raw = readFileSync(gitignorePath, "utf-8");
    hadTrailingNewline = raw.endsWith("\n");
    if (hadTrailingNewline) raw = raw.slice(0, -1);
    lines = toLines(raw);
  }
  const [beginIdx, endIdx] = locateBlock(lines);
  const body = beginIdx === -1 ? [] : lines.slice(beginIdx + 1, endIdx);
  const existingSkipLine = body.find((l) =>
    l.trim().startsWith(SKIP_LINE_PREFIX),
  );
  // Rewriting a CRLF skip line as LF would make every run look "changed".
  const skipLineEol = (existingSkipLine ?? lines[beginIdx])?.endsWith("\r")
    ? "\r"
    : "";
  const skips = requestedSkips ?? parseSkipLine(existingSkipLine);
  const skipped = new Set([...omitted, ...skips]);
  const uncovered = findUncoveredManagedPaths(projectRoot, [...skipped]);
  const skipLine =
    requestedSkips === undefined
      ? existingSkipLine
      : requestedSkips.length > 0
        ? SKIP_LINE_PREFIX + requestedSkips.join(",") + skipLineEol
        : undefined;

  let added: string[];
  let removed: string[] = [];
  let pruned: string[] = [];
  if (beginIdx !== -1) {
    // Well-formed block: add only the lines missing from its body, drop the
    // ones the caller wants kept committable, and rewrite the skip record.
    // A line that covers a skipped path goes too — a recorded opt-out for
    // `.agents/skills/…` must not be undone by an `.agents/` line.
    const content = body.filter((l) => !l.trim().startsWith(SKIP_LINE_PREFIX));
    const kept = content.filter((l) => !coveredBySkips(l.trim(), skipped));
    removed = content
      .filter((l) => coveredBySkips(l.trim(), skipped))
      .map((l) => l.trim());
    // Entries dropped from MANAGED_GITIGNORE_PATHS stay in old blocks forever
    // unless pruned. Prune only when a managed directory that is still in the
    // block covers the line — that leaves the ignore semantics unchanged. An
    // opted-out path is not in the block, so it cannot cover its leftovers.
    const managed = new Set<string>(MANAGED_GITIGNORE_PATHS);
    const coverProviders = MANAGED_GITIGNORE_PATHS.filter(
      (p) => !coveredBySkips(p, skipped),
    );
    const stale = new Set(
      kept.filter((l) => {
        const p = l.trim();
        return (
          !managed.has(p) &&
          coverProviders.some((m) => m !== p && coversLine(m, p))
        );
      }),
    );
    const survivors = kept.filter((l) => !stale.has(l));
    pruned = [...stale].map((l) => l.trim());
    const bodySet = new Set(survivors.map((l) => l.trim()));
    added = uncovered.filter((p) => !bodySet.has(p));
    if (
      added.length === 0 &&
      removed.length === 0 &&
      pruned.length === 0 &&
      skipLine === existingSkipLine
    ) {
      return { changed: false, added: [], removed: [], pruned: [] };
    }
    lines.splice(
      beginIdx + 1,
      endIdx - beginIdx - 1,
      ...(skipLine ? [skipLine] : []),
      ...added,
      ...survivors,
    );
  } else {
    // No well-formed block: append one at the tail. Orphan markers, if
    // any, stay — they are user-file content and never participate in
    // pairing (F3). Line separation is the "\n" of the join itself; the
    // final newline written below restores the file's terminated state.
    // An opt-out needs the header line to survive, so it alone justifies a
    // block even when every path is already covered by the user's rules.
    added = [...uncovered];
    if (added.length === 0 && skipLine === undefined) {
      return { changed: false, added: [], removed: [], pruned: [] };
    }
    lines.push(
      GITIGNORE_BLOCK_BEGIN,
      ...(skipLine ? [skipLine] : []),
      ...added,
      GITIGNORE_BLOCK_END,
    );
  }

  // join("\n") preserves every original line's bytes (CRLF lines keep
  // their \r as part of the line content); the file's original trailing
  // newline state is restored.
  writeFileSync(
    gitignorePath,
    lines.join("\n") + (hadTrailingNewline || !hadFile ? "\n" : ""),
  );
  return { changed: true, added, removed, pruned };
}

/**
 * Remove the managed block (the `remove` command). Block-external lines are preserved
 * byte-for-byte — no blank-run collapsing, no leading/trailing whitespace
 * trims (review F5); the file's original trailing-newline state is kept.
 * A file left with no content at all is deleted. No well-formed block →
 * no-op (idempotent; malformed marker pairs are user-file content, F3).
 * Write errors propagate.
 */
export function removeManagedBlock(projectRoot: string): {
  removed: boolean;
  fileDeleted: boolean;
  tooLarge?: boolean;
} {
  const gitignorePath = join(projectRoot, ".gitignore");
  if (!existsSync(gitignorePath)) return { removed: false, fileDeleted: false };
  // A symlinked .gitignore (dotfiles checkout) resolves outside the project:
  // rewriting it would edit a file the project does not own.
  if (!isPathInsideProjectRoot(projectRoot, gitignorePath)) {
    return { removed: false, fileDeleted: false };
  }

  const read = readTextFileCapped(gitignorePath);
  if (read.kind === "missing") return { removed: false, fileDeleted: false };
  if (read.kind === "too-large") {
    return { removed: false, fileDeleted: false, tooLarge: true };
  }
  if (read.kind === "unreadable") {
    throw new Error(`cannot read ${gitignorePath} to remove the managed block`, {
      cause: read.error,
    });
  }
  const raw = read.content;
  const hadTrailingNewline = raw.endsWith("\n");
  const body = hadTrailingNewline ? raw.slice(0, -1) : raw;
  const lines = toLines(body);
  const [beginIdx, endIdx] = locateBlock(lines);
  if (beginIdx === -1) return { removed: false, fileDeleted: false };

  const kept = [...lines.slice(0, beginIdx), ...lines.slice(endIdx + 1)];
  const content = kept.join("\n");
  if (content.trim() === "") {
    rmSync(gitignorePath);
    return { removed: true, fileDeleted: true };
  }
  writeFileSync(
    gitignorePath,
    hadTrailingNewline ? content + "\n" : content,
  );
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
 * silently to [] — this check is advisory and never blocks. Works from a
 * repo subdirectory too: the old `existsSync(projectRoot/.git)` gate made
 * the advisory dead there while the block itself still got written
 * (review F6) — git resolves the repo upward from -C on its own.
 */
export function detectTrackedFiles(
  projectRoot: string,
  omit: readonly string[] = [],
): string[] {
  const paths = MANAGED_GITIGNORE_PATHS.filter(
    (p) => !coveredBySkips(p, omit),
  );
  const args = ["-C", projectRoot, "ls-files", "--", ...paths];
  let stdout: string = "";
  try {
    // `?? ""` also guards mocked/odd runtimes returning undefined — an
    // empty result simply means "nothing tracked".
    stdout = (execFileSync("git", args, {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 1024 * 1024,
    }) as string) ?? "";
  } catch {
    return []; // no git binary / not a repo / timeout — advisory only
  }

  const trackedLines = stdout.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (trackedLines.length === 0) return [];

  const reported: string[] = [];
  let overflow = 0;
  for (const rel of paths) {
    const isDir = rel.endsWith("/");
    const hits = trackedLines.filter((t) =>
      isDir ? t === rel.replace(/\/$/, "") || t.startsWith(rel) : t === rel,
    );
    if (hits.length === 0) continue;
    if (isDir) {
      reported.push(`${rel} (${hits.length} files tracked)`);
    } else if (reported.length < 5) {
      reported.push(rel);
    } else {
      overflow++;
    }
  }
  if (overflow > 0) reported.push(`… +${overflow} more`);
  return reported;
}