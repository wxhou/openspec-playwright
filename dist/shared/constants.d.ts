/**
 * Shared constants for openspec-playwright CLI.
 */
/** Template files that ship with the package (not user specs). */
export declare const SHARED_FILE_NAMES: Set<string>;
/** Timeout values in milliseconds. */
export declare const TIMEOUT: {
    /** claude mcp list / add / remove */
    readonly MCP_LIST: 10000;
    /** openspec list --json */
    readonly OPENSPEC_LIST: 30000;
    /** npm pack */
    readonly NPM_PACK: 30000;
    /** Playwright page.goto() */
    readonly NAVIGATION: 30000;
    /** Playwright browser launch */
    readonly BROWSER_LAUNCH: 60000;
};
