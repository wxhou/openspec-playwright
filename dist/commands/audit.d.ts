interface AuditResult {
    fileName: string;
    issue: string;
    detail?: string;
}
export declare function audit(): Promise<void>;
export interface SpecAnchor {
    capability: string;
    requirementTitle: string;
    /** 0-based line index of the anchor comment (directly usable for adjacency). */
    line: number;
}
/** Extract every `// spec: <cap>#<title>` line from a spec file's content. */
export declare function extractSpecAnchors(content: string): SpecAnchor[];
/**
 * Indices of content lines that belong to a `test.fixme(...)` block. A fixme
 * test is a declared "known-stale, kept on purpose" — anchor checks skip it
 * (reporting it would be noise and push users toward deleting the anchor to
 * silence the report). Line-level regex, same style as the flake scanner.
 */
export declare function extractFixmeLines(content: string): Set<number>;
interface AnchorAuditInput {
    /** Project root containing `openspec/`. */
    projectRoot: string;
    /** tests/playwright directory. */
    testsDir: string;
    /** All collected .spec.ts files (absolute paths). */
    specFiles: string[];
}
export interface AnchorAuditOutput {
    /** Issue results to append to the main audit report. */
    results: AuditResult[];
    /** Per-directory info lines for anchor-free tests (never counted as issues). */
    infoLines: string[];
}
/**
 * Check 4c: report tests whose spec anchor points at a requirement that no
 * longer exists in the main spec. Pure computation over injected reads so
 * unit tests never need a real openspec tree — the fs-reading variant below
 * wires this into audit().
 */
export declare function auditAnchorsCore(input: AnchorAuditInput & {
    readMainSpec: (capability: string) => string | null;
    readArchivedDeltas: (capability: string) => Array<{
        change: string;
        content: string;
    }>;
}): AnchorAuditOutput;
export declare function getSitemapRoutes(projectRoot: string): Promise<{
    routes: string[];
    note: string | null;
}>;
export {};
