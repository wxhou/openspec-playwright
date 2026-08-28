export interface UpdateOptions {
    cli?: boolean;
    skill?: boolean;
    mcp?: boolean;
}
export declare function update(options: UpdateOptions): Promise<void>;
/**
 * Drift-aware sync of employee-grade standards into AGENTS.md (SSOT) and the
 * CLAUDE.md wrapper (when Claude is detected). Extracted so it can also run
 * under `--no-skill` — standards sync is not a skill install and must not be
 * silently skipped by that flag.
 */
export declare function syncEmployeeStandards(tmpDir: string, projectRoot: string, claudeAuthorized: boolean, hasPwArtifacts: boolean): void;
export declare function syncProjectTemplates(tmpDir: string, projectRoot: string): void;
/**
 * Sync credentials.yaml — update template structure while preserving user data.
 * Extracts api + users array from existing file, injects into latest template.
 * Falls back to warning if template structure changed significantly.
 */
export declare function syncCredentials(tmpDir: string, projectRoot: string): void;
