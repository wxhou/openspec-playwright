export interface RunOptions {
    project?: string;
    timeout?: number;
    json?: boolean;
    grep?: string;
}
export declare function run(changeName: string, options: RunOptions): Promise<void>;
interface TestResults {
    total: number;
    passed: number;
    failed: number;
    duration: string;
    authRequired?: boolean;
    appBugCount?: number;
    healedCount?: number;
    raftCount?: number;
    escalatedCount?: number;
    tests: Array<{
        name: string;
        status: "passed" | "failed";
        screenshot?: string;
        failureType?: string;
    }>;
}
export declare function parsePlaywrightOutput(output: string): TestResults;
export {};
