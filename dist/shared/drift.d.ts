export declare const OPENSPEC_START = "<!-- OPENSPEC-PW:START -->";
export declare const OPENSPEC_END = "<!-- OPENSPEC-PW:END -->";
export declare const LEGACY_OPENSPEC_START = "<!-- OPENSPEC:START -->";
export declare const LEGACY_OPENSPEC_END = "<!-- OPENSPEC:END -->";
export declare function hasLegacyTerritoryStart(content: string): boolean;
export declare function hasLegacyTerritoryEnd(content: string): boolean;
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
export declare function extractOpenSpecBlock(content: string): {
    startIdx: number;
    endIdx: number;
} | null;
/**
 * Compare a file's OPENSPEC block against the expected block content.
 * - No markers → not tool-owned → `stale:false` (don't misreport)
 * - Truncated marker (only START, or only END) → treated as stale (corrupted)
 * - Both markers → compare the inner content (normalized newlines, trimmed)
 */
export declare function compareBlock(fileContent: string, expectedBlock: string): DriftResult;
/** Absolute path to the bundled employee-standards.md inside this package. */
export declare function bundledStandardsPath(): string;
/**
 * Absolute path to a bundled template file (e.g. "templates/e2e-command.md").
 * Resolves relative to the installed package root.
 */
export declare function bundledTemplatePath(rel: string): string;
