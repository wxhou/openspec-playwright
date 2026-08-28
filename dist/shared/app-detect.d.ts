export interface PackageJson {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    workspaces?: string[] | {
        packages?: string[];
    };
}
export interface AppServerDetection {
    projectRoot: string;
    npmRoot: string;
    packageJsonPath: string;
    scripts: Record<string, string>;
    scriptName?: string;
    scriptCommand?: string;
    devCommand?: string;
    baseUrl: string;
    baseUrlSource: string;
    port?: number;
    portSource?: string;
}
export declare function findNpmRoot(projectRoot: string, maxDepth?: number): string;
export declare function chooseDevScript(scripts: Record<string, string>): string | undefined;
export declare function parsePort(text: string): number | undefined;
/**
 * Detect whether the project has frontend code — layered signals, specific
 * first, stop on first hit:
 *   1. framework config files at the project/npm root (strongest);
 *   2. framework dependencies in the package.json located by findNpmRoot
 *      (same source as detectAppServer, so monorepo conclusions match);
 *   3. dev-script command keywords;
 *   4. monorepo workspace members (bounded scan) — frontend code commonly
 *      lives in member packages (e.g. pnpm apps/*) whose root package.json
 *      carries no frontend deps at all.
 * Returns null when no readable package.json is found at the located root —
 * callers skip the hint in that case (detection skipped, not "no frontend").
 * Deliberately biased toward "frontend": a false positive costs one extra
 * MCP install (--no-mcp skips it); a false negative silently skips the MCP.
 */
export declare function hasFrontendSignal(projectRoot: string): boolean | null;
export declare function detectAppServer(projectRoot: string, env?: NodeJS.ProcessEnv): AppServerDetection;
