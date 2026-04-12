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
export declare function explore(options: ExploreOptions): Promise<void>;
