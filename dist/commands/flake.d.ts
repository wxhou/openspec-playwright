export interface FlakeFinding {
    pattern: string;
    file: string;
    line: number;
    message: string;
    severity: "high" | "medium";
}
export interface FlakeReport {
    findings: FlakeFinding[];
    patternCounts: Record<string, number>;
    summaryText: string;
}
export declare function flake(changeName?: string, options?: {
    json?: boolean;
    gate?: string;
}): Promise<void>;
export declare function getConfigStorageState(projectRoot: string): boolean;
export declare function detectNetworkIdle(content: string, filePath: string): FlakeFinding[];
export declare function detectRouteAfterGoto(content: string, filePath: string): FlakeFinding[];
export declare function detectStorageLeakage(content: string, filePath: string, configHasStorageState: boolean): FlakeFinding[];
export declare function detectTestUseScope(content: string, filePath: string, configHasStorageState: boolean): FlakeFinding[];
export interface TimeoutIncrease {
    file: string;
    line: number;
    from: number;
    to: number;
}
/**
 * Timeout values on added diff lines that exceed the value of the line they
 * replaced, paired by position within each hunk (`git diff -U0`). `only`
 * restricts the result to those repo-relative paths, so a scoped run stays
 * inside its change.
 */
export declare function parseTimeoutIncreases(diff: string, only?: readonly string[]): TimeoutIncrease[];
export declare function buildReport(findings: FlakeFinding[]): FlakeReport;
export declare function computeGateExitCode(report: FlakeReport, gate: string): number;
