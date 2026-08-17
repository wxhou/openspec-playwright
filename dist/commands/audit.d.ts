export declare function audit(): Promise<void>;
export declare function getSitemapRoutes(projectRoot: string): Promise<{
    routes: string[];
    note: string | null;
}>;
