export interface UpdateOptions {
    cli?: boolean;
    skill?: boolean;
    mcp?: boolean;
}
export declare function update(options: UpdateOptions): Promise<void>;
export declare function syncSkillTemplates(tmpDir: string, projectRoot: string): void;
/**
 * Sync credentials.yaml — update template structure while preserving user data.
 * Extracts api + users array from existing file, injects into latest template.
 * Falls back to warning if template structure changed significantly.
 */
export declare function syncCredentials(tmpDir: string, projectRoot: string): void;
