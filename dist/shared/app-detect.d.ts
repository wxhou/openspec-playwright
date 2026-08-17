export interface PackageJson {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
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
 * Detect whether the project has frontend code: reads the package.json
 * located by findNpmRoot (same source as detectAppServer, so monorepo
 * conclusions match — a nested app is treated consistently by both).
 * Returns null when no readable package.json is found at the located root —
 * callers skip the hint in that case (detection skipped, not "no frontend").
 */
export declare function hasFrontendSignal(projectRoot: string): boolean | null;
export declare function detectAppServer(projectRoot: string, env?: NodeJS.ProcessEnv): AppServerDetection;
