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
];
export const GITIGNORE_BLOCK_BEGIN = "# openspec-pw: begin managed block";
export const GITIGNORE_BLOCK_END = "# openspec-pw: end managed block";
/**
 * Load the run directory's ignore rules (.git/info/exclude first, then
 * .gitignore). Per-file read tolerance (review F1): an unreadable rule
 * file is skipped — "not covered by that file's rules" — so detectors
 * built on this never throw while degrading an advisory.
 */
function loadIgnoreRules(projectRoot) {
    const ig = ignore();
    for (const ruleFile of [join(".git", "info", "exclude"), ".gitignore"]) {
        const abs = join(projectRoot, ruleFile);
        try {
            if (existsSync(abs))
                ig.add(readFileSync(abs, "utf-8"));
        }
        catch {
            /* unreadable rule file — treat as absent (review F1) */
        }
    }
    return ig;
}
/**
 * Managed paths NOT yet covered by any ignore rule — existence-independent
 * (a path that does not exist on disk is exactly the forward-looking case
 * this module exists for). Never throws (review F1): rule-file read errors
 * are swallowed by loadIgnoreRules; the ignore matcher itself cannot throw
 * on plain path strings.
 */
export function findUncoveredManagedPaths(projectRoot) {
    const ig = loadIgnoreRules(projectRoot);
    return MANAGED_GITIGNORE_PATHS.filter((rel) => !ig.ignores(rel));
}
/** Split content into lines, keeping each line's original `\r` (F2). */
function toLines(content) {
    return content.split("\n").map((l) => l.replace(/\n$/, ""));
}
/** Locate a well-formed marker block: the first BEGIN whose next marker
 * (before any other BEGIN) is an END. An orphan BEGIN followed by another
 * BEGIN means the pair is malformed — reported as absent (review F3:
 * a malformed pair must never swallow user lines between its markers,
 * on write or on uninstall). */
function locateBlock(lines) {
    for (let b = 0; b < lines.length; b++) {
        if (lines[b].trim() !== GITIGNORE_BLOCK_BEGIN)
            continue;
        for (let e = b + 1; e < lines.length; e++) {
            const t = lines[e].trim();
            if (t === GITIGNORE_BLOCK_BEGIN)
                break; // nested/orphaned BEGIN → malformed
            if (t === GITIGNORE_BLOCK_END)
                return [b, e];
        }
    }
    return [-1, -1];
}
/**
 * Ensure every managed path is covered: locate the marker block in the
 * project's .gitignore (CRLF-tolerant) and add missing lines inside it;
 * no block → append one at the file tail; no file → create one containing
 * only the block. Lines outside the block keep their bytes — including
 * CRLF endings (F2) and blank-line structure (F5). Write errors propagate
 * to the caller, which degrades to an advisory.
 */
