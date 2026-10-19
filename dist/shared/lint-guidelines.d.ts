export interface LintRuleEntry {
    /** Rule id as written in linter config/docs. */
    id: string;
    /** Linter that owns the rule. */
    tool: "ESLint" | "ruff" | "pylint";
    /** What shape of swallowed failure fires the rule. */
    semantics: string;
    /** Enabled by the linter's default rule set (no config needed). */
    defaultOn: boolean;
    /** Trigger scope — what the rule deliberately does NOT flag. */
    scope: string;
}
export declare const LINT_GUIDELINE_RULES: LintRuleEntry[];
/** Project-relative checklist file path (editor-agnostic reference asset). */
export declare const LINT_GUIDELINES_RELPATH = "lint-guidelines.md";
/** Checksum line prefix — content hash is computed excluding this line itself. */
export declare const LINT_GUIDELINES_CHECKSUM_PREFIX = "<!-- openspec-pw: lint-guidelines ";
/**
 * Ownership checksum: sha256 of the checklist body with the checksum line
 * removed, truncated to 8 hex chars. The checksum line must be stripped from
 * the input it hashes (self-reference would deadlock the comparison).
 */
export declare function computeChecklistChecksum(body: string): string;
/** True when the file's checksum line matches the file body (tool-owned). */
export declare function isChecklistUnmodified(content: string): boolean;
export type ChecklistDisposition = "created" | "unchanged" | "refreshed" | "kept-modified";
/** Uninstall-side disposition for the checklist file. */
export type ChecklistRemovalDisposition = "removed" | "kept-modified" | "absent";
/**
 * Uninstall the checklist: tool-owned (checksum intact) → remove;
 * user-modified → keep and report; missing → nothing to do.
 */
export declare function removeChecklist(projectRoot: string): ChecklistRemovalDisposition;
/**
 * Install or refresh the checklist in the project root, content-based
 * ownership (vendored-agents semantics): missing → copy; identical → no-op;
 * never user-modified (checksum intact) → overwrite with latest; user-modified
 * → leave untouched (caller reports it).
 */
export declare function installOrRefreshChecklist(projectRoot: string): ChecklistDisposition;
