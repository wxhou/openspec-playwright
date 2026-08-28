/**
 * Drift detection: compare tool-owned assets in a user project against the
 * currently-bundled templates.
 *
 * Pure functions (no fs, no network) so they are trivially unit-testable.
 * The compare baseline is located via `import.meta.url` relative to the
 * installed package root — works for both global installs
 * (`<nvm>/lib/node_modules/openspec-playwright`) and local devDependencies
 * (`<project>/node_modules/openspec-playwright`).
 */
import { fileURLToPath } from "url";
import { join } from "path";

// openspec-pw-owned territory markers. The "-PW" namespace cannot match the
// official `@fission-ai/openspec` legacy cleanup, which deletes any root
// AGENTS.md/CLAUDE.md block wrapped in plain `OPENSPEC:START/END` markers
// (it wiped our standards block — 2026-08-28 incident).
export const OPENSPEC_START = "<!-- OPENSPEC-PW:START -->";
export const OPENSPEC_END = "<!-- OPENSPEC-PW:END -->";

// Pre-migration markers shared with the official CLI (it deletes them as
// "legacy"). Direct references are allowed ONLY in the migration code,
// uninstall cleanup, and tests — detection predicates go through the helpers
// below so no other call site needs to know the legacy strings.
export const LEGACY_OPENSPEC_START = "<!-- OPENSPEC:START -->";
export const LEGACY_OPENSPEC_END = "<!-- OPENSPEC:END -->";

export function hasLegacyTerritoryStart(content: string): boolean {
  return content.includes(LEGACY_OPENSPEC_START);
}

export interface DriftResult {
  /** true when the file's OPENSPEC block differs from the expected content */
  stale: boolean;
  /** the extracted block content (between markers), if both markers present */
  block?: string;
}

/**
 * Extract the OPENSPEC marker block from a file's content.
 * Returns `null` when there are no markers, and treats a truncated marker
 * (START without END) as a corrupted block.
 */
export function extractOpenSpecBlock(content: string): {
  startIdx: number;
  endIdx: number;
} | null {
  const startIdx = content.indexOf(OPENSPEC_START);
  if (startIdx === -1) return null;
  const endIdx = content.indexOf(OPENSPEC_END);
  if (endIdx === -1) return null; // truncated marker
  return { startIdx, endIdx: endIdx + OPENSPEC_END.length };
}

/**
 * Compare a file's OPENSPEC block against the expected block content.
 * - No markers → not tool-owned → `stale:false` (don't misreport)
 * - Truncated marker (only START, or only END) → treated as stale (corrupted)
 * - Both markers → compare the inner content (normalized newlines, trimmed)
 */
export function compareBlock(
  fileContent: string,
  expectedBlock: string,
): DriftResult {
  const range = extractOpenSpecBlock(fileContent);
  if (!range) {
    // No markers at all → the asset is not tool-owned, no drift. But a lone
    // marker (START without END, or END without START) is corrupted and counts
    // as stale so the caller repairs it.
    const hasStart = fileContent.includes(OPENSPEC_START);
    const hasEnd = fileContent.includes(OPENSPEC_END);
    const truncated = hasStart || hasEnd;
    return { stale: truncated, block: truncated ? fileContent : undefined };
  }

  const block = fileContent.slice(range.startIdx + OPENSPEC_START.length, range.endIdx - OPENSPEC_END.length);
  // Normalize CRLF → LF inside the block so files saved with \r\n on Windows
  // compare equal to the LF-only bundled template.
  const normalizedFile = block.replace(/\r\n/g, "\n").trim();
  const normalizedExpected = expectedBlock.replace(/\r\n/g, "\n").trim();
  return {
    stale: normalizedFile !== normalizedExpected,
    block,
  };
}

// ─── Bundled-template path resolution ─────────────────────────────────────
// This module compiles to dist/shared/drift.js, so `../../` from here resolves
// to the installed package root — same pattern init.ts uses for templates.

const PKG_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Absolute path to the bundled employee-standards.md inside this package. */
export function bundledStandardsPath(): string {
  return join(PKG_ROOT, "employee-standards.md");
}

/**
 * Absolute path to a bundled template file (e.g. "templates/e2e-command.md").
 * Resolves relative to the installed package root.
 */
export function bundledTemplatePath(rel: string): string {
  return join(PKG_ROOT, rel);
}
