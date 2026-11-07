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
 */
export async function execFileAsync(file, args, options = {}) {
    const { cwd, env, encoding = "utf8", timeout, maxBuffer = DEFAULT_MAX_BUFFER, stdio = "pipe", windowsHide = true, } = options;
    const capture = stdio !== "inherit" && stdio !== "ignore";
    const child = crossSpawn(file, args, {
        cwd,
        env,
        timeout,
        windowsHide,
        stdio: capture ? ["ignore", "pipe", "pipe"] : stdio,
    });
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    return new Promise((resolve, reject) => {
        const fail = (error) => {
            if (settled)
                return;
            settled = true;
            reject(error);
        };
        const succeed = () => {
            if (settled)
                return;
            settled = true;
            resolve({ stdout, stderr });
        };
        const overflow = () => {
            if (settled)
                return;
            settled = true;
            child.kill();
            reject(Object.assign(new Error(`Command output exceeded maxBuffer: ${commandLabel(file, args)}`), { code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER", stdout, stderr }));
        };
        if (capture) {
            child.stdout?.setEncoding(encoding);
            child.stderr?.setEncoding(encoding);
            child.stdout?.on("data", (chunk) => {
                stdout += chunk;
                stdoutBytes += Buffer.byteLength(chunk, encoding);
                if (stdoutBytes > maxBuffer)
                    overflow();
            });
            child.stderr?.on("data", (chunk) => {
                stderr += chunk;
                stderrBytes += Buffer.byteLength(chunk, encoding);
                if (stderrBytes > maxBuffer)
                    overflow();
            });
        }
        child.on("error", fail);
        child.on("close", (status, signal) => {
            if (status === 0)
                succeed();
            else
                fail(makeExecError(file, args, status, signal, stdout, stderr));
        });
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
    return (result.stdout ?? null);
}
export function spawnSync(file, args, options = {}) {
    return crossSpawn.sync(file, args, {
        maxBuffer: DEFAULT_MAX_BUFFER,
        ...options,
        windowsHide: options.windowsHide ?? true,
    });
}
//# sourceMappingURL=exec.js.map