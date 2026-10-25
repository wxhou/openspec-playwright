export type CheckName = "validate" | "lint" | "typecheck" | "test" | "flake" | "e2e" | "coverage" | "audit";
export type CheckStatus = "pass" | "fail" | "skipped" | "error";
export type Verdict = "pass" | "fail" | "inconclusive";
export interface CheckResult {
    name: CheckName;
    status: CheckStatus;
    exitCode: number | null;
    durationMs: number;
    reason?: string;
}
/** A file that loosens a check's own rules (lint config, tsconfig, ...). */
export interface GateFlag {
    path: string;
    added: number;
    removed: number;
}
export interface GateReport {
    verdict: Verdict;
    change: string | null;
    checks: CheckResult[];
    totals: Record<CheckStatus, number>;
    flags: GateFlag[];
}
export interface GateOptions {
    json?: boolean;
    keepGoing?: boolean;
    only?: string;
    skip?: string;
    coverageMin?: string;
    /**
     * Stop-hook mode: read the Claude Code payload from stdin, block with exit
     * 2 instead of 1, cache by working-tree fingerprint and never trap the turn.
     */
    hook?: boolean;
}
export interface ExecResult {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    /** Set when the process could not start or was killed by the timeout. */
    failure?: {
        kind: "missing" | "timeout";
        message: string;
    };
}
export type Executor = (cmd: string, args: string[], opts: {
    cwd: string;
    timeoutMs: number;
}) => ExecResult;
export interface GateDeps {
    cwd?: string;
    exec?: Executor;
    out?: (line: string) => void;
    err?: (line: string) => void;
    /** Overrides stdin in tests — reading fd 0 would block the runner. */
    hookPayload?: HookPayload;
}
/** Execution order is cheap-first and stable; docs quote it verbatim. */
export declare const DEFAULT_CHECKS: CheckName[];
/**
 * Valid names that are not run by default: their thresholds are project
 * specific, so they join the gate only when asked for explicitly.
 */
export declare const OPTIONAL_CHECKS: CheckName[];
export declare const ALL_CHECKS: CheckName[];
export declare function isCheckName(value: string): value is CheckName;
/**
 * Resolve the selected check list. Unknown names are a caller error, not a
 * gate failure — they exit 2 so the operator fixes the invocation.
 */
export declare function selectChecks(only?: string, skip?: string): {
    checks: CheckName[];
} | {
    error: string;
};
/** Any `error` makes the whole run undecidable, even if everything else passed. */
export declare function computeVerdict(checks: CheckResult[]): Verdict;
export declare function exitCodeForVerdict(verdict: Verdict): 0 | 1 | 2;
export declare function summarize(checks: CheckResult[]): Record<CheckStatus, number>;
export declare function isCheckConfigFile(path: string): boolean;
/** First non-empty stderr line — enough to locate the problem, short enough for a summary. */
export declare function firstReasonLine(stderr: string): string;
/** The project's Playwright config, or null when E2E is not set up here. */
export declare function findPlaywrightConfig(projectRoot: string): string | null;
export declare function countScenarios(changeDir: string): number;
export declare const defaultExecutor: Executor;
/** Capabilities this change touches that already have a main spec. */
export declare function touchedMainSpecs(cwd: string, change: string): string[];
/** Changed files under `HEAD`, with numstat. Untracked files count as all-added. */
export declare function collectChangedFiles(exec: Executor, cwd: string): Array<{
    path: string;
    added: number;
    removed: number;
}>;
/** New `test.fixme(` lines introduced by this change, as `path:line`. */
export declare function collectNewFixmes(exec: Executor, cwd: string, changed: Array<{
    path: string;
}>): string[];
export interface HookPayload {
    /** True when this stop is already the result of a previous block. */
    stop_hook_active?: boolean;
}
export declare const HOOK_CACHE_FILE: string;
/** Claude Code writes the event payload to stdin; absent stdin means none. */
export declare function readHookPayload(): HookPayload;
/** Identifies the working tree state the last verdict was computed against. */
export declare function worktreeFingerprint(exec: Executor, cwd: string): string;
interface HookCache {
    fingerprint: string;
    verdict: Verdict;
}
export declare function readHookCache(cwd: string): HookCache | null;
export declare function writeHookCache(cwd: string, cache: HookCache): void;
/**
 * Run the gate and return the process exit code. Pure wiring lives in the
 * helpers above so the behaviour can be unit-tested without spawning.
 */
export declare function gate(changeName?: string, options?: GateOptions, deps?: GateDeps): Promise<number>;
export {};
