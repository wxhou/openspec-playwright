/**
 * Composite quality gate.
 *
 * One command, one verdict, one exit code. The check list is defined here and
 * nowhere else — the Claude Code Stop hook, the CI workflow and the docs all
 * call this command rather than keeping their own copies.
 *
 * Exit codes: 0 pass, 1 gate failure, 2 cannot decide (missing tool, timeout,
 * ambiguous change). Callers use that split to choose between "fix the code"
 * and "fix the environment".
 */
import { spawnSync } from "child_process";
import { createHash } from "crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import { parseTimeoutIncreases } from "./flake.js";
// ─── Check registry ──────────────────────────────────────────────────────
/** Execution order is cheap-first and stable; docs quote it verbatim. */
export const DEFAULT_CHECKS = [
    "validate",
    "lint",
    "typecheck",
    "test",
    "flake",
    "e2e",
];
/**
 * Valid names that are not run by default: their thresholds are project
 * specific, so they join the gate only when asked for explicitly.
 */
export const OPTIONAL_CHECKS = ["coverage", "audit"];
export const ALL_CHECKS = [...DEFAULT_CHECKS, ...OPTIONAL_CHECKS];
/**
 * Checks that read a change's artifacts; the rest run on the tree alone.
 * `flake` and `audit` take an optional change name, so they work without one.
 */
const CHECK_NEEDS_CHANGE = new Set([
    "validate",
    "e2e",
    "coverage",
]);
const TIMEOUTS = {
    validate: 60_000,
    lint: 120_000,
    typecheck: 180_000,
    test: 300_000,
    flake: 60_000,
    e2e: 600_000,
    coverage: 60_000,
    audit: 120_000,
};
/** Config files whose loosening turns a check green without improving code. */
const CHECK_CONFIG_PATTERNS = [
    /(^|\/)eslint\.config\.[cm]?[jt]s$/,
    /(^|\/)\.eslintrc(\.[a-z]+)?$/,
    /(^|\/)\.eslintignore$/,
    /(^|\/)tsconfig[^/]*\.json$/,
    /(^|\/)playwright\.config\.[cm]?[jt]s$/,
    /(^|\/)vitest\.config\.[cm]?[jt]s$/,
];
// ─── Pure helpers (unit-tested) ──────────────────────────────────────────
export function isCheckName(value) {
    return ALL_CHECKS.includes(value);
}
/**
 * Resolve the selected check list. Unknown names are a caller error, not a
 * gate failure — they exit 2 so the operator fixes the invocation.
 */
