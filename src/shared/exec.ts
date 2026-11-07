import crossSpawn from "cross-spawn";
import type { SpawnOptions, SpawnSyncOptions } from "node:child_process";

export interface BaseExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  encoding?: BufferEncoding;
  timeout?: number;
  maxBuffer?: number;
  windowsHide?: boolean;
}

export interface ExecOptions extends BaseExecOptions {
  stdio?: "pipe" | "ignore" | "inherit";
}

export interface ExecSyncOptions extends BaseExecOptions {
  stdio?:
    | "pipe"
    | "ignore"
    | "inherit"
    | ReadonlyArray<"pipe" | "ignore" | "inherit" | "ipc" | null>;
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

const DEFAULT_MAX_BUFFER = 1024 * 1024;

function commandLabel(file: string, args: readonly string[]): string {
  return args.length > 0 ? `${file} ${args.join(" ")}` : file;
}

function makeExecError(
  file: string,
  args: readonly string[],
  status: number | null,
  signal: NodeJS.Signals | null,
  stdout: string,
  stderr: string,
): Error {
  const detail = stderr.trim() || stdout.trim();
  const error = new Error(
    `Command failed: ${commandLabel(file, args)}${detail ? `\n${detail}` : ""}`,
  );
  return Object.assign(error, {
    code: status ?? signal ?? undefined,
    status,
    signal,
    stdout,
    stderr,
  });
}

/**
 * Run a command without a shell. Cross-spawn resolves Windows `.cmd` shims
 * through `cmd.exe` with its own escaping, so argument arrays stay safe.
 */
export async function execFileAsync(
  file: string,
  args: readonly string[],
  options: ExecOptions = {},
): Promise<ExecResult> {
  const {
    cwd,
    env,
    encoding = "utf8",
    timeout,
    maxBuffer = DEFAULT_MAX_BUFFER,
    stdio = "pipe",
    windowsHide = true,
  } = options;

  const capture = stdio === "pipe";
  const child = crossSpawn(file, args, {
    cwd,
    env,
    timeout,
    windowsHide,
    stdio,
  } as unknown as SpawnOptions);

  let stdout = "";
  let stderr = "";
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let settled = false;

  return new Promise<ExecResult>((resolve, reject) => {
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const succeed = () => {
      if (settled) return;
      settled = true;
      resolve({ stdout, stderr });
    };
    const overflow = () => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(
        Object.assign(
          new Error(
            `Command output exceeded maxBuffer: ${commandLabel(file, args)}`,
          ),
          { code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER", stdout, stderr },
        ),
      );
    };

    if (capture) {
      child.stdout?.setEncoding(encoding);
      child.stderr?.setEncoding(encoding);
      child.stdout?.on("data", (chunk: string) => {
        stdout += chunk;
        stdoutBytes += Buffer.byteLength(chunk, encoding);
        if (stdoutBytes > maxBuffer) overflow();
      });
      child.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
        stderrBytes += Buffer.byteLength(chunk, encoding);
        if (stderrBytes > maxBuffer) overflow();
      });
    }

    child.on("error", fail);
    child.on("close", (status, signal) => {
      if (status === 0) succeed();
      else fail(makeExecError(file, args, status, signal, stdout, stderr));
    });
  });
}

export function execFileSync(
  file: string,
  args: readonly string[],
  options: ExecSyncOptions & { encoding: BufferEncoding },
): string;
export function execFileSync(
  file: string,
  args: readonly string[],
  options?: ExecSyncOptions,
): Buffer | null;
export function execFileSync(
  file: string,
  args: readonly string[],
  options: ExecSyncOptions = {},
): string | Buffer | null {
  const result = crossSpawn.sync(file, args, {
    maxBuffer: DEFAULT_MAX_BUFFER,
    ...options,
    windowsHide: options.windowsHide ?? true,
  } as unknown as SpawnSyncOptions);

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw makeExecError(
      file,
      args,
      result.status,
      result.signal,
      String(result.stdout ?? ""),
      String(result.stderr ?? ""),
    );
  }
  const stdout = result.stdout ?? null;
  if (options.encoding && stdout == null) return "";
  return stdout as string | Buffer | null;
}

export function spawnSync(
  file: string,
  args: readonly string[],
  options: ExecSyncOptions & { encoding: BufferEncoding },
): SpawnSyncResult<string>;
export function spawnSync(
  file: string,
  args: readonly string[],
  options?: ExecSyncOptions,
): SpawnSyncResult<Buffer>;
export function spawnSync(
  file: string,
  args: readonly string[],
  options: ExecSyncOptions = {},
): SpawnSyncResult<string | Buffer> {
  return crossSpawn.sync(file, args, {
    maxBuffer: DEFAULT_MAX_BUFFER,
    ...options,
    windowsHide: options.windowsHide ?? true,
  } as unknown as SpawnSyncOptions) as unknown as SpawnSyncResult<
    string | Buffer
  >;
}
