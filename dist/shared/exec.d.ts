export interface ExecOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    encoding?: BufferEncoding;
    timeout?: number;
    maxBuffer?: number;
    stdio?: "pipe" | "ignore" | "inherit" | ReadonlyArray<"pipe" | "ignore" | "inherit" | "ipc" | null>;
    windowsHide?: boolean;
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
export declare function execFileSync(file: string, args: readonly string[], options: ExecOptions & {
    encoding: BufferEncoding;
}): string;
export declare function execFileSync(file: string, args: readonly string[], options?: ExecOptions): Buffer | null;
export declare function spawnSync(file: string, args: readonly string[], options: ExecOptions & {
    encoding: BufferEncoding;
}): SpawnSyncResult<string>;
export declare function spawnSync(file: string, args: readonly string[], options?: ExecOptions): SpawnSyncResult<Buffer>;
