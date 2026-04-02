export interface RunOptions {
    project?: string;
    timeout?: number;
    json?: boolean;
}
export declare function run(changeName: string, options: RunOptions): Promise<void>;
interface TestResults {
    total: number;
    passed: number;
    failed: number;
    duration: string;
    tests: Array<{
        name: string;
        status: "passed" | "failed";
    }>;
}
export declare function parsePlaywrightOutput(output: string): TestResults;
export {};
