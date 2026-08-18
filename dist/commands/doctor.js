import { existsSync, lstatSync, readdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { createRequire } from "node:module";
import { join } from "path";
import { execFileSync } from "child_process";
import chalk from "chalk";
import { detectAdapters, slashCommandForAdapter, claudeWrapperStandardsContent } from "../commands/editors.js";
import { detectAppServer, isPlaywrightMcpInstalled, needsShell } from "../shared/index.js";
import { bundledStandardsPath, compareBlock, OPENSPEC_START } from "../shared/drift.js";
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
    // Playwright Config file
    const configFiles = ["playwright.config.ts", "playwright.config.js", "playwright.config.mjs", "playwright.config.mts"];
    const configPath = configFiles.find((f) => existsSync(join(projectRoot, f)));
    checks.push({
        category: "Playwright Config",
        name: "config",
        ok: Boolean(configPath),
        message: configPath ? `found ${configPath}` : "not found",
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
    // Playwright CLI (package installed)
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
    // Playwright browser binaries installed
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
    // Playwright Test framework (imported by spec files)
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
    // Playwright MCP — check each detected editor adapter
    const adapters = detectAdapters(projectRoot);
    if (adapters.length === 0) {
        checks.push({
            category: "Playwright MCP",
            name: "playwright-mcp",
            ok: false,
            message: "no editors detected (configure .claude/, .opencode/, .cline/, .cursor/, .pi/, .omp/, or .dsh/)",
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
                    message: `${adapter.displayName} has no MCP client (use openspec-pw explore)`,
                });
                continue;
            }
            const installed = isPlaywrightMcpInstalled(adapter);
            checks.push({
                category: "Playwright MCP",
                name: `playwright-mcp-${adapter.label}`,
                ok: installed,
                message: installed ? "installed" : `not configured for ${adapter.label}`,
            });
            // Claude Code MCP moved to project scope (0.3.69): isMcpInstalled only
            // reads the project .mcp.json, so a legacy user-scope entry from older
            // versions is invisible here. Surface it — Claude Code would load both.
            if (adapter.id === "claude" && installed) {
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
        // Cursor-specific: command + skill readiness (spec requirement)
        const cursor = adapters.find((a) => a.id === "cursor");
        if (cursor) {
            const cmdPath = join(projectRoot, ".cursor", "commands", "opsx-e2e.md");
            const skillPath = join(projectRoot, ".cursor", "skills", "opsx-e2e", "SKILL.md");
            const hasCmd = existsSync(cmdPath);
            const hasSkill = existsSync(skillPath);
            checks.push({
                category: "Cursor E2E",
                name: "cursor-e2e-command",
                ok: hasCmd,
                message: hasCmd
                    ? ".cursor/commands/opsx-e2e.md found"
                    : ".cursor/commands/opsx-e2e.md missing",
            });
            checks.push({
                category: "Cursor E2E",
                name: "cursor-e2e-skill",
                ok: hasSkill,
                message: hasSkill
                    ? ".cursor/skills/opsx-e2e/SKILL.md found"
                    : ".cursor/skills/opsx-e2e/SKILL.md missing",
            });
        }
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
        existsSync(join(projectRoot, ".omp", "commands", "opsx-e2e.md")) ||
        existsSync(join(projectRoot, ".dsh", "skills", "opsx-e2e", "SKILL.md"));
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
        // AGENTS.md is the single source of truth — always checked regardless of
        // which editors are detected (covers claude-only projects). A present file
        // with no OPENSPEC marker needs the block appended (tool-owned).
        const agentsPath = join(projectRoot, "AGENTS.md");
        if (!existsSync(agentsPath)) {
            checks.push({
                category: "Sync",
                name: "standards-agents",
                ok: false,
                message: "AGENTS.md missing — run openspec-pw update",
            });
        }
        else {
            const fileContent = readFileSync(agentsPath, "utf-8");
            const noMarkers = !fileContent.includes(OPENSPEC_START);
            const drift = noMarkers
                ? { stale: true }
                : compareBlock(fileContent, standardsExpected);
            checks.push({
                category: "Sync",
                name: "standards-agents",
                ok: !drift.stale,
                message: drift.stale
                    ? "AGENTS.md needs update (missing markers or differs from bundled version) — run openspec-pw update"
                    : "standards in sync",
            });
        }
        // CLAUDE.md wrapper is only checked when Claude is detected. A bare
        // `@AGENTS.md` import without markers is left untouched — not stale.
        if (adapters.some((a) => a.id === "claude")) {
            const claudePath = join(projectRoot, "CLAUDE.md");
            // A symlinked CLAUDE.md (→ AGENTS.md, the official reuse pattern) is
            // covered by the standards-agents check above — comparing it against
            // the wrapper expectation would false-positive.
            if (existsSync(claudePath) && lstatSync(claudePath).isSymbolicLink()) {
                checks.push({
                    category: "Sync",
                    name: "standards-claude",
                    ok: true,
                    message: "CLAUDE.md symlinks AGENTS.md — covered by standards-agents",
                });
            }
            else if (!existsSync(claudePath)) {
                checks.push({
                    category: "Sync",
                    name: "standards-claude",
                    ok: false,
                    message: "CLAUDE.md missing — run openspec-pw update",
                });
            }
            else {
                const fileContent = readFileSync(claudePath, "utf-8");
                let stale;
                if (!fileContent.includes(OPENSPEC_START)) {
                    stale = !/^@AGENTS\.md\r?$/m.test(fileContent);
                }
                else {
                    stale = compareBlock(fileContent, claudeWrapperStandardsContent()).stale;
                }
                checks.push({
                    category: "Sync",
                    name: "standards-claude",
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
    // Tests directory structure
    const testsDir = join(projectRoot, "tests", "playwright");
    const hasTestsDir = existsSync(testsDir);
    checks.push({
        category: "Tests",
        name: "directory",
        ok: hasTestsDir,
        message: hasTestsDir ? "tests/playwright/ exists" : "not found",
    });
    const hasAuthSetup = existsSync(join(testsDir, "auth.setup.ts"));
    checks.push({
        category: "Tests",
        name: "auth-setup",
        ok: hasAuthSetup,
        message: hasAuthSetup ? "found" : "not found (optional)",
    });
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
    const OPTIONAL_NAMES = new Set([
        "engines",
        "specs",
        "auth-setup",
        "seed",
        "dev-script",
        "base-url",
        "reachable",
    ]);
    const allOk = checks.filter((c) => !c.ok && !OPTIONAL_NAMES.has(c.name)).length === 0;
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
        else if (OPTIONAL_NAMES.has(check.name)) {
            console.log(chalk.yellow(`  ⚠ ${check.name}: ${check.message}`));
        }
        else {
            console.log(chalk.red(`  ✗ ${check.name}: ${check.message}`));
        }
    }
    console.log(chalk.blue("\n─── Summary ───"));
    if (allOk) {
        console.log(chalk.green("  ✅ All prerequisites met!\n"));
        const detected = detectAdapters(process.cwd());
        const hints = detected.length
            ? detected.map((a) => {
                return `${slashCommandForAdapter(a)} (in ${a.displayName})`;
            })
            : ["/opsx:e2e (in Claude Code, OpenCode, Cline, Cursor, Pi, Oh My Pi, or DeepSeek Harness)"];
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