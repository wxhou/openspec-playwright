export interface BaseExecOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    encoding?: BufferEncoding;
    timeout?: number;
    maxBuffer?: number;
    windowsHide?: boolean;
}
export interface ExecOptions extends BaseExecOptions {
    /** `"pipe"` captures stdout/stderr; stdin is ignored. */
    stdio?: "pipe" | "ignore" | "inherit";
}
export interface ExecSyncOptions extends BaseExecOptions {
    stdio?: "pipe" | "ignore" | "inherit" | ReadonlyArray<"pipe" | "ignore" | "inherit" | "ipc" | null>;
}
export interface ExecResult {
    stdout: string;
    stderr: string;
}
export interface SpawnSyncResult<T = Buffer> {
    pid?: number;
    output?: Array<T | null>;
    stdout?: T | null;
    stderr?: T | null;
    status: number | null;
    signal: NodeJS.Signals | null;
    error?: Error;
}
/**
 * Run a command without a shell. Cross-spawn resolves Windows `.cmd` shims
 * through `cmd.exe` with its own escaping, so argument arrays stay safe.
 */
export declare function execFileAsync(file: string, args: readonly string[], options?: ExecOptions): Promise<ExecResult>;
export declare function execFileSync(file: string, args: readonly string[], options: ExecSyncOptions & {
    encoding: BufferEncoding;
}): string;
export declare function execFileSync(file: string, args: readonly string[], options?: ExecSyncOptions): Buffer | null;
export declare function spawnSync(file: string, args: readonly string[], options: ExecSyncOptions & {
    encoding: BufferEncoding;
}): SpawnSyncResult<string>;
export declare function spawnSync(file: string, args: readonly string[], options?: ExecSyncOptions): SpawnSyncResult<Buffer>;
