import crossSpawn from "cross-spawn";
import type { SpawnOptions, SpawnSyncOptions } from "node:child_process";

export interface BaseExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  encoding?: BufferEncoding;
  /** Milliseconds before the command is terminated. */
  timeout?: number;
  maxBuffer?: number;
  windowsHide?: boolean;
}

export interface ExecOptions extends BaseExecOptions {
  /** `"pipe"` captures stdout/stderr; stdin is ignored. */
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
 *
 * `timeout` is enforced here rather than by the spawned child: a descendant
 * holding the stdio pipes can delay `close` indefinitely.
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
    windowsHide,
    // Keep stdin ignored: an open pipe makes stdin-reading commands hang.
    stdio: capture ? ["ignore", "pipe", "pipe"] : stdio,
  } as unknown as SpawnOptions);

  let stdout = "";
  let stderr = "";
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let settled = false;
  let timer: NodeJS.Timeout | undefined;

  return new Promise<ExecResult>((resolve, reject) => {
    const stdoutStream = child.stdout;
    const stderrStream = child.stderr;

    function cleanup(): void {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      stdoutStream?.off("data", onStdout);
      stderrStream?.off("data", onStderr);
    }

    function terminate(): void {
      child.kill();
      stdoutStream?.destroy();
      stderrStream?.destroy();
      (child as { unref?: () => void }).unref?.();
    }

    function fail(error: Error): void {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }

    function succeed(): void {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ stdout, stderr });
    }

    function overflow(): void {
      if (settled) return;
      settled = true;
      cleanup();
      terminate();
      reject(
        Object.assign(
          new Error(
            `Command output exceeded maxBuffer: ${commandLabel(file, args)}`,
          ),
          {
            code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
            killed: true,
            signal: "SIGTERM",
            stdout,
            stderr,
          },
        ),
      );
    }

    function onTimeout(): void {
      if (settled) return;
      settled = true;
      cleanup();
      terminate();
      reject(
        Object.assign(
          new Error(
            `Command timed out after ${timeout}ms: ${commandLabel(file, args)}`,
          ),
          {
            code: "ETIMEDOUT",
            killed: true,
            signal: "SIGTERM",
            stdout,
            stderr,
          },
        ),
      );
    }

    function onStdout(chunk: string): void {
      const bytes = Buffer.byteLength(chunk, encoding);
      if (stdoutBytes + bytes > maxBuffer) {
        overflow();
        return;
      }
      stdout += chunk;
      stdoutBytes += bytes;
    }

    function onStderr(chunk: string): void {
      const bytes = Buffer.byteLength(chunk, encoding);
      if (stderrBytes + bytes > maxBuffer) {
        overflow();
        return;
      }
      stderr += chunk;
      stderrBytes += bytes;
    }

    function onClose(
      status: number | null,
      signal: NodeJS.Signals | null,
    ): void {
      if (settled) return;
      if (status === 0) succeed();
      else fail(makeExecError(file, args, status, signal, stdout, stderr));
    }

    if (capture) {
      stdoutStream?.setEncoding(encoding);
      stderrStream?.setEncoding(encoding);
      stdoutStream?.on("data", onStdout);
      stderrStream?.on("data", onStderr);
    }

    child.on("error", fail);
    child.on("close", onClose);

    if (timeout !== undefined && timeout > 0) {
      timer = setTimeout(onTimeout, timeout);
    }
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
