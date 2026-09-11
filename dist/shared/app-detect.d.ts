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
 * consumers select init's minimal mode for that case (init-minimal-mode) and
 * print an informational line; "false" means no signal at all. The signal
 * also selects init mode (frontend | minimal) and gates the Playwright MCP
 * / vendored-agents installs — see explainFrontendSignal for attribution.
 */
export declare function hasFrontendSignal(projectRoot: string): boolean | null;
/**
 * Attribution companion to hasFrontendSignal: re-runs the same layers in the
 * same order and returns a human-readable description of the hit
 * ("vite.config.ts", "dependency: react", "dev script: vite",
 * "workspace member: apps/web (react)") for init's Summary transparency
 * line; null when there is no hit (signal false or undetectable — callers
 * gate on the boolean first). Deliberately a separate re-computation instead
 * of widening the hasFrontendSignal return type: existing callers keep their
 * boolean contract, and the re-scan is bounded by the same workspace limits.
 */
export declare function explainFrontendSignal(projectRoot: string): string | null;
export declare function detectAppServer(projectRoot: string, env?: NodeJS.ProcessEnv): AppServerDetection;
