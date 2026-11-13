export declare const SCAN_MAX_DEPTH = 6;
export declare const SCAN_MAX_DIRS = 50000;
export interface DiscoverOptions {
    /** Replaces the default scan roots when non-empty. `~` is expanded. */
    roots?: string[];
    /** Always merged into the result (first), even when outside the scan roots. */
    cwd?: string;
    maxDepth?: number;
    maxDirs?: number;
    homeDir?: string;
    platform?: NodeJS.Platform;
    /** Injectable drive probe for tests (defaults to existsSync). */
    driveExists?: (path: string) => boolean;
}
export interface DiscoverResult {
    /** Absolute project paths, deduplicated by realpath, cwd first when present. */
    projects: string[];
    /** True when the visited-directory cap stopped the scan early. */
    truncated: boolean;
    scannedDirs: number;
    /** Directories skipped because they could not be read. */
    unreadableDirs: number;
}
/** Does this directory carry any openspec-pw territory? Read-only, signal per design D4. */
export declare function hasOpenspecPwTerritory(projectRoot: string): boolean;
/** Scan for openspec-pw projects under the given (or default) roots. */
export declare function discoverProjects(options?: DiscoverOptions): DiscoverResult;
/** Default roots: home; on Windows, home plus every drive letter that exists. */
export declare function defaultScanRoots(homeDir: string, platform: NodeJS.Platform, driveExists: (path: string) => boolean): string[];
export declare function expandTilde(path: string, homeDir: string): string;
