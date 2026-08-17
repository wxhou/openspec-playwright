export interface ExploreOptions {
    parallel?: number;
    dryRun?: boolean;
}
export interface RouteResult {
    path: string;
    url: string;
    status: "ok" | "error" | "auth-required" | "skipped";
    errorMessage?: string;
    snapshot: {
        title?: string;
        mainHeading?: string;
        formCount: number;
        linkCount: number;
    };
}
interface ParsedExplorationFile {
    baseUrl?: string;
    routes: Array<{
        path: string;
        auth: string;
        status: string;
        readySignal: string;
    }>;
    rawContent: string;
}
export declare function parseExplorationFile(content: string): ParsedExplorationFile;
/**
 * Resolve the exploration base URL. Priority: env BASE_URL > recorded
 * BASE_URL in app-exploration.md > detectAppServer detection chain (script
 * port / vite config / .env / framework default / seed) > localhost:3000.
 * Extracted from explore() so the precedence contract is unit-testable
 * (explore() itself launches a browser).
 */
export declare function resolveExploreBaseUrl(projectRoot: string, recordedBaseUrl: string | undefined, env?: NodeJS.ProcessEnv): string;
export declare function explore(options: ExploreOptions): Promise<void>;
export {};
