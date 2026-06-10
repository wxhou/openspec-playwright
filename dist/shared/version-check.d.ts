/**
 * Show a version update hint if the CLI is outdated.
 * Call this *after* the main command finishes so it doesn't block.
 */
export declare function checkForUpdate(currentVersion: string): Promise<void>;
