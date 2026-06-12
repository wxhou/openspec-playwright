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
export declare function detectAppServer(projectRoot: string, env?: NodeJS.ProcessEnv): AppServerDetection;