export function selectChecks(only, skip) {
    const parse = (raw) => raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    let base = [...DEFAULT_CHECKS];
    if (only !== undefined) {
        const names = parse(only);
        if (names.length === 0) {
            return { error: "--only requires at least one check name" };
        }
        const unknown = names.filter((n) => !isCheckName(n));
        if (unknown.length > 0) {
            return {
                error: `unknown check name(s): ${unknown.join(", ")}. Valid: ${ALL_CHECKS.join(", ")}`,
            };
        }
        base = names;
    }
    if (skip !== undefined) {
        const names = parse(skip);
        const unknown = names.filter((n) => !isCheckName(n));
        if (unknown.length > 0) {
            return {
                error: `unknown check name(s): ${unknown.join(", ")}. Valid: ${ALL_CHECKS.join(", ")}`,
            };
        }
        base = base.filter((n) => !names.includes(n));
    }
    if (base.length === 0) {
        return { error: "no checks left to run after --only/--skip" };
    }
    return { checks: base };
}
/** Any `error` makes the whole run undecidable, even if everything else passed. */
export function computeVerdict(checks) {
    if (checks.some((c) => c.status === "error"))
        return "inconclusive";
    if (checks.some((c) => c.status === "fail"))
        return "fail";
    return "pass";
}
export function exitCodeForVerdict(verdict) {
    if (verdict === "pass")
        return 0;
    if (verdict === "fail")
        return 1;
    return 2;
}
export function summarize(checks) {
    const totals = {
        pass: 0,
        fail: 0,
        skipped: 0,
        error: 0,
    };
    for (const c of checks)
        totals[c.status]++;
    return totals;
}
export function isCheckConfigFile(path) {
    return CHECK_CONFIG_PATTERNS.some((re) => re.test(path));
}
/** First non-empty stderr line — enough to locate the problem, short enough for a summary. */
export function firstReasonLine(stderr) {
    const line = stderr
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.length > 0);
    return line ?? "";
}
// ─── Command resolution ──────────────────────────────────────────────────
function readScripts(projectRoot) {
    const pkgPath = join(projectRoot, "package.json");
    if (!existsSync(pkgPath))
        return {};
    try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        return pkg.scripts ?? {};
    }
    catch {
        return {};
    }
}
/** The CLI entry this package ships, used for self-invoked checks. */
function ownCliEntry() {
    return join(dirname(fileURLToPath(import.meta.url)), "..", "index.js");
}
function collectSpecFiles(dir, out = []) {
    if (!existsSync(dir))
        return out;
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory())
            collectSpecFiles(full, out);
        else if (entry.endsWith(".spec.ts"))
            out.push(full);
    }
    return out;
}
function collectDeltaSpecFiles(dir, out = []) {
    if (!existsSync(dir))
        return out;
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory())
            collectDeltaSpecFiles(full, out);
        else if (entry === "spec.md")
            out.push(full);
    }
    return out;
}
/** The project's Playwright config, or null when E2E is not set up here. */
export function findPlaywrightConfig(projectRoot) {
    for (const name of ["playwright.config.ts", "playwright.config.js", "playwright.config.mts", "playwright.config.cjs"]) {
        if (existsSync(join(projectRoot, name)))
            return join(projectRoot, name);
    }
    return null;
}
export function countScenarios(changeDir) {
    const specsDir = join(changeDir, "specs");
    let count = 0;
    for (const file of collectDeltaSpecFiles(specsDir)) {
        const content = readFileSync(file, "utf-8");
        count += (content.match(/^#### Scenario:/gm) ?? []).length;
    }
    return count;
}
// ─── Executor ────────────────────────────────────────────────────────────
export const defaultExecutor = (cmd, args, opts) => {
    const res = spawnSync(cmd, args, {
        cwd: opts.cwd,
        timeout: opts.timeoutMs,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        // Windows resolves npm/npx through .cmd shims, which need a shell.
        shell: process.platform === "win32",
    });
    if (res.error) {
        const err = res.error;
        if (err.code === "ENOENT") {
            return {
                exitCode: null,
                stdout: "",
                stderr: "",
                failure: { kind: "missing", message: `command not found: ${cmd}` },
            };
        }
        return {
            exitCode: null,
            stdout: "",
            stderr: "",
            failure: {
                kind: "timeout",
                message: `timed out after ${Math.round(opts.timeoutMs / 1000)}s`,
            },
        };
    }
    return {
        exitCode: res.status,
        stdout: res.stdout ?? "",
        stderr: res.stderr ?? "",
    };
};
/** Capabilities this change touches that already have a main spec. */
export function touchedMainSpecs(cwd, change) {
    const deltaSpecs = join(cwd, "openspec", "changes", change, "specs");
    const caps = [];
    for (const file of collectDeltaSpecFiles(deltaSpecs)) {
        const cap = relative(deltaSpecs, dirname(file)).replaceAll("\\", "/");
        if (existsSync(join(cwd, "openspec", "specs", cap, "spec.md")))
            caps.push(cap);
    }
    return caps;
}
function planFor(name, ctx) {
    const { projectRoot, change, scripts, coverageMin } = ctx;
    const node = process.execPath;
    const cli = ownCliEntry();
    switch (name) {
        case "validate":
            return {
                cmd: "openspec",
                args: ["validate", change, "--strict"],
                followups: touchedMainSpecs(projectRoot, change).map((cap) => ({
                    cmd: "openspec",
                    args: ["validate", cap, "--type", "spec"],
                })),
            };
        case "lint": {
            if (!scripts.lint)
                return { cmd: "", args: [], skip: "no `lint` script in package.json" };
            return { cmd: "npm", args: ["run", "lint"] };
        }
        case "typecheck": {
            if (!scripts.typecheck)
                return { cmd: "", args: [], skip: "no `typecheck` script in package.json" };
            return { cmd: "npm", args: ["run", "typecheck"] };
        }
        case "test": {
            const script = scripts["test:run"] ? "test:run" : scripts.test ? "test" : null;
            if (!script)
                return { cmd: "", args: [], skip: "no `test` or `test:run` script in package.json" };
            return { cmd: "npm", args: ["run", script] };
        }
        case "flake":
            return {
                cmd: node,
                args: [cli, "flake", ...(change ? [change] : []), "--gate", "HIGH"],
            };
        case "coverage": {
            if (!coverageMin)
                return { cmd: "", args: [], skip: "no --coverage-min threshold given" };
            return {
                cmd: node,
                args: [cli, "coverage", change, "--fail-under", coverageMin],
            };
        }
        case "audit":
            return { cmd: node, args: [cli, "audit", "--gate"] };
        case "e2e": {
            const testsDir = join(projectRoot, "tests", "playwright", "changes", change);
            if (!findPlaywrightConfig(projectRoot))
                return { cmd: "", args: [], skip: "no playwright config at project root" };
            if (!existsSync(testsDir))
                return { cmd: "", args: [], skip: "no test directory for this change" };
            return { cmd: "npx", args: ["playwright", "test", relative(projectRoot, testsDir)] };
        }
    }
}
function runOne(name, plan, deps) {
    const started = Date.now();
    if (plan.skip) {
        return { name, status: "skipped", exitCode: null, durationMs: 0, reason: plan.skip };
    }
    const res = deps.exec(plan.cmd, plan.args, {
        cwd: deps.cwd,
        timeoutMs: TIMEOUTS[name],
    });
    const durationMs = Date.now() - started;
    if (res.failure) {
        return { name, status: "error", exitCode: null, durationMs, reason: res.failure.message };
    }
    if (res.exitCode === 0) {
        for (const step of plan.followups ?? []) {
            const next = deps.exec(step.cmd, step.args, {
                cwd: deps.cwd,
                timeoutMs: TIMEOUTS[name],
            });
            if (next.failure) {
                return {
                    name,
                    status: "error",
                    exitCode: null,
                    durationMs: Date.now() - started,
                    reason: next.failure.message,
                };
            }
            if (next.exitCode !== 0) {
                return {
                    name,
                    status: "fail",
                    exitCode: next.exitCode,
                    durationMs: Date.now() - started,
                    reason: firstReasonLine(next.stderr) ||
                        `${step.args.slice(1).join(" ")} exited with ${next.exitCode}`,
                };
            }
        }
        return { name, status: "pass", exitCode: 0, durationMs };
    }
    const reason = firstReasonLine(res.stderr) || `exit code ${res.exitCode}`;
    return { name, status: "fail", exitCode: res.exitCode, durationMs, reason };
}
/** Changed files under `HEAD`, with numstat. Untracked files count as all-added. */
export function collectChangedFiles(exec, cwd) {
    const out = [];
    const diff = exec("git", ["diff", "--numstat", "HEAD"], { cwd, timeoutMs: 30_000 });
    if (diff.exitCode === 0) {
        for (const line of diff.stdout.split("\n")) {
            const [added, removed, path] = line.split("\t");
            if (!path)
                continue;
            out.push({
                path,
                added: Number.parseInt(added, 10) || 0,
                removed: Number.parseInt(removed, 10) || 0,
            });
        }
    }
    const untracked = exec("git", ["ls-files", "--others", "--exclude-standard"], {
        cwd,
        timeoutMs: 30_000,
    });
    if (untracked.exitCode === 0) {
        for (const path of untracked.stdout.split("\n").map((l) => l.trim()).filter(Boolean)) {
            out.push({ path, added: 1, removed: 0 });
        }
    }
    return out;
}
/** New `test.fixme(` lines introduced by this change, as `path:line`. */
export function collectNewFixmes(exec, cwd, changed) {
    const found = [];
    const diff = exec("git", ["diff", "-U0", "HEAD", "--", "*.ts"], { cwd, timeoutMs: 30_000 });
    let currentPath = "";
    let currentLine = 0;
    if (diff.exitCode === 0) {
        for (const raw of diff.stdout.split("\n")) {
            if (raw.startsWith("+++ b/")) {
                currentPath = raw.slice(6);
                continue;
            }
            const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw);
            if (hunk) {
                currentLine = Number.parseInt(hunk[1], 10);
                continue;
            }
            if (raw.startsWith("+") && !raw.startsWith("+++")) {
                if (raw.includes("test.fixme("))
                    found.push(`${currentPath}:${currentLine}`);
                currentLine++;
            }
        }
    }
    // Untracked test files are not in the diff; scan them whole.
    for (const file of changed) {
        if (!/\.spec\.ts$/.test(file.path))
            continue;
        if (found.some((f) => f.startsWith(file.path)))
            continue;
        const full = join(cwd, file.path);
        if (!existsSync(full))
            continue;
        readFileSync(full, "utf-8")
            .split("\n")
            .forEach((line, idx) => {
            if (line.includes("test.fixme("))
                found.push(`${file.path}:${idx + 1}`);
        });
    }
    return found;
}
function resolveChange(exec, cwd, requested) {
    if (requested)
        return { change: requested };
    let res = exec("openspec", ["list", "--json"], { cwd, timeoutMs: 30_000 });
    if (res.failure?.kind === "missing") {
        res = exec("npx", ["openspec", "list", "--json"], { cwd, timeoutMs: 60_000 });
    }
    if (res.failure)
        return { error: res.failure.message };
    try {
        const parsed = JSON.parse(res.stdout);
        if (!parsed.root)
            return { error: "not an OpenSpec project (no openspec/ root)" };
        const names = (parsed.changes ?? []).map((c) => c.name);
        if (names.length === 1)
            return { change: names[0] };
        if (names.length === 0)
            return { error: "no active change; pass a change name" };
        return {
            error: `multiple active changes (${names.join(", ")}); pass one explicitly`,
        };
    }
    catch {
        return { error: "could not parse `openspec list --json` output" };
    }
}
function renderHuman(report, out) {
    out("");
    out(`  OpenSpec Playwright gate — ${report.change ?? "(no change)"}`);
    out("");
    for (const c of report.checks) {
        const glyph = c.status === "pass"
            ? "✓"
            : c.status === "fail"
                ? "✗"
                : c.status === "skipped"
                    ? "–"
                    : "!";
        const ms = c.durationMs > 0 ? ` (${(c.durationMs / 1000).toFixed(1)}s)` : "";
        out(`  ${glyph} ${c.name.padEnd(9)} ${c.status}${ms}${c.reason ? ` — ${c.reason}` : ""}`);
    }
    out("");
    if (report.flags.length > 0) {
        out("  Review these before trusting a green gate:");
        for (const f of report.flags) {
            out(`    ${f.path}${f.reason ? `  — ${f.reason}` : `  +${f.added}/-${f.removed}`}`);
        }
        out("");
    }
    const t = report.totals;
    out(`  ${t.pass} passed, ${t.fail} failed, ${t.skipped} skipped, ${t.error} undecidable`);
    out(`  Verdict: ${report.verdict.toUpperCase()}`);
    out("");
}
export const HOOK_CACHE_FILE = join(".claude", ".openspec-pw-gate-cache.json");
/** Claude Code writes the event payload to stdin; absent stdin means none. */
export function readHookPayload() {
    if (process.stdin.isTTY)
        return {};
    try {
        const raw = readFileSync(0, "utf-8");
        if (!raw.trim())
            return {};
        const parsed = JSON.parse(raw);
        return typeof parsed === "object" && parsed !== null
            ? parsed
            : {};
    }
    catch {
        // No payload (or not JSON) is normal for a hand-run `gate --hook`.
        return {};
    }
}
/** Identifies the working tree state the last verdict was computed against. */
export function worktreeFingerprint(exec, cwd) {
    const parts = [];
    for (const args of [
        ["rev-parse", "HEAD"],
        ["status", "--porcelain"],
        ["diff", "HEAD"],
    ]) {
        const res = exec("git", args, { cwd, timeoutMs: 20_000 });
        parts.push(String(res.exitCode), res.stdout);
    }
    return createHash("sha1").update(parts.join("\u0000")).digest("hex");
}
export function readHookCache(cwd) {
    const path = join(cwd, HOOK_CACHE_FILE);
    if (!existsSync(path))
        return null;
    try {
        const parsed = JSON.parse(readFileSync(path, "utf-8"));
        return typeof parsed?.fingerprint === "string" &&
            typeof parsed?.verdict === "string"
            ? parsed
            : null;
    }
    catch {
        // A corrupt cache only costs a re-run; never block on it.
        return null;
    }
}
export function writeHookCache(cwd, cache) {
    const path = join(cwd, HOOK_CACHE_FILE);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(cache), "utf-8");
}
// ─── Entry point ─────────────────────────────────────────────────────────
/**
 * Run the gate and return the process exit code. Pure wiring lives in the
 * helpers above so the behaviour can be unit-tested without spawning.
 */
