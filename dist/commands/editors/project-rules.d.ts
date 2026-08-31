import type { EditorAdapter } from "./types.js";
/**
 * Read the OPENSPEC marker block from a rules file, or `null` when the file
 * is missing / has no markers. Used by drift detection and update to decide
 * whether a rules file needs rewriting.
 */
export declare function readOpenSpecBlock(projectRoot: string, adapter: EditorAdapter): string | null;
/**
 * Whether a rules file's OPENSPEC block matches the expected content.
 * A missing file or absent/truncated markers counts as "does not match"
 * (the caller will rewrite it), which keeps update idempotent but safe.
 */
export declare function blockMatchesExpected(projectRoot: string, adapter: EditorAdapter, expected: string): boolean;
/**
 * Install employee-grade standards into the editor's rules file
 * (CLAUDE.md for Claude, AGENTS.md for OpenCode, Cline, and Cursor). Wraps content in
 * `<!-- OPENSPEC-PW:START -->` / `<!-- OPENSPEC-PW:END -->` markers so future
 * updates can replace the block without touching the rest of the file.
 */
export declare function installOpenSpecBlock(projectRoot: string, standardsContent: string, adapter?: EditorAdapter): void;
/**
 * The expected OPENSPEC block content for a thin CLAUDE.md wrapper
 * (CodeGraph-first guidance + workflow hint + `@AGENTS.md` import). Exported
 * so drift detection / update can compare against it.
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
export declare function claudeWrapperStandardsContent(): string;
/**
 * Install a thin CLAUDE.md that imports AGENTS.md.
 *
 * Uses the same OPENSPEC-PW:START/END markers as the full standards block so
 * `cleanProjectRules` can remove it uniformly. The CodeGraph-first block is
 * written directly into CLAUDE.md (before the @AGENTS.md import) so Claude
 * Code picks it up without depending on the import.
 *
 * Also handles migration: if CLAUDE.md has an existing legacy OPENSPEC:START block
 * (old format that wrote standards directly to CLAUDE.md), calling
 * `installOpenSpecBlock` replaces the content with the CodeGraph block +
 * `@AGENTS.md` import.
 */
export declare function installClaudeWrapper(projectRoot: string): void;
/**
 * Route employee-grade standards into project rules files.
 *
 * AGENTS.md is always the single source of truth, regardless of which
 * editors are detected. If Claude is in use, a thin CLAUDE.md wrapper
 * with `@AGENTS.md` import is created so Claude loads AGENTS.md as
 * its project rules. Cline and Cursor auto-detect AGENTS.md natively — no
 * wrapper needed.
 */
export declare function installProjectRules(projectRoot: string, standardsContent: string, detected: EditorAdapter[]): void;
/** Remove all OpenSpec marker blocks from AGENTS.md (always) and CLAUDE.md (for claude adapter). */
export declare function cleanProjectRules(adapter: EditorAdapter, projectRoot: string): void;
/**
 * Remove openspec-pw marker blocks (both namespaces) from a single file,
 * deleting the file entirely when it empties out. Exported for the init
 * deselect-removal flow (CLAUDE.md wrapper cleanup); cleanProjectRules
 * wraps it for the uninstall context.
 */
export declare function removeMarkersFromFile(dest: string, fileLabel: string): void;
/** Read the employee-grade standards source file (empty string if missing). */
export declare function readEmployeeStandards(srcPath: string): string;
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
export declare const LEGACY_MAIN_SIGNATURE = "Employee-Grade Standards";
/**
 * Migrate legacy OPENSPEC markers in AGENTS.md (and CLAUDE.md wrapper) to the
 * OPENSPEC-PW namespace. Gates:
 *   - hasPwArtifacts: without openspec-pw command artifacts the legacy block
 *     is an official relic, not our territory — untouched (uninstall removes it).
 *   - claudeAuthorized: the CLAUDE.md wrapper is only touched for claude.
 *   - signature: block content must match ours (see signatures above).
 * Returns true when any file was migrated.
 */
export declare function migrateLegacyMarkers(projectRoot: string, hasPwArtifacts: boolean, claudeAuthorized: boolean): boolean;