export function ensureGitignoreEntries(projectRoot) {
    const uncovered = findUncoveredManagedPaths(projectRoot);
    if (uncovered.length === 0)
        return { changed: false, added: [] };
    const gitignorePath = join(projectRoot, ".gitignore");
    const hadFile = existsSync(gitignorePath);
    // Raw line model (F2 + O3): each element keeps its original bytes (CRLF
    // lines keep their \r); ONE trailing newline is stripped before splitting
    // so the split never leaves a phantom empty last line — the write below
    // restores exactly one trailing newline when the file had one.
    let lines = [];
    let hadTrailingNewline = false;
    if (hadFile) {
        let raw = readFileSync(gitignorePath, "utf-8");
        hadTrailingNewline = raw.endsWith("\n");
        if (hadTrailingNewline)
            raw = raw.slice(0, -1);
        lines = toLines(raw);
    }
    const [beginIdx, endIdx] = locateBlock(lines);
    let added;
    if (beginIdx !== -1) {
        // Well-formed block: add only the lines missing from its body.
        const body = new Set(lines.slice(beginIdx + 1, endIdx).map((l) => l.trim()));
        added = uncovered.filter((p) => !body.has(p));
        if (added.length === 0)
            return { changed: false, added: [] };
        lines.splice(beginIdx + 1, 0, ...added);
    }
    else {
        // No well-formed block: append one at the tail. Orphan markers, if
        // any, stay — they are user-file content and never participate in
        // pairing (F3). Line separation is the "\n" of the join itself; the
        // final newline written below restores the file's terminated state.
        added = [...uncovered];
        lines.push(GITIGNORE_BLOCK_BEGIN, ...added, GITIGNORE_BLOCK_END);
    }
    // join("\n") preserves every original line's bytes (CRLF lines keep
    // their \r as part of the line content); the file's original trailing
    // newline state is restored.
    writeFileSync(gitignorePath, lines.join("\n") + (hadTrailingNewline || !hadFile ? "\n" : ""));
    return { changed: true, added };
}
/**
 * Remove the managed block (uninstall). Block-external lines are preserved
 * byte-for-byte — no blank-run collapsing, no leading/trailing whitespace
 * trims (review F5); the file's original trailing-newline state is kept.
 * A file left with no content at all is deleted. No well-formed block →
 * no-op (idempotent; malformed marker pairs are user-file content, F3).
 * Write errors propagate.
 */
export function removeManagedBlock(projectRoot) {
    const gitignorePath = join(projectRoot, ".gitignore");
    if (!existsSync(gitignorePath))
        return { removed: false, fileDeleted: false };
    const raw = readFileSync(gitignorePath, "utf-8");
    const hadTrailingNewline = raw.endsWith("\n");
    const body = hadTrailingNewline ? raw.slice(0, -1) : raw;
    const lines = toLines(body);
    const [beginIdx, endIdx] = locateBlock(lines);
    if (beginIdx === -1)
        return { removed: false, fileDeleted: false };
    const kept = [...lines.slice(0, beginIdx), ...lines.slice(endIdx + 1)];
    const content = kept.join("\n");
    if (content.trim() === "") {
        rmSync(gitignorePath);
        return { removed: true, fileDeleted: true };
    }
    writeFileSync(gitignorePath, hadTrailingNewline ? content + "\n" : content);
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
export function managedBlockAdvisoryHint(uncovered) {
    return ("Could not update .gitignore — these generated paths are NOT ignored: " +
        uncovered.join(", ") +
        " — add them to .gitignore manually");
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
export function detectTrackedFiles(projectRoot) {
    const args = [
        "-C",
        projectRoot,
        "ls-files",
        "--",
        ...MANAGED_GITIGNORE_PATHS,
    ];
    let stdout = "";
    try {
        // `?? ""` also guards mocked/odd runtimes returning undefined — an
        // empty result simply means "nothing tracked".
        stdout = execFileSync("git", args, {
            encoding: "utf-8",
            timeout: 5000,
            stdio: ["pipe", "pipe", "pipe"],
            shell: needsShell,
            maxBuffer: 1024 * 1024,
        }) ?? "";
    }
    catch {
        return []; // no git binary / not a repo / timeout — advisory only
    }
    const trackedLines = stdout.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (trackedLines.length === 0)
        return [];
    const reported = [];
    let overflow = 0;
    for (const rel of MANAGED_GITIGNORE_PATHS) {
        const isDir = rel.endsWith("/");
        const hits = trackedLines.filter((t) => isDir ? t === rel.replace(/\/$/, "") || t.startsWith(rel) : t === rel);
        if (hits.length === 0)
            continue;
        if (isDir) {
            reported.push(`${rel} (${hits.length} files tracked)`);
        }
        else if (reported.length < 5) {
            reported.push(rel);
        }
        else {
            overflow++;
        }
    }
    if (overflow > 0)
        reported.push(`… +${overflow} more`);
    return reported;
}
//# sourceMappingURL=gitignore-managed.js.map