export async function gate(changeName, options = {}, deps = {}) {
    const cwd = deps.cwd ?? process.cwd();
    const exec = deps.exec ?? defaultExecutor;
    const hookMode = options.hook === true;
    const err = deps.err ?? ((line) => console.error(line));
    // In hook mode nothing may reach stdout, and every message goes to stderr so
    // Claude Code feeds it back to the model on exit 2.
    const out = hookMode
        ? err
        : (deps.out ?? ((line) => console.log(line)));
    const asJson = !hookMode && options.json === true;
    let hookFingerprint = null;
    if (hookMode) {
        const payload = deps.hookPayload ?? readHookPayload();
        if (payload.stop_hook_active) {
            out("  gate(hook): already blocked once this turn — letting it stop");
            return 0;
        }
        hookFingerprint = worktreeFingerprint(exec, cwd);
        const cached = readHookCache(cwd);
        if (cached && cached.fingerprint === hookFingerprint) {
            if (cached.verdict === "pass")
                return 0;
            out(`  gate(hook): ${cached.verdict} (cached — working tree unchanged)`);
            return 2;
        }
    }
    const selected = selectChecks(options.only, options.skip);
    if ("error" in selected) {
        err(`  gate: ${selected.error}`);
        return 2;
    }
    // Only some checks read a change. Resolving one unconditionally made a
    // `--only lint,typecheck,test` run fail with "multiple active changes" the
    // moment a repo had two changes open at once.
    const needsChange = selected.checks.some((name) => CHECK_NEEDS_CHANGE.has(name));
    let change = "";
    if (needsChange) {
        const resolved = resolveChange(exec, cwd, changeName);
        if ("error" in resolved) {
            err(`  gate: ${resolved.error}`);
            return 2;
        }
        change = resolved.change;
    }
    const scripts = readScripts(cwd);
    const results = [];
    // The hook's own timeout is a safety valve: a gate that never returns would
    // make the turn impossible to end, which is worse than skipping a check.
    const deadlineAt = hookMode
        ? Date.now() + (selected.checks.includes("e2e") ? 890_000 : 295_000)
        : null;
    for (const name of selected.checks) {
        if (deadlineAt !== null && Date.now() > deadlineAt) {
            out("  gate(hook): deadline reached — not blocking the turn");
            return 0;
        }
        const plan = planFor(name, {
            projectRoot: cwd,
            change,
            scripts,
            coverageMin: options.coverageMin,
        });
        const result = runOne(name, plan, { cwd, exec });
        results.push(result);
        if (!asJson)
            out(`  gate: ${name} → ${result.status}`);
        if (result.status === "fail" && !options.keepGoing)
            break;
        if (result.status === "error" && !options.keepGoing)
            break;
    }
    // False-green guards. Both are deterministic; neither consults a model.
    // The "scenarios but no tests" rule only applies where E2E is actually set
    // up — otherwise a backend-only project would be permanently red.
    if (selected.checks.includes("e2e")) {
        const changeDir = join(cwd, "openspec", "changes", change);
        const scenarios = existsSync(changeDir) ? countScenarios(changeDir) : 0;
        const specFiles = collectSpecFiles(join(cwd, "tests", "playwright", "changes", change));
        const e2eIndex = results.findIndex((r) => r.name === "e2e");
        if (e2eIndex >= 0 && findPlaywrightConfig(cwd)) {
            if (scenarios > 0 && specFiles.length === 0) {
                results[e2eIndex] = {
                    ...results[e2eIndex],
                    status: "fail",
                    reason: `delta spec has ${scenarios} scenario(s) but no test files`,
                };
            }
            else if (scenarios === 0 && specFiles.length === 0) {
                results[e2eIndex] = {
                    ...results[e2eIndex],
                    status: "skipped",
                    reason: "change has no scenarios",
                };
            }
        }
    }
    const changed = collectChangedFiles(exec, cwd);
    const fixmes = collectNewFixmes(exec, cwd, changed);
    if (fixmes.length > 0) {
        const e2eIndex = results.findIndex((r) => r.name === "e2e");
        if (e2eIndex >= 0) {
            results[e2eIndex] = {
                ...results[e2eIndex],
                status: "fail",
                reason: `${fixmes.length} new test.fixme(): ${fixmes.join(", ")}`,
            };
        }
    }
    // A raised test timeout is the same kind of signal as a loosened config: the
    // check turns green without the code getting better.
    const timeoutDiff = exec("git", ["diff", "-U0", "HEAD", "--", "tests/playwright"], {
        cwd,
        timeoutMs: 30_000,
    });
    const timeoutFlags = timeoutDiff.exitCode === 0
        ? parseTimeoutIncreases(timeoutDiff.stdout).map((t) => ({
            path: t.file,
            added: 0,
            removed: 0,
            reason: `timeout ${t.from} → ${t.to} at line ${t.line}`,
        }))
        : [];
    const flags = [
        ...changed
            .filter((f) => isCheckConfigFile(f.path))
            .map((f) => ({ path: f.path, added: f.added, removed: f.removed })),
        ...timeoutFlags,
    ];
    const report = {
        verdict: computeVerdict(results),
        change: change || null,
        checks: results,
        totals: summarize(results),
        flags,
    };
    if (asJson) {
        out(JSON.stringify(report, null, 2));
    }
    else {
        renderHuman(report, out);
    }
    if (hookMode && hookFingerprint) {
        writeHookCache(cwd, { fingerprint: hookFingerprint, verdict: report.verdict });
        // Exit 2 is Claude Code's "do not stop, here is why".
        return report.verdict === "pass" ? 0 : 2;
    }
    return exitCodeForVerdict(report.verdict);
}
//# sourceMappingURL=gate.js.map