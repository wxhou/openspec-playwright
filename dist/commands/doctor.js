import { existsSync, lstatSync, readdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { createRequire } from "node:module";
import { join, basename } from "path";
import { execFileSync } from "child_process";
import chalk from "chalk";
import { detectAdapters, hasCommandArtifacts, slashCommandForAdapter, claudeAdapter, codebuddyAdapter, claudeWrapperStandardsContent, enumerateVendoredAgents, installedAgentsSnapshotDir, } from "../commands/editors.js";
import { detectAppServer, isTestRunnerMcpInstalled, needsShell, detectCodeGraphStatus, findEslintConfig, findRuffConfig, findSourceFile, } from "../shared/index.js";
import { bundledStandardsPath, compareBlock, OPENSPEC_START, hasLegacyTerritoryStart } from "../shared/drift.js";
import { hasRuleFileMarkers, wrapperRulesFile, wrapperHasMarkers } from "./editors/project-rules.js";
/** Editors whose project rules file is a thin wrapper (not AGENTS.md). */
const WRAPPER_EDITORS = [claudeAdapter, codebuddyAdapter];
const OPTIONAL_NAMES = new Set([
    "engines",
    "specs",
    "auth-setup",
    "storage-state",
    "seed",
    "dev-script",
    "base-url",
    "reachable",
    "codegraph-cli",
    "codegraph-index",
    "codegraph-mcp",
    "playwright-cli",
    "lint-config",
    "lint-eslint",
    "lint-ruff",
    "lint-ruff-cli",
    "lint-pylint-cli",
    "vendored-agents-mcp",
]);
// Per-editor optional checks can't be enumerated by exact name — match
// the test-runner MCP checks (one per detected adapter) by prefix.
export function isOptionalCheck(name) {
    return OPTIONAL_NAMES.has(name) || name.startsWith("test-runner-mcp-");
}
/**
 * PATH probe for an optional CLI. `which`/`where` exits non-zero when the tool
 * is absent — that is the expected miss. Any other failure (spawn error,
 * EACCES) is surfaced in `note` instead of being reported as "not installed".
 */
function probeOnPath(tool) {
    try {
        execFileSync(process.platform === "win32" ? "where" : "which", [tool], {
            stdio: "ignore",
            shell: needsShell,
        });
        return { onPath: true, note: null };
    }
    catch (err) {
        const missed = err instanceof Error &&
            typeof err.status === "number";
        if (missed)
            return { onPath: false, note: null };
        return {
            onPath: false,
            note: `probe failed — ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
const SEMANTIC_PROBE_TIMEOUT_MS = 20_000;
/** First line of an exec failure — keeps stderr noise out of the doctor log. */
function describeExecError(err) {
    if (err instanceof Error) {
        const stderr = err.stderr;
        if (typeof stderr === "string" && stderr.trim()) {
            return stderr.trim().split(/\r?\n/)[0];
        }
        return err.message.split(/\r?\n/)[0];
    }
    return String(err);
}
/**
 * Project-local ESLint binary first, then PATH. Yarn PnP has no
 * `node_modules/.bin`; if neither resolves, the semantic probe fails and the
 * literal fallback runs (conservative direction).
 */
function findEslintBinary(projectRoot) {
    const names = process.platform === "win32" ? ["eslint.cmd", "eslint"] : ["eslint"];
    for (const name of names) {
        const local = join(projectRoot, "node_modules", ".bin", name);
        if (existsSync(local))
            return local;
    }
    return probeOnPath("eslint").onPath ? "eslint" : null;
}
/**
 * Ask ESLint whether `no-empty` is in effect for a representative source
 * file. Inherited recommended presets resolve to a severity, so this
 * distinguishes "inherited" from "explicitly off" — the literal probe cannot.
 */
function probeEslintNoEmpty(projectRoot) {
    const binary = findEslintBinary(projectRoot);
    if (!binary)
        return { ok: false, reason: "eslint executable not found" };
    const file = findSourceFile(projectRoot, [
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mjs",
        ".cjs",
    ]);
    if (!file)
        return { ok: false, reason: "no representative source file" };
    try {
        const output = execFileSync(binary, ["--print-config", file], {
            cwd: projectRoot,
            encoding: "utf-8",
            timeout: SEMANTIC_PROBE_TIMEOUT_MS,
            shell: needsShell,
            stdio: ["ignore", "pipe", "pipe"],
        });
        // ESLint exits 0 and prints the literal "undefined" when no config
        // matches the file — a definitive "not enabled", not a probe failure.
        if (output.trim() === "undefined")
            return { ok: true, enabled: false };
        const parsed = JSON.parse(output);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return { ok: false, reason: "print-config output is not a config object" };
        }
        const rules = parsed.rules;
        const severity = rules && typeof rules === "object"
            ? rules["no-empty"]
            : undefined;
        // Missing key = rule not configured — not enabled.
        if (severity === undefined)
            return { ok: true, enabled: false };
        const level = Array.isArray(severity) ? severity[0] : severity;
        if (typeof level !== "number") {
            return { ok: false, reason: "unexpected no-empty severity shape" };
        }
        return { ok: true, enabled: level > 0 };
    }
    catch (err) {
        return { ok: false, reason: describeExecError(err) };
    }
}
/** Enabled-rules block from `ruff check --show-settings` (null when absent). */
function ruffEnabledRulesSection(output) {
    const lines = output.split(/\r?\n/);
    const start = lines.findIndex((line) => /^linter\.rules\.enabled\s*=/.test(line));
    if (start === -1)
        return null;
    const body = [];
    for (let i = start; i < lines.length; i++) {
        // Next top-level `linter.*` key ends the array.
        if (i > start && /^[A-Za-z_][\w.-]*\s*=/.test(lines[i]))
            break;
        body.push(lines[i]);
    }
    return body.join("\n");
}
/** Ask ruff's resolver whether B904 is enabled (categories expand to ids). */
function probeRuffB904(projectRoot) {
    const file = findSourceFile(projectRoot, [".py"]);
    if (!file)
        return { ok: false, reason: "no representative .py file" };
    try {
        const output = execFileSync("ruff", ["check", "--show-settings", file], {
            cwd: projectRoot,
            encoding: "utf-8",
            timeout: SEMANTIC_PROBE_TIMEOUT_MS,
            shell: needsShell,
            stdio: ["ignore", "pipe", "pipe"],
        });
        const section = ruffEnabledRulesSection(output);
        if (section === null) {
            return {
                ok: false,
                reason: "show-settings output has no enabled-rules section",
            };
        }
        return { ok: true, enabled: /\(B904\)/.test(section) };
    }
    catch (err) {
        return { ok: false, reason: describeExecError(err) };
    }
}
export async function doctor(options = {}) {
    const checks = [];
    const projectRoot = process.cwd();
    let nodeMajor = 0;
    let nodeVersion = "";
    // Node.js
    try {
        const node = execFileSync("node", ["--version"], {
            encoding: "utf-8",
            shell: needsShell,
        }).trim();
        const majorMatch = node.match(/v?(\d+)\./);
        nodeMajor = majorMatch ? parseInt(majorMatch[1], 10) : 0;
        nodeVersion = node;
        const deprecated = nodeMajor > 0 && nodeMajor < 22;
        checks.push({
            category: "Node.js",
            name: "node",
            ok: true,
            message: deprecated
                ? `${node}  ⚠  Node < 22 deprecated by GitHub Actions; recommend Node 22+`
                : node,
        });
    }
    catch {
        checks.push({
            category: "Node.js",
            name: "node",
            ok: false,
            message: "not found",
        });
    }
    // Node.js engines compatibility
    let engineOk = true;
    let engineMsg = "no engines.node requirement";
    try {
        const pkgPath = join(projectRoot, "package.json");
        if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
            if (pkg.engines?.node) {
                const req = pkg.engines.node;
                engineMsg = `requires ${req}`;
                const minMatch = req.match(/>=?\s*(\d+)/);
                if (minMatch && nodeMajor > 0 && nodeMajor < parseInt(minMatch[1], 10)) {
                    engineOk = false;
                    engineMsg = `requires ${req}, current is ${nodeVersion}`;
                }
            }
        }
    }
    catch {
        // ignore parse errors
    }
    checks.push({
        category: "Node.js",
        name: "engines",
        ok: engineOk,
        message: engineMsg,
    });
    // npm
    try {
        const npm = execFileSync("npm", ["--version"], {
            encoding: "utf-8",
            shell: needsShell,
        }).trim();
        checks.push({
            category: "npm",
            name: "npm",
            ok: true,
            message: npm,
        });
    }
    catch {
        checks.push({
            category: "npm",
            name: "npm",
            ok: false,
            message: "not found",
        });
    }
    // Playwright Config file (all four extension variants)
    const configFiles = ["playwright.config.ts", "playwright.config.js", "playwright.config.mjs", "playwright.config.mts"];
    const configPath = configFiles.find((f) => existsSync(join(projectRoot, f)));
    // Playwright scaffold presence gates every Playwright-specific check
    // (config, browsers, @playwright/test, tests dir): minimal-mode projects
    // (no frontend signal) have none and must not fail doctor on missing
    // Playwright (init-minimal-mode — the checks degrade to ok:true info lines).
    // Same config file set the check above accepts, plus the tests dir — a
    // narrower gate here would contradict its own config verdict for
    // .js/.mjs/.mts configs.
    const hasPlaywrightScaffold = Boolean(configPath) || existsSync(join(projectRoot, "tests", "playwright"));
    checks.push({
        category: "Playwright Config",
        name: "config",
        ok: hasPlaywrightScaffold ? Boolean(configPath) : true,
        message: configPath
            ? `found ${configPath}`
            : hasPlaywrightScaffold
                ? "not found"
                : "no Playwright scaffold (minimal mode)",
    });
    // OpenSpec
    const hasOpenSpec = existsSync(join(projectRoot, "openspec"));
    checks.push({
        category: "OpenSpec",
        name: "openspec",
        ok: hasOpenSpec,
        message: hasOpenSpec ? "initialized" : "not initialized",
    });
    // OpenSpec specs
    const specCount = countSpecFiles(join(projectRoot, "openspec"));
    checks.push({
        category: "OpenSpec",
        name: "specs",
        ok: specCount > 0,
        message: specCount > 0 ? `${specCount} spec(s) found` : "no .spec.md files",
    });
    // Playwright CLI (package installed) — gated on the scaffold presence
    // like the other Playwright-specific checks (minimal-mode projects have
    // no @playwright/test and get an ok:true info line instead).
    if (!hasPlaywrightScaffold) {
        checks.push({
            category: "Playwright Browsers",
            name: "cli",
            ok: true,
            message: "no Playwright scaffold (minimal mode)",
        });
    }
    else {
        try {
            const pw = execFileSync("npx", ["playwright", "--version"], {
                encoding: "utf-8",
                shell: needsShell,
            }).trim();
            checks.push({
                category: "Playwright Browsers",
                name: "cli",
                ok: true,
                message: pw,
            });
        }
        catch {
            checks.push({
                category: "Playwright Browsers",
                name: "cli",
                ok: false,
                message: "not installed",
            });
        }
    }
    // Playwright environment checks (browsers, @playwright/test) are gated on
    // the Playwright scaffold presence computed above (minimal-mode projects
    // degrade to ok:true info lines).
    // Playwright browser binaries installed
    if (!hasPlaywrightScaffold) {
        checks.push({
            category: "Playwright Browsers",
            name: "browsers",
            ok: true,
            message: "no Playwright scaffold (minimal mode)",
        });
    }
    else {
        let hasBrowsers = false;
        let browsersMsg = "not installed";
        try {
            execFileSync("node", ["-e", "const {chromium} = require('playwright'); chromium.executablePath()"], {
                encoding: "utf-8",
                shell: needsShell,
                stdio: "pipe",
                timeout: 5000,
            });
            hasBrowsers = true;
            browsersMsg = "chromium installed";
        }
        catch {
            browsersMsg = "not installed (run: npx playwright install chromium)";
        }
        checks.push({
            category: "Playwright Browsers",
            name: "browsers",
            ok: hasBrowsers,
            message: browsersMsg,
        });
    }
    // Playwright Test framework (imported by spec files)
    if (!hasPlaywrightScaffold) {
        checks.push({
            category: "Playwright Test",
            name: "playwright-test",
            ok: true,
            message: "no Playwright scaffold (minimal mode)",
        });
    }
    else {
        let hasPwTest = false;
        let pwTestMsg = "not installed";
        try {
            const require = createRequire(import.meta.url);
            require.resolve("@playwright/test");
            hasPwTest = true;
            pwTestMsg = "installed";
        }
        catch {
            // Try from current project
            try {
                const projectRequire = createRequire(join(projectRoot, "package.json"));
                projectRequire.resolve("@playwright/test");
                hasPwTest = true;
                pwTestMsg = "installed (project)";
            }
            catch {
                // not installed
            }
        }
        checks.push({
            category: "Playwright Test",
            name: "playwright-test",
            ok: hasPwTest,
            message: pwTestMsg,
        });
    }
    // Playwright MCP — check each detected editor adapter
    const adapters = detectAdapters(projectRoot);
    if (adapters.length === 0) {
        checks.push({
            category: "Playwright MCP",
            name: "playwright-mcp",
            ok: false,
            message: "no editors detected (configure .claude/, .opencode/, .cline/, .cursor/, .pi/, .omp/, .codebuddy/, or .minimax/)",
        });
    }
    else {
        for (const adapter of adapters) {
            // Editors without an MCP client (Pi) get an informational, non-blocking
            // check instead of a failing one — there is nothing to configure.
            if (adapter.supportsMcp === false) {
                checks.push({
                    category: "Playwright MCP",
                    name: `playwright-mcp-${adapter.label}`,
                    ok: true,
                    authorized: hasCommandArtifacts(projectRoot, adapter),
                    message: `${adapter.displayName} has no MCP client (use openspec-pw explore)`,
                });
                continue;
            }
            // Gate on write authorization (tool-owned command artifacts exist),
            // not on detection: a global config dir or a hand-created marker
            // directory does not authorize openspec-pw writes, so nagging about
            // "run update" for it would send the user into a loop update cannot
            // fix (update never expands territory). Unauthorized → info line
            // pointing at the init extension path.
            const authorized = hasCommandArtifacts(projectRoot, adapter);
            const testRunnerInstalled = isTestRunnerMcpInstalled(adapter);
            checks.push({
                category: "Playwright MCP",
                name: `test-runner-mcp-${adapter.label}`,
                ok: authorized ? testRunnerInstalled : true,
                authorized,
                message: authorized
                    ? testRunnerInstalled
                        ? "installed"
                        : `not configured for ${adapter.label} (run openspec-pw update)`
                    : `not configured in this project (run "openspec-pw init --tools ${adapter.id}" to add)`,
            });
            // Claude Code MCP moved to project scope (0.3.69): a legacy user-scope
            // playwright entry in ~/.claude.json is invisible to the project-level
            // check above. With the single-server layout the project server is
            // `playwright-test`, so any user-scope `playwright` entry is legacy —
            // surface it (Claude Code would load it into every session).
            if (adapter.id === "claude") {
                try {
                    const globalCfg = JSON.parse(readFileSync(join(homedir(), ".claude.json"), "utf-8"));
                    if (globalCfg?.mcpServers?.playwright) {
                        checks.push({
                            category: "Playwright MCP",
                            name: "playwright-mcp-legacy-global",
                            ok: true,
                            message: "legacy user-scope playwright MCP found — remove with: claude mcp remove playwright",
                        });
                    }
                }
                catch {
                    // no ~/.claude.json or unparseable — nothing to report
                }
            }
        }
        // Vendored Playwright agents (claude, opt-in via `init --agents`).
        // Presence + ownership are informational; the only warning is the
        // agents' MCP dependency — every tool they reference lives on the
        // playwright-test server.
        const claude = adapters.find((a) => a.id === "claude");
        if (claude) {
            const agentInv = enumerateVendoredAgents(projectRoot, installedAgentsSnapshotDir());
            const agentsPresent = agentInv.owned.length + agentInv.modified.length;
            if (agentsPresent > 0) {
                checks.push({
                    category: "Vendored Agents",
                    name: "vendored-agents",
                    ok: true,
                    message: `${agentsPresent} file(s) (${agentInv.owned.length} owned, ${agentInv.modified.length} modified)`,
                });
                if (agentInv.modified.length > 0) {
                    checks.push({
                        category: "Vendored Agents",
                        name: "vendored-agents-drift",
                        ok: true,
                        message: "differs from the bundled snapshot (manual edit or newer init-agents output) — update leaves it untouched",
                    });
                }
                if (!isTestRunnerMcpInstalled(claude)) {
                    checks.push({
                        category: "Vendored Agents",
                        name: "vendored-agents-mcp",
                        ok: false,
                        message: 'agents depend on the playwright-test MCP server, which is missing — run "openspec-pw init" or: claude mcp add --scope project playwright-test npx playwright run-test-mcp-server',
                    });
                }
            }
            else if (hasCommandArtifacts(projectRoot, claude)) {
                checks.push({
                    category: "Vendored Agents",
                    name: "vendored-agents",
                    ok: true,
                    message: "not installed (opt-in: openspec-pw init --tools claude --agents)",
                });
            }
        }
        // Cursor-specific: command + skill readiness (spec requirement). Gated
        // on write authorization — a hand-created .cursor/ with the user's own
        // config must not red-flag doctor (update would not create the files).
        const cursor = adapters.find((a) => a.id === "cursor");
        if (cursor) {
            const cursorAuthorized = hasCommandArtifacts(projectRoot, cursor);
            const cmdPath = join(projectRoot, ".cursor", "commands", "opsx-e2e.md");
            const skillPath = join(projectRoot, ".cursor", "skills", "opsx-e2e", "SKILL.md");
            const hasCmd = existsSync(cmdPath);
            const hasSkill = existsSync(skillPath);
            const notConfigured = 'not configured in this project (run "openspec-pw init --tools cursor" to add)';
            checks.push({
                category: "Cursor E2E",
                name: "cursor-e2e-command",
                ok: cursorAuthorized ? hasCmd : true,
                authorized: cursorAuthorized,
                message: cursorAuthorized
                    ? hasCmd
                        ? ".cursor/commands/opsx-e2e.md found"
                        : ".cursor/commands/opsx-e2e.md missing"
                    : notConfigured,
            });
            checks.push({
                category: "Cursor E2E",
                name: "cursor-e2e-skill",
                ok: cursorAuthorized ? hasSkill : true,
                authorized: cursorAuthorized,
                message: cursorAuthorized
                    ? hasSkill
                        ? ".cursor/skills/opsx-e2e/SKILL.md found"
                        : ".cursor/skills/opsx-e2e/SKILL.md missing"
                    : notConfigured,
            });
        }
    }
    // @playwright/cli — awareness only (0.x, no semver promise; never a
    // dependency). Editor-independent, hence outside the adapter branch.
    // Gated on the Playwright scaffold like the other browser-tooling checks:
    // minimal-mode projects have no agents/MCP to feed it.
    if (hasPlaywrightScaffold) {
        let cliAvailable = false;
        try {
            execFileSync(process.platform === "win32" ? "where" : "which", ["playwright-cli"], { stdio: "ignore", shell: needsShell });
            cliAvailable = true;
        }
        catch {
            /* not installed — optional */
        }
        checks.push({
            category: "Playwright MCP",
            name: "playwright-cli",
            ok: cliAvailable,
            message: cliAvailable
                ? "available"
                : "not installed (optional token-efficient browser CLI for agents)",
        });
    }
    // Sync — employee standards drift (AGENTS.md / CLAUDE.md OPENSPEC blocks)
    // Gated on "initialized": a project that never ran init is `ok:true` so CI
    // is not tripped; an initialized project with stale standards is `ok:false`.
    const hasCommand = existsSync(join(projectRoot, ".claude", "commands", "opsx", "e2e.md")) ||
        existsSync(join(projectRoot, ".opencode", "commands", "opsx-e2e.md")) ||
        existsSync(join(projectRoot, ".cline", "skills", "opsx-e2e", "SKILL.md")) ||
        existsSync(join(projectRoot, ".cursor", "commands", "opsx-e2e.md")) ||
        existsSync(join(projectRoot, ".cursor", "skills", "opsx-e2e", "SKILL.md")) ||
        existsSync(join(projectRoot, ".pi", "prompts", "opsx-e2e.md")) ||
        existsSync(join(projectRoot, ".omp", "commands", "opsx-e2e.md"));
    const initialized = hasCommand || hasOpenSpec;
    if (!initialized) {
        checks.push({
            category: "Sync",
            name: "standards",
            ok: true,
            message: "not initialized (run openspec-pw init first)",
        });
    }
    else {
        const standardsPath = bundledStandardsPath();
        const standardsExpected = existsSync(standardsPath)
            ? readFileSync(standardsPath, "utf-8")
            : "";
        // AGENTS.md — 标记即领土: only the tool-owned block is maintained
        // (update repairs it when present). A wiped block IS a failure when pw
        // command artifacts exist OR another rules file carries our marker
        // (minimal-mode projects — the surviving wrapper proves the territory;
        // init-minimal-mode) — the removed territory was possibly taken by the
        // official `openspec update` legacy cleanup; the message points at
        // INIT, whose append branch repairs it (环闭合 — never at update,
        // avoiding the 0.3.76 doctor-nags → update-can't-fix loop). A surviving
        // legacy OPENSPEC block is still ours (signature-gated migration
        // converges on the next update) → ok:true info line.
        const territory = hasCommand || hasRuleFileMarkers(projectRoot);
        const agentsPath = join(projectRoot, "AGENTS.md");
        if (!existsSync(agentsPath)) {
            checks.push({
                category: "Sync",
                name: "standards-agents",
                ok: true,
                authorized: territory,
                message: territory
                    ? 'AGENTS.md missing (standards block removed) — restore via "openspec-pw init"'
                    : "not initialized (run openspec-pw init first)",
            });
        }
        else {
            const fileContent = readFileSync(agentsPath, "utf-8");
            const noMarkers = !fileContent.includes(OPENSPEC_START);
            const missing = noMarkers && !hasLegacyTerritoryStart(fileContent);
            const drift = noMarkers
                ? { stale: false }
                : compareBlock(fileContent, standardsExpected);
            checks.push({
                category: "Sync",
                name: "standards-agents",
                ok: missing ? !territory : !drift.stale,
                authorized: missing ? territory : true,
                message: missing
                    ? territory
                        ? 'AGENTS.md has no OPENSPEC-PW block (removed — possibly by the official `openspec update` legacy cleanup) — restore via "openspec-pw init"'
                        : "not initialized (run openspec-pw init first)"
                    : noMarkers
                        ? "AGENTS.md carries a legacy OPENSPEC block — run openspec-pw update to migrate markers"
                        : drift.stale
                            ? "AGENTS.md differs from bundled version — run openspec-pw update"
                            : "standards in sync",
            });
        }
        // Wrapper files (CLAUDE.md / CODEBUDDY.md) are checked when their editor
        // is authorized (command artifacts) OR the wrapper marker block itself
        // is present (minimal-mode projects have standards but no command files
        // — init-minimal-mode) — not on detection: a global config dir or a
        // project marker dir without openspec-pw artifacts never implies a
        // wrapper. A bare `@AGENTS.md` import without markers is left
        // untouched — not stale.
        for (const wrapperAdapter of WRAPPER_EDITORS) {
            const wrapperFile = wrapperRulesFile(wrapperAdapter, projectRoot);
            if (!wrapperFile)
                continue;
            const wrapperLabel = basename(wrapperFile);
            const authorized = hasCommandArtifacts(projectRoot, wrapperAdapter) || wrapperHasMarkers(wrapperAdapter, projectRoot);
            if (!authorized)
                continue;
            // A symlinked wrapper (→ AGENTS.md, the official reuse pattern) is
            // covered by the standards-agents check above — comparing it against
            // the wrapper expectation would false-positive.
            if (existsSync(wrapperFile) && lstatSync(wrapperFile).isSymbolicLink()) {
                checks.push({
                    category: "Sync",
                    name: `standards-${wrapperAdapter.id}`,
                    ok: true,
                    message: `${wrapperLabel} symlinks AGENTS.md — covered by standards-agents`,
                });
            }
            else if (!existsSync(wrapperFile)) {
                checks.push({
                    category: "Sync",
                    name: `standards-${wrapperAdapter.id}`,
                    ok: false,
                    message: `${wrapperLabel} missing — run openspec-pw update`,
                });
            }
            else {
                const fileContent = readFileSync(wrapperFile, "utf-8");
                let stale;
                if (!fileContent.includes(OPENSPEC_START)) {
                    stale = !/^@AGENTS\.md\r?$/m.test(fileContent);
                }
                else {
                    stale = compareBlock(fileContent, claudeWrapperStandardsContent()).stale;
                }
                checks.push({
                    category: "Sync",
                    name: `standards-${wrapperAdapter.id}`,
                    ok: !stale,
                    message: stale
                        ? "OPENSPEC block differs from bundled version（手动修改或旧版模板）— run openspec-pw update"
                        : "standards in sync",
                });
            }
        }
        // If a project is initialized but has no editor directories, AGENTS.md is
        // still checked above; surface that explicitly rather than silently
        // emitting no Sync checks.
        if (adapters.length === 0) {
            checks.push({
                category: "Sync",
                name: "editors",
                ok: true,
                message: "no editors detected — AGENTS.md checked above",
            });
        }
    }
    // Tests directory structure (Playwright-specific — minimal-mode projects
    // have tests/ but no tests/playwright; gate like the env checks above,
    // auth-setup/seed already carry "optional" semantics)
    const testsDir = join(projectRoot, "tests", "playwright");
    const hasTestsDir = existsSync(testsDir);
    checks.push({
        category: "Tests",
        name: "directory",
        ok: hasPlaywrightScaffold ? hasTestsDir : true,
        message: hasPlaywrightScaffold
            ? hasTestsDir
                ? "tests/playwright/ exists"
                : "not found"
            : "no Playwright scaffold (minimal mode)",
    });
    const hasAuthSetup = existsSync(join(testsDir, "auth.setup.ts"));
    checks.push({
        category: "Tests",
        name: "auth-setup",
        ok: hasAuthSetup,
        message: hasAuthSetup ? "found" : "not found (optional)",
    });
    // storageState declared but state file missing → every non-setup context
    // launches anonymous; the login flows under test then 401 silently.
    if (configPath) {
        let text = "";
        try {
            text = readFileSync(join(projectRoot, configPath), "utf-8");
        }
        catch {
            // report the skip instead of swallowing it silently
            checks.push({
                category: "Tests",
                name: "storage-state",
                ok: true,
                message: "config unreadable — storage-state check skipped",
            });
        }
        if (/\bstorageState\b/.test(text)) {
            const literals = [...text.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
            const explicit = literals.find((s) => /(^|\/)user\.json$/.test(s) && s.includes("/")) ??
                literals.find((s) => s.includes(".auth") && s.includes("/")) ??
                (/\bjoin\([^)]*['"]\.auth['"]/.test(text) ? "playwright/.auth/user.json" : undefined);
            // No literal and no template layout (auth.setup.ts) → the path is
            // user-owned; guessing the default would report their custom layout
            // as broken, so leave it out entirely.
            const stateFile = explicit ?? (hasAuthSetup ? "playwright/.auth/user.json" : undefined);
            if (stateFile) {
                const file = stateFile.startsWith("/") ? stateFile : join(projectRoot, stateFile);
                const hasState = existsSync(file);
                checks.push({
                    category: "Tests",
                    name: "storage-state",
                    ok: hasState,
                    message: hasState
                        ? `found ${stateFile}`
                        : `storage state file missing (${stateFile}) — test contexts launch anonymous (run: npx playwright test --project=setup)`,
                });
            }
        }
    }
    // Seed test
    const hasSeed = existsSync(join(testsDir, "seed.spec.ts"));
    checks.push({
        category: "Seed Test",
        name: "seed",
        ok: hasSeed,
        message: hasSeed ? "found" : "not found (optional)",
    });
    // App server detection (diagnostic only — not a prerequisite)
    const app = detectAppServer(projectRoot);
    checks.push({
        category: "App Server",
        name: "dev-script",
        ok: Boolean(app.devCommand),
        message: app.devCommand
            ? `${app.devCommand}${app.scriptCommand ? ` (${app.scriptCommand})` : ""}`
            : "not detected (configure webServer manually)",
    });
    checks.push({
        category: "App Server",
        name: "base-url",
        ok: true,
        message: `${app.baseUrl} (${app.baseUrlSource})`,
    });
    const reachable = await checkUrl(app.baseUrl);
    checks.push({
        category: "App Server",
        name: "reachable",
        ok: reachable.ok,
        message: reachable.ok
            ? `responded ${reachable.status ?? "ok"}`
            : `${reachable.message} (diagnostic only; Playwright webServer may start it)`,
    });
    // Lint — swallow-error checklist coverage (lint-guidelines capability).
    // Semantic-first: ESLint's own resolver (`--print-config`) and ruff's
    // (`check --show-settings`) decide coverage; literal probes are the fallback
    // when the tool cannot resolve the config. Optional-check tier
    // (isOptionalCheck — never affects the ok verdict or exit code). A missing
    // config silences that probe face; both faces absent → one info line.
    // Wording is always "not found — see lint-guidelines.md", never "missing":
    // even semantic results are per representative file, so they must not
    // conclude globally.
    const eslintConfig = findEslintConfig(projectRoot);
    const ruffConfig = findRuffConfig(projectRoot);
    const ruffOnPath = probeOnPath("ruff");
    // pyproject.toml is read for pylint discovery (local only — ancestor-aware
    // probing covers ESLint/ruff). An unreadable file is recorded as an info
    // row: the ruff face reports it only when it also qualifies as a ruff
    // config, which is not the case next to a dedicated ruff.toml.
    let pyprojectText = null;
    if (existsSync(join(projectRoot, "pyproject.toml"))) {
        try {
            pyprojectText = readFileSync(join(projectRoot, "pyproject.toml"), "utf-8");
        }
        catch (err) {
            checks.push({
                category: "Lint",
                name: "lint-config",
                ok: true,
                message: `pyproject.toml unreadable — its pylint section was not probed (${err instanceof Error ? err.message : String(err)})`,
            });
        }
    }
    let pyLintConfigFile = [".pylintrc", "pylintrc", "setup.cfg"].find((f) => existsSync(join(projectRoot, f))) ?? null;
    if (pyLintConfigFile === null &&
        pyprojectText &&
        /\[tool\.pylint(?:\.[^\]]*)?\]/.test(pyprojectText)) {
        pyLintConfigFile = "pyproject.toml";
    }
    if (eslintConfig) {
        if (eslintConfig.text === null) {
            const label = eslintConfig.inProject
                ? eslintConfig.file
                : join(eslintConfig.dir, eslintConfig.file);
            checks.push({
                category: "Lint",
                name: "lint-eslint",
                ok: true,
                message: `${label} unreadable — no-empty probe skipped (${eslintConfig.error ?? "read failed"})`,
            });
        }
        else {
            const semantic = probeEslintNoEmpty(projectRoot);
            const covered = semantic.ok
                ? semantic.enabled
                : // `-` belongs to rule ids: no-empty-function / no-empty-pattern must
                    // not count as coverage for no-empty itself.
                    /(?<![\w-])no-empty(?![\w-])/.test(eslintConfig.text);
            if (!semantic.ok) {
                console.error(`doctor: ESLint semantic probe unavailable — literal fallback (${semantic.reason})`);
            }
            if (!covered) {
                checks.push({
                    category: "Lint",
                    name: "lint-eslint",
                    ok: false,
                    message: 'no-empty not found in eslint config — the recommended config already enables it; if you build your rule list by hand, see lint-guidelines.md (rule: ["no-empty": "error"])',
                });
            }
        }
    }
    if (ruffConfig) {
        if (ruffConfig.text === null) {
            const label = ruffConfig.inProject
                ? ruffConfig.file
                : join(ruffConfig.dir, ruffConfig.file);
            checks.push({
                category: "Lint",
                name: "lint-config",
                ok: true,
                message: `${label} unreadable — ruff probes skipped (${ruffConfig.error ?? "read failed"})`,
            });
        }
        else {
            const semantic = ruffOnPath.onPath
                ? probeRuffB904(projectRoot)
                : { ok: false, reason: "ruff not on PATH" };
            const covered = semantic.ok
                ? semantic.enabled
                : /\bB904\b/.test(ruffConfig.text) ||
                    /["']B["']/.test(ruffConfig.text) ||
                    /["']ALL["']/.test(ruffConfig.text);
            if (!semantic.ok) {
                console.error(`doctor: ruff semantic probe unavailable — literal fallback (${semantic.reason})`);
            }
            if (!covered) {
                checks.push({
                    category: "Lint",
                    name: "lint-ruff",
                    ok: false,
                    message: 'B904 not found in ruff lint config — dropped causality (`raise ... from`) inside handlers is not default-covered; see lint-guidelines.md (fix: extend-select = ["B904"])',
                });
            }
            checks.push({
                category: "Lint",
                name: "lint-ruff-cli",
                ok: ruffOnPath.onPath,
                message: ruffOnPath.note
                    ? `ruff ${ruffOnPath.note}`
                    : ruffOnPath.onPath
                        ? "available"
                        : "ruff not installed (optional — run it in CI once the checklist rules are enabled)",
            });
        }
    }
    if (pyLintConfigFile) {
        const pylint = probeOnPath("pylint");
        checks.push({
            category: "Lint",
            name: "lint-pylint-cli",
            ok: pylint.onPath,
            message: pylint.note
                ? `pylint ${pylint.note}`
                : pylint.onPath
                    ? "available"
                    : "pylint not installed (optional — its swallow trio is on by default once pylint runs)",
        });
    }
    if (!eslintConfig && !ruffConfig && !pyLintConfigFile) {
        checks.push({
            category: "Lint",
            name: "lint-config",
            ok: true,
            message: "no ESLint or ruff config found — see lint-guidelines.md if you add one",
        });
    }
    // CodeGraph — optional third-party tooling; failures are warnings, never fatal
    const cg = detectCodeGraphStatus(projectRoot);
    // CLI version probe (only when the CLI is on PATH)
    let cgVersion = "not found";
    if (cg.cliInstalled) {
        try {
            cgVersion = execFileSync("codegraph", ["--version"], {
                encoding: "utf-8",
                shell: needsShell,
            }).trim();
        }
        catch {
            cgVersion = "not found";
        }
    }
    checks.push({
        category: "CodeGraph",
        name: "codegraph-cli",
        ok: cg.cliInstalled,
        message: cgVersion,
    });
    let indexOk;
    let indexMsg;
    if (cg.indexed) {
        indexOk = true;
        indexMsg = "initialized";
    }
    else if (cg.cliInstalled) {
        indexOk = false;
        indexMsg = "not initialized (run: codegraph init)";
    }
    else {
        indexOk = true;
        indexMsg = "not used";
    }
    checks.push({
        category: "CodeGraph",
        name: "codegraph-index",
        ok: indexOk,
        message: indexMsg,
    });
    let mcpOk;
    let mcpMsg;
    if (!cg.indexed) {
        mcpOk = true;
        mcpMsg = "n/a";
    }
    else if (cg.mcpInstalledAdapters.length > 0) {
        mcpOk = true;
        mcpMsg = `installed: ${cg.mcpInstalledAdapters.join(", ")}`;
    }
    else {
        mcpOk = false;
        mcpMsg = "missing (run: codegraph install --target=auto --location=local)";
    }
    checks.push({
        category: "CodeGraph",
        name: "codegraph-mcp",
        ok: mcpOk,
        message: mcpMsg,
    });
    const allOk = checks.filter((c) => !c.ok && !isOptionalCheck(c.name)).length === 0;
    if (options.json) {
        console.log(JSON.stringify({ ok: allOk, checks }, null, 2));
        if (!allOk)
            process.exit(1);
        return;
    }
    // Text output
    console.log(chalk.blue("\n🔍 OpenSpec + Playwright E2E Prerequisites Check\n"));
    let lastCategory = "";
    for (const check of checks) {
        if (check.category !== lastCategory) {
            console.log(chalk.blue(`─── ${check.category} ───`));
            lastCategory = check.category;
        }
        if (check.ok) {
            console.log(chalk.green(`  ✓ ${check.name}: ${check.message}`));
        }
        else if (isOptionalCheck(check.name)) {
            console.log(chalk.yellow(`  ⚠ ${check.name}: ${check.message}`));
        }
        else {
            console.log(chalk.red(`  ✗ ${check.name}: ${check.message}`));
        }
    }
    console.log(chalk.blue("\n─── Summary ───"));
    if (allOk) {
        console.log(chalk.green("  ✅ All prerequisites met!\n"));
        // Hint only over authorized editors — global-signal detection must not
        // suggest commands for editors this project never configured (same
        // display/authorization alignment as update's restart hint).
        const detected = detectAdapters(process.cwd()).filter((a) => hasCommandArtifacts(process.cwd(), a));
        const hints = detected.length
            ? detected.map((a) => {
                return `${slashCommandForAdapter(a)} (in ${a.displayName})`;
            })
            : ["/opsx:e2e (in Claude Code, OpenCode, Cline, Cursor, Pi, Oh My Pi, CodeBuddy CLI, or MiniMax Code)"];
        console.log(chalk.gray(`  Run: ${hints.join("  or  ")} <change-name>\n`));
    }
    else {
        console.log(chalk.red("  ❌ Some prerequisites are missing\n"));
        console.log(chalk.gray("  Run: openspec-pw init to fix\n"));
        process.exit(1);
    }
}
async function checkUrl(url) {
    try {
        const res = await fetch(url, {
            method: "GET",
            signal: AbortSignal.timeout(2000),
        });
        return {
            ok: res.status < 500,
            status: res.status,
            message: `responded ${res.status}`,
        };
    }
    catch (err) {
        return {
            ok: false,
            message: err instanceof Error ? err.message : "not reachable",
        };
    }
}
function countSpecFiles(dir) {
    try {
        return readdirSync(dir, { recursive: true })
            .filter((f) => String(f).endsWith(".spec.md")).length;
    }
    catch {
        return 0;
    }
}
//# sourceMappingURL=doctor.js.map