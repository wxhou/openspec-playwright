export interface UpdateOptions {
    cli?: boolean;
    skill?: boolean;
    mcp?: boolean;
}
export declare function update(options: UpdateOptions): Promise<void>;
/**
 * Lines describing a CLI-vs-registry version mismatch. The advice depends on
 * where the running copy resolved from: a copy inside the project's
 * node_modules shadows the global binary, while a stale global install is
 * fixed by reinstalling globally (npm can serve a cached "latest" right after
 * a release, hence --prefer-online). Exported for tests.
 */
export declare function versionMismatchLines(resolvedPath: string, projectRoot: string, resolvedVersion: string, publishedVersion: string): string[];
/**
 * Drift-aware refresh of every configured editor's command artifact.
 *
 * Write authorization = tool-owned artifacts exist ("existing artifacts are
 * the manifest") — never detect(): a global config dir or a hand-created
 * marker directory does not authorize writes. update maintains territory; it
 * never expands it. Editors without artifacts are reported and skipped.
 *
 * Extracted from `update()` so the per-adapter refresh is testable without a
 * network round-trip to the npm registry.
 */
export declare function syncCommandArtifacts(projectRoot: string, body: string): void;
/**
 * Drift-aware sync of employee-grade standards into AGENTS.md (SSOT) and the
 * CLAUDE.md wrapper (when Claude is detected). Extracted so it can also run
 * under `--no-skill` — standards sync is not a skill install and must not be
 * silently skipped by that flag.
 */
export declare function syncEmployeeStandards(tmpDir: string, projectRoot: string, claudeAuthorized: boolean, hasPwArtifacts: boolean, codebuddyAuthorized?: boolean): void;
export declare function syncProjectTemplates(tmpDir: string, projectRoot: string): void;
/**
 * Sync credentials.yaml — update template structure while preserving user data.
 * Extracts api + users array from existing file, injects into latest template.
 * Falls back to warning if template structure changed significantly.
 */
export declare function syncCredentials(tmpDir: string, projectRoot: string): void;
