/**
 * Project rules file management: OPENSPEC marker blocks inside
 * AGENTS.md (single source of truth) and the thin CLAUDE.md wrapper for
 * Claude Code (@AGENTS.md import).
 */
import {
  existsSync,
  lstatSync,
  realpathSync,
  rmSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import { dirname, join, basename } from "path";
import chalk from "chalk";
// The marker constants hold no regex metacharacters, so they are safe to
// interpolate into the RegExp below.
import {
  OPENSPEC_START,
  OPENSPEC_END,
  LEGACY_OPENSPEC_START,
  LEGACY_OPENSPEC_END,
  hasLegacyTerritoryStart,
} from "../../shared/drift.js";
import type { EditorAdapter } from "./types.js";
import { claudeAdapter } from "./adapters/claude.js";
import { codebuddyAdapter } from "./adapters/codebuddy.js";
import { opencodeAdapter, readOpenCodeInstructions } from "./adapters/opencode.js";
import { getAllAdapters } from "./registry.js";

// ─── Project rules file (CLAUDE.md / AGENTS.md) ──────────────────────────

/**
 * Read the OPENSPEC marker block from a rules file, or `null` when the file
 * is missing / has no markers. Used by drift detection and update to decide
 * whether a rules file needs rewriting.
 */
export function readOpenSpecBlock(projectRoot: string, adapter: EditorAdapter): string | null {
  const dest = adapter.projectRulesPath(projectRoot);
  if (!existsSync(dest)) return null;
  const content = readFileSync(dest, "utf-8");
  const startIdx = content.indexOf(OPENSPEC_START);
  const endIdx = content.indexOf(OPENSPEC_END);
  if (startIdx === -1 || endIdx === -1) return null;
  return content.slice(startIdx + OPENSPEC_START.length, endIdx).trim();
}

/**
 * Whether a rules file's OPENSPEC block matches the expected content.
 * A missing file or absent/truncated markers counts as "does not match"
 * (the caller will rewrite it), which keeps update idempotent but safe.
 */
export function blockMatchesExpected(
  projectRoot: string,
  adapter: EditorAdapter,
  expected: string,
): boolean {
  const block = readOpenSpecBlock(projectRoot, adapter);
  if (block === null) return false;
  return block === expected.trim();
}

/**
 * Install employee-grade standards into the editor's rules file
 * (CLAUDE.md for Claude, AGENTS.md for OpenCode, Cline, and Cursor). Wraps content in
 * `<!-- OPENSPEC-PW:START -->` / `<!-- OPENSPEC-PW:END -->` markers so future
 * updates can replace the block without touching the rest of the file.
 */
export function installOpenSpecBlock(
  projectRoot: string,
  standardsContent: string,
  adapter: EditorAdapter = claudeAdapter,
): void {
  const dest = adapter.projectRulesPath(projectRoot);
  const fileLabel = basename(dest);
  const markerStart = OPENSPEC_START;
  const markerEnd = OPENSPEC_END;

  // A symlinked rules file (dotfiles checkout) belongs to the user: writing
  // through it would edit a file outside the project. lstat also catches a
  // dangling link, which existsSync reports as missing.
  let destIsLink = false;
  try {
    destIsLink = lstatSync(dest).isSymbolicLink();
  } catch {
    // Missing file — the normal create path.
  }
  if (destIsLink) {
    console.log(
      chalk.gray(`  - ${fileLabel} is a symlink — skipping (would write through to its target)`),
    );
    return;
  }

  if (!existsSync(dest)) {
    const content = `# ${rulesFileTitle(projectRoot)}\n\n${markerStart}\n\n${standardsContent.trim()}\n\n${markerEnd}\n`;
    writeFileSync(dest, content);
    console.log(
      chalk.green(`  ✓ ${fileLabel}: created with employee-grade standards`),
    );
    return;
  }

  const existing = readFileSync(dest, "utf-8");
  const hasStart = existing.includes(markerStart);
  const hasEnd = existing.includes(markerEnd);

  if (hasStart && hasEnd) {
    const startIdx = existing.indexOf(markerStart);
    const endIdx = existing.indexOf(markerEnd) + markerEnd.length;
    const before = existing.slice(0, startIdx).trimEnd();
    const after = existing.slice(endIdx);
    const updated =
      before +
      "\n" +
      markerStart +
      "\n\n" +
      standardsContent.trim() +
      "\n\n" +
      markerEnd +
      after;
    writeFileSync(dest, updated);
    console.log(
      chalk.green(
        `  ✓ ${fileLabel}: updated employee-grade standards (markers preserved, content refreshed)`,
      ),
    );
  } else if (!hasStart && !hasEnd) {
    const updated =
      existing.trim() +
      "\n\n" +
      markerStart +
      "\n\n" +
      standardsContent.trim() +
      "\n\n" +
      markerEnd +
      "\n";
    writeFileSync(dest, updated);
    console.log(
      chalk.green(`  ✓ ${fileLabel}: appended employee-grade standards with markers`),
    );
  } else {
    // Incomplete markers (only START, or only END) — corrupted tool territory.
    // Keep everything before the first marker (user content), discard the
    // truncated tool output after it, and write a clean complete block so
    // `doctor`/`update` converge instead of dead-ending on a skipped file.
    const firstIdx = hasStart
      ? existing.indexOf(markerStart)
      : existing.indexOf(markerEnd);
    const header = existing.slice(0, firstIdx).trimEnd();
    const updated =
      header +
      "\n\n" +
      markerStart +
      "\n\n" +
      standardsContent.trim() +
      "\n\n" +
      markerEnd +
      "\n";
    writeFileSync(dest, updated);
    console.log(
      chalk.green(
        `  ✓ ${fileLabel}: repaired incomplete OPENSPEC markers with employee-grade standards`,
      ),
    );
  }
}

/**
 * The expected OPENSPEC block content for a thin CLAUDE.md wrapper
 * (`@AGENTS.md` import only). Exported so drift detection / update can
 * compare against it.
 *
 * The `@AGENTS.md` line is Claude Code's documented way to reuse AGENTS.md
 * inside CLAUDE.md — AGENTS.md is NOT read by default ("Claude Code reads
 * CLAUDE.md, not AGENTS.md"). Contract per
 * https://code.claude.com/docs/en/memory.md:
 * - Position is irrelevant — the doc says "@ ... anywhere in your CLAUDE.md"
 *   (examples even inline it mid-sentence or in a list item). The one real
 *   constraint: the `@` line must NOT sit inside a code span (backticks) or
 *   a fenced code block — the resolver skips those. This wrapper keeps the
 *   import at the end of the block as a bare line.
 * - The path resolves relative to the importing CLAUDE.md; import recursion
 *   is capped at 4 hops.
 * - Block-level HTML comments (`<!-- ... -->`) are stripped before context
 *   injection, so the OPENSPEC markers vanish while the live `@AGENTS.md`
 *   line inside them is still honored.
 */
export function claudeWrapperStandardsContent(): string {
  return `@AGENTS.md\n`;
}

/**
 * The adapter's thin wrapper file (CLAUDE.md for claude, CODEBUDDY.md for
 * codebuddy), or null when the adapter reads AGENTS.md natively — the
 * wrapper-aware generalization of the claude-only pattern.
 */
export function wrapperRulesFile(
  adapter: EditorAdapter,
  projectRoot: string,
): string | null {
  const dest = adapter.projectRulesPath(projectRoot);
  return basename(dest) === "AGENTS.md" ? null : dest;
}

/**
 * Wrapper territory: true when the adapter's wrapper file carries our
 * OPENSPEC-PW marker block (the minimal-mode gate — command artifacts
 * absent per init-minimal-mode; a bare @AGENTS.md import never counts).
 */
export function wrapperHasMarkers(
  adapter: EditorAdapter,
  projectRoot: string,
): boolean {
  const dest = wrapperRulesFile(adapter, projectRoot);
  if (!dest) return false;
  return existsSync(dest) && readFileSync(dest, "utf-8").includes(OPENSPEC_START);
}

/**
 * Install a thin wrapper file that imports AGENTS.md. One implementation
 * for every wrapper-carrying editor (claude, codebuddy) — the wrapper
 * content and territory semantics are identical.
 *
 * Uses the same OPENSPEC-PW:START/END markers as the full standards block so
 * `cleanProjectRules` can remove it uniformly. The block contains only the
 * `@AGENTS.md` import; the standards themselves live in AGENTS.md.
 *
 * Also handles migration: if the wrapper file has an existing legacy
 * OPENSPEC:START block (old format that wrote standards directly), calling
 * `installOpenSpecBlock` replaces the content with the `@AGENTS.md` import.
 */
export function installThinWrapper(adapter: EditorAdapter, projectRoot: string): void {
  const dest = adapter.projectRulesPath(projectRoot);
  const fileLabel = basename(dest);

  // Wrapper symlinked (typically → AGENTS.md, the officially documented
  // reuse pattern): AGENTS.md itself is what the editor reads, and
  // installProjectRules already keeps the full standards in it. Writing a
  // wrapper here would overwrite them through the symlink (and the wrapper's
  // @AGENTS.md import would self-reference). Skip instead.
  if (existsSync(dest)) {
    if (lstatSync(dest).isSymbolicLink()) {
      console.log(
        chalk.gray(
          `  - ${fileLabel} is a symlink to AGENTS.md — standards live there, no wrapper needed`,
        ),
      );
      return;
    }
  }

  // No-op if our wrapper (@AGENTS.md import) is already in place —
  // content-equal, so a user edit inside the markers is detected. A bare
  // @AGENTS.md without our markers (added by openspec CLI or the user) is
  // left untouched — its content already matches the wrapper.
  if (existsSync(dest)) {
    const existing = readFileSync(dest, "utf-8");
    const hasMarkers = existing.includes(OPENSPEC_START);
    if (!hasMarkers && /^@AGENTS\.md\r?$/m.test(existing)) {
      return;
    }
    if (hasMarkers && blockMatchesExpected(projectRoot, adapter, claudeWrapperStandardsContent())) {
      return;
    }
  }

  // Delegate to installOpenSpecBlock which handles create/update/append
  // with OPENSPEC-PW:START/END markers.
  installOpenSpecBlock(
    projectRoot,
    claudeWrapperStandardsContent(),
    adapter,
  );
}

/**
 * Install a thin CLAUDE.md that imports AGENTS.md.
 */
export function installClaudeWrapper(projectRoot: string): void {
  installThinWrapper(claudeAdapter, projectRoot);
}

/**
 * Install a thin CODEBUDDY.md that imports AGENTS.md (CodeBuddy prefers
 * CODEBUDDY.md over AGENTS.md when both exist — official memory rules).
 */
export function installCodebuddyWrapper(projectRoot: string): void {
  installThinWrapper(codebuddyAdapter, projectRoot);
}

/**
 * Route employee-grade standards into project rules files.
 *
 * AGENTS.md is always the single source of truth, regardless of which
 * editors are detected. If Claude is in use, a thin CLAUDE.md wrapper
 * with `@AGENTS.md` import is created so Claude loads AGENTS.md as
 * its project rules. Cline and Cursor auto-detect AGENTS.md natively — no
 * wrapper needed.
 */
export function installProjectRules(
  projectRoot: string,
  standardsContent: string,
  detected: EditorAdapter[],
): void {
  if (detected.length === 0) return;

  // AGENTS.md is always the single source of truth
  installOpenSpecBlock(projectRoot, standardsContent, opencodeAdapter);

  // Thin wrapper for every editor whose rules file is not AGENTS.md
  // (CLAUDE.md, CODEBUDDY.md). Derived from the adapter's rules path — no
  // per-editor branch.
  for (const adapter of detected) {
    if (wrapperRulesFile(adapter, projectRoot) !== null) {
      installThinWrapper(adapter, projectRoot);
    }
  }

  // Register AGENTS.md in editors whose config lists project instructions
  // (OpenCode's opencode.json(c)). Declared, not hardcoded per id.
  for (const adapter of detected) {
    if (
      adapter.declaration?.rules?.registerInConfig === "opencode-json" &&
      adapter.registerInstructions
    ) {
      const existing = readOpenCodeInstructions(projectRoot);
      const next = Array.from(new Set([...(existing ?? []), "AGENTS.md"]));
      adapter.registerInstructions(projectRoot, next);
    }
  }
}

/**
 * Remove all OpenSpec marker blocks from AGENTS.md (always) and the adapter's
 * wrapper file (claude/codebuddy). Returns whether any file changed.
 * `onChanged` fires after each successful file change, so a caller tracking
 * progress for batch accounting knows about the first write even when a later
 * file fails.
 */
export function cleanProjectRules(
  adapter: EditorAdapter,
  projectRoot: string,
  options: { agents?: boolean; onChanged?: () => void } = {},
): boolean {
  let changed = false;
  // One project has one AGENTS.md — callers looping over adapters pass
  // agents:false after the first pass so skip notices are not repeated.
  if (options.agents !== false) {
    // A symlinked rules file (e.g. a dotfiles checkout) belongs to the user:
    // rewriting it would edit a file outside the project.
    const agents = join(projectRoot, "AGENTS.md");
    if (isSymlink(agents)) {
      console.log(
        chalk.gray("  - AGENTS.md is a symlink — skipping (would write through to its target)"),
      );
    } else {
      // Deleting the whole file would dangle a wrapper symlinked to it, so keep
      // the heading in that documented setup and strip markers only.
      const linked = getAllAdapters().some((a) =>
        wrapperLinksToAgents(projectRoot, a),
      );
      const removedAgents = removeMarkersFromFile(
        agents,
        "AGENTS.md",
        linked ? undefined : (bundledStandardsContent() ?? undefined),
      );
      if (removedAgents) options.onChanged?.();
      changed = removedAgents || changed;
    }
  }

  // Wrapper files (CLAUDE.md / CODEBUDDY.md) may carry the wrapper import
  const wrapper = wrapperRulesFile(adapter, projectRoot);
  if (wrapper) {
    if (isSymlink(wrapper)) {
      console.log(
        chalk.gray(
          `  - ${basename(wrapper)} is a symlink — skipping (would write through to its target)`,
        ),
      );
    } else {
      const removedWrapper = removeMarkersFromFile(
        wrapper,
        basename(wrapper),
        claudeWrapperStandardsContent(),
      );
      if (removedWrapper) options.onChanged?.();
      changed = removedWrapper || changed;
    }
  }
  return changed;
}

function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

/** True when a wrapper file is a symlink resolving to this project's AGENTS.md. */
export function wrapperLinksToAgents(projectRoot: string, adapter: EditorAdapter): boolean {
  const wrapper = wrapperRulesFile(adapter, projectRoot);
  if (!wrapper) return false;
  try {
    if (!lstatSync(wrapper).isSymbolicLink()) return false;
    return realpathSync(wrapper) === realpathSync(join(projectRoot, "AGENTS.md"));
  } catch {
    return false;
  }
}

/** Bundled employee standards, or null when the file cannot be read. */
function bundledStandardsContent(): string | null {
  try {
    return readFileSync(
      new URL("../../../employee-standards.md", import.meta.url),
      "utf-8",
    );
  } catch {
    return null;
  }
}

/** Heading install writes into a rules file it creates (shared with the pristine check). */
function rulesFileTitle(projectRoot: string): string {
  return basename(projectRoot) || "Project";
}

/**
 * True when `content` is exactly what `installOpenSpecBlock` writes for a
 * fresh file: the generated title plus the marker block around `body`. Lets
 * removal delete the file instead of leaving a title-only shell.
 */
function isPristineRulesFile(dest: string, content: string, body: string): boolean {
  const title = `# ${rulesFileTitle(dirname(dest))}`;
  const expected = `${title}\n\n${OPENSPEC_START}\n\n${body.trim()}\n\n${OPENSPEC_END}\n`;
  return content.replace(/\r\n/g, "\n") === expected.replace(/\r\n/g, "\n");
}

/**
 * True when every START marker is followed by exactly one END before the next
 * START. A malformed sequence (`START … START … END`, orphan `END`) means the
 * regex below would swallow user text between markers — such files are left
 * untouched.
 */
function markersPaired(content: string, start: string, end: string): boolean {
  const pattern = new RegExp(`${start}|${end}`, "g");
  let expectStart = true;
  for (const match of content.matchAll(pattern)) {
    if ((match[0] === start) !== expectStart) return false;
    expectStart = !expectStart;
  }
  return expectStart;
}

/**
 * Remove openspec-pw marker blocks (both namespaces) from a single file,
 * deleting the file entirely when it empties out. `pristineBody`, when given,
 * is the block body the tool writes on creation: a file matching that exact
 * generated form is deleted whole rather than left as a title-only shell.
 * Exported for the init deselect-removal flow (CLAUDE.md wrapper cleanup);
 * cleanProjectRules wraps it for the remove command's context.
 */
export function removeMarkersFromFile(
  dest: string,
  fileLabel: string,
  pristineBody?: string,
): boolean {
  if (!existsSync(dest)) {
    console.log(chalk.gray(`  - ${fileLabel} not found, skipping`));
    return false;
  }
  // Single entry point for both cleanProjectRules and init's deselect flow:
  // a symlinked rules file belongs to the user (dotfiles checkout) and must
  // never be rewritten through.
  if (isSymlink(dest)) {
    console.log(
      chalk.gray(`  - ${fileLabel} is a symlink — skipping (would write through to its target)`),
    );
    return false;
  }
  const existing = readFileSync(dest, "utf-8");

  if (pristineBody !== undefined && isPristineRulesFile(dest, existing, pristineBody)) {
    rmSync(dest);
    console.log(chalk.green(`  ✓ Removed ${fileLabel}`));
    return true;
  }

  // Both namespaces: our OPENSPEC-PW block and any surviving legacy
  // OPENSPEC: block (pre-migration installs). Removal must clean both, but a
  // legacy block is only ours when it carries our content signature — the
  // official @fission-ai/openspec CLI writes the same OPENSPEC:START/END
  // markers, and that block must survive. Ownership is judged per block: a
  // file can hold ours and an official one side by side.
  if (
    !markersPaired(existing, OPENSPEC_START, OPENSPEC_END) ||
    !markersPaired(existing, LEGACY_OPENSPEC_START, LEGACY_OPENSPEC_END)
  ) {
    console.log(chalk.yellow(`  ⚠ ${fileLabel}: marker block is unclosed — skipping`));
    return false;
  }
  const hasPwBlock = new RegExp(
    `${OPENSPEC_START}[\\s\\S]*?${OPENSPEC_END}`,
  ).test(existing);
  const legacyMatches = [
    ...existing.matchAll(
      new RegExp(
        `${LEGACY_OPENSPEC_START}[\\s\\S]*?${LEGACY_OPENSPEC_END}`,
        "g",
      ),
    ),
  ];
  const legacyOwned = legacyMatches.some((match) =>
    LEGACY_WRAPPER_SIGNATURES.some((signature) => match[0].includes(signature)),
  );
  const hasLegacyBlock = legacyMatches.length > 0;

  if (!hasPwBlock && !legacyOwned) {
    if (hasLegacyBlock) {
      console.log(
        chalk.gray(`  - ${fileLabel}: OPENSPEC block is not openspec-pw-owned — skipping`),
      );
    } else {
      console.log(chalk.gray(`  - No OpenSpec markers found in ${fileLabel}`));
    }
    return false;
  }

  // Remove markers and their content, consuming surrounding whitespace.
  // Then collapse runs of 3+ blank lines to at most 2 for a clean result.
  let updated = existing;
  if (hasPwBlock) {
    updated = updated.replace(
      new RegExp(`\\s*${OPENSPEC_START}[\\s\\S]*?${OPENSPEC_END}\\s*`, "g"),
      "\n\n",
    );
  }
  if (legacyOwned) {
    updated = updated.replace(
      new RegExp(
        `\\s*${LEGACY_OPENSPEC_START}[\\s\\S]*?${LEGACY_OPENSPEC_END}\\s*`,
        "g",
      ),
      (match) =>
        LEGACY_WRAPPER_SIGNATURES.some((signature) => match.includes(signature))
          ? "\n\n"
          : match,
    );
  }
  updated = updated.replace(/\n{3,}/g, "\n\n").trim();

  // Delete empty file rather than leaving a ghost.
  if (updated === "") {
    rmSync(dest);
    console.log(chalk.green(`  ✓ Removed empty ${fileLabel}`));
    return true;
  }

  writeFileSync(dest, updated + "\n");
  console.log(chalk.green(`  ✓ Removed OpenSpec markers from ${fileLabel}`));
  return true;
}

/**
 * True when `content` holds a marker block removals may clear: our
 * OPENSPEC-PW block, or a legacy OPENSPEC: block carrying our signature.
 * Official openspec blocks are not territory. Shared by the remove command's
 * dry-run plan so it lists only what execution would really delete.
 */
export function hasCleanableMarkers(content: string): boolean {
  if (
    !markersPaired(content, OPENSPEC_START, OPENSPEC_END) ||
    !markersPaired(content, LEGACY_OPENSPEC_START, LEGACY_OPENSPEC_END)
  ) {
    return false;
  }
  if (new RegExp(`${OPENSPEC_START}[\\s\\S]*?${OPENSPEC_END}`).test(content)) {
    return true;
  }
  for (const match of content.matchAll(
    new RegExp(
      `${LEGACY_OPENSPEC_START}[\\s\\S]*?${LEGACY_OPENSPEC_END}`,
      "g",
    ),
  )) {
    if (
      LEGACY_WRAPPER_SIGNATURES.some((signature) => match[0].includes(signature))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * True when the project's AGENTS.md carries a marker block removal would
 * clear. Init's deselect confirmation list uses this so an unclosed marker or
 * a symlinked file is not listed as "will be removed".
 */
export function agentsFileHasCleanableMarkers(projectRoot: string): boolean {
  const agents = join(projectRoot, "AGENTS.md");
  try {
    if (!existsSync(agents) || lstatSync(agents).isSymbolicLink()) return false;
    return hasCleanableMarkers(readFileSync(agents, "utf-8"));
  } catch {
    return false;
  }
}

/** Read the employee-grade standards source file (empty string if missing). */
export function readEmployeeStandards(srcPath: string): string {
  return existsSync(srcPath) ? readFileSync(srcPath, "utf-8") : "";
}

// ─── Legacy marker migration ──────────────────────────────────────────────
// The official `@fission-ai/openspec` CLI deletes any root AGENTS.md/CLAUDE.md
// block wrapped in plain OPENSPEC:START/END markers ("legacy cleanup"), which
// used to wipe our standards block. Our markers moved to the OPENSPEC-PW
// namespace; these helpers migrate surviving legacy blocks in place.

/** Our content signatures inside legacy blocks — an official legacy init
 * block never contains them, so it is never claimed by mistake. The wrapper
 * accepts either marker: the current wrapper carries "@AGENTS.md", but the
 * April-2026 format (v0.1.38–v0.3.2) wrote the FULL standards directly into
 * CLAUDE.md — that block is ours too, and must migrate (else update would
 * append a new wrapper next to it instead of replacing it). */
/** Our content signature inside legacy AGENTS.md blocks — an official legacy
 * init block never contains it, so it is never claimed by mistake. Exported
 * for the config-state predicates (configured.ts), which share the same
 * "official block ≠ our block" gate. */
export const LEGACY_MAIN_SIGNATURE = "Employee-Grade Standards";
const LEGACY_WRAPPER_SIGNATURES = ["@AGENTS.md", "Employee-Grade Standards"];

/**
 * Swap legacy markers for OPENSPEC-PW markers in one write (no half-migrated
 * state). Block content is preserved verbatim. Returns null when the file
 * has no locatable legacy territory: no legacy START (a lone legacy END
 * cannot be bounded safely), or the signature gate fails (not our block).
 */
function migrateLegacyMarkersInContent(content: string, signatures: string[]): string | null {
  if (!hasLegacyTerritoryStart(content)) return null;
  const startIdx = content.indexOf(LEGACY_OPENSPEC_START);
  const endIdx = content.indexOf(LEGACY_OPENSPEC_END);
  const matches = (inner: string) => signatures.some((s) => inner.includes(s));
  if (endIdx !== -1 && endIdx > startIdx) {
    const inner = content.slice(startIdx + LEGACY_OPENSPEC_START.length, endIdx);
    if (!matches(inner)) return null;
  } else {
    // Lone START (truncated): our content must appear after it.
    if (!matches(content.slice(startIdx))) return null;
  }
  // String replace swaps only the first occurrence — markers are unique.
  return content
    .replace(LEGACY_OPENSPEC_START, OPENSPEC_START)
    .replace(LEGACY_OPENSPEC_END, OPENSPEC_END);
}

/**
 * Migrate legacy OPENSPEC markers in AGENTS.md (and CLAUDE.md wrapper) to the
 * OPENSPEC-PW namespace. Gates:
 *   - hasPwArtifacts: without openspec-pw command artifacts the legacy block
 *     is an official relic, not our territory — untouched (remove cleans it).
 *   - claudeAuthorized: the CLAUDE.md wrapper is only touched for claude.
 *   - signature: block content must match ours (see signatures above).
 * Returns true when any file was migrated.
 */
export function migrateLegacyMarkers(
  projectRoot: string,
  hasPwArtifacts: boolean,
  claudeAuthorized: boolean,
  codebuddyAuthorized = false,
): boolean {
  if (!hasPwArtifacts) return false;
  let migrated = false;

  const agentsPath = join(projectRoot, "AGENTS.md");
  // A symlinked rules file (dotfiles checkout) belongs to the user — the
  // wrapper branch below already skips these.
  if (existsSync(agentsPath) && !lstatSync(agentsPath).isSymbolicLink()) {
    const content = readFileSync(agentsPath, "utf-8");
    const next = migrateLegacyMarkersInContent(content, [LEGACY_MAIN_SIGNATURE]);
    if (next !== null) {
      writeFileSync(agentsPath, next);
      console.log(
        chalk.green(
          "  ✓ AGENTS.md: migrated markers to OPENSPEC-PW (immune to openspec legacy cleanup)",
        ),
      );
      migrated = true;
    }
  }

  for (const [authorized, adapter] of [
    [claudeAuthorized, claudeAdapter],
    [codebuddyAuthorized, codebuddyAdapter],
  ] as const) {
    if (!authorized) continue;
    const wrapperPath = adapter.projectRulesPath(projectRoot);
    // Symlinked wrapper (→ AGENTS.md): AGENTS.md carries the migration; see
    // syncEmployeeStandards for why rewriting through the symlink is unsafe.
    if (existsSync(wrapperPath) && !lstatSync(wrapperPath).isSymbolicLink()) {
      const content = readFileSync(wrapperPath, "utf-8");
      const next = migrateLegacyMarkersInContent(content, LEGACY_WRAPPER_SIGNATURES);
      if (next !== null) {
        writeFileSync(wrapperPath, next);
        console.log(
          chalk.green(
            `  ✓ ${basename(wrapperPath)}: migrated markers to OPENSPEC-PW (immune to openspec legacy cleanup)`,
          ),
        );
        migrated = true;
      }
    }
  }
  return migrated;
}

/**
 * Any rules file carrying an openspec-pw marker block — the new
 * `OPENSPEC-PW:` namespace, or our main signature inside a legacy block
 * (legacy START required: a bare mention of the phrase in user prose is
 * not territory — same containment gate as migrateLegacyMarkers).
 * Extends the "standards block removed" authorization to minimal-mode
 * projects (standards only, no command artifacts): a surviving marker
 * block proves the project is ours (design D5 / init-minimal-mode).
 * Enumerates AGENTS.md plus every registered editor's wrapper file.
 */
export function hasRuleFileMarkers(
  projectRoot: string,
  maxBytes = Number.POSITIVE_INFINITY,
): boolean {
  const files = new Set<string>([join(projectRoot, "AGENTS.md")]);
  for (const adapter of getAllAdapters()) {
    const wrapper = wrapperRulesFile(adapter, projectRoot);
    if (wrapper) files.add(wrapper);
  }
  for (const path of files) {
    if (!existsSync(path)) continue;
    // Discovery over arbitrary trees skips oversized files rather than
    // reading them whole; init/update keep the default (no limit). A
    // partially mocked fs (tests) can omit statSync — fall through to the
    // content-length check below.
    try {
      if (statSync(path).size > maxBytes) continue;
    } catch {
      // stat unavailable — decide from the loaded content instead.
    }
    let content: string;
    try {
      content = readFileSync(path, "utf-8");
    } catch {
      // Unreadable rules file — treat as no markers. Discovery scans arbitrary
      // trees where a permission error must not abort the parent directory.
      continue;
    }
    if (Buffer.byteLength(content, "utf-8") > maxBytes) continue;
    if (content.includes(OPENSPEC_START)) return true;
    if (hasLegacyTerritoryStart(content) && content.includes(LEGACY_MAIN_SIGNATURE)) return true;
  }
  return false;
}
