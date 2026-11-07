import crossSpawn from "cross-spawn";
const DEFAULT_MAX_BUFFER = 1024 * 1024;
function commandLabel(file, args) {
    return args.length > 0 ? `${file} ${args.join(" ")}` : file;
}
function makeExecError(file, args, status, signal, stdout, stderr) {
    const detail = stderr.trim() || stdout.trim();
    const error = new Error(`Command failed: ${commandLabel(file, args)}${detail ? `\n${detail}` : ""}`);
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
export async function execFileAsync(file, args, options = {}) {
    const { cwd, env, encoding = "utf8", timeout, maxBuffer = DEFAULT_MAX_BUFFER, stdio = "pipe", windowsHide = true, } = options;
    const capture = stdio === "pipe";
    const child = crossSpawn(file, args, {
        cwd,
        env,
        windowsHide,
        // Keep stdin ignored: an open pipe makes stdin-reading commands hang.
        stdio: capture ? ["ignore", "pipe", "pipe"] : stdio,
    });
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let timer;
    return new Promise((resolve, reject) => {
        const stdoutStream = child.stdout;
        const stderrStream = child.stderr;
        function cleanup() {
            if (timer) {
                clearTimeout(timer);
                timer = undefined;
            }
            stdoutStream?.off("data", onStdout);
            stderrStream?.off("data", onStderr);
        }
        function terminate() {
            child.kill();
            stdoutStream?.destroy();
            stderrStream?.destroy();
            child.unref?.();
        }
        function fail(error) {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(error);
        }
        function succeed() {
            if (settled)
                return;
            settled = true;
            cleanup();
            resolve({ stdout, stderr });
        }
        function overflow() {
            if (settled)
                return;
            settled = true;
            cleanup();
            terminate();
            reject(Object.assign(new Error(`Command output exceeded maxBuffer: ${commandLabel(file, args)}`), {
                code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
                killed: true,
                signal: "SIGTERM",
                stdout,
                stderr,
            }));
        }
        function onTimeout() {
            if (settled)
                return;
            settled = true;
            cleanup();
            terminate();
            reject(Object.assign(new Error(`Command timed out after ${timeout}ms: ${commandLabel(file, args)}`), {
                code: "ETIMEDOUT",
                killed: true,
                signal: "SIGTERM",
                stdout,
                stderr,
            }));
        }
        function onStdout(chunk) {
            const bytes = Buffer.byteLength(chunk, encoding);
            if (stdoutBytes + bytes > maxBuffer) {
                overflow();
                return;
            }
            stdout += chunk;
            stdoutBytes += bytes;
        }
        function onStderr(chunk) {
            const bytes = Buffer.byteLength(chunk, encoding);
            if (stderrBytes + bytes > maxBuffer) {
                overflow();
                return;
            }
            stderr += chunk;
            stderrBytes += bytes;
        }
        function onClose(status, signal) {
            if (settled)
                return;
            if (status === 0)
                succeed();
            else
                fail(makeExecError(file, args, status, signal, stdout, stderr));
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
export function execFileSync(file, args, options = {}) {
    const result = crossSpawn.sync(file, args, {
        maxBuffer: DEFAULT_MAX_BUFFER,
        ...options,
        windowsHide: options.windowsHide ?? true,
    });
    if (result.error)
        throw result.error;
    if (result.status !== 0) {
        throw makeExecError(file, args, result.status, result.signal, String(result.stdout ?? ""), String(result.stderr ?? ""));
    }
    const stdout = result.stdout ?? null;
    if (options.encoding && stdout == null)
        return "";
    return stdout;
}
export function spawnSync(file, args, options = {}) {
    return crossSpawn.sync(file, args, {
        maxBuffer: DEFAULT_MAX_BUFFER,
        ...options,
        windowsHide: options.windowsHide ?? true,
    });
}
//# sourceMappingURL=exec.js.map