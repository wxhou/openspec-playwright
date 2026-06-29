import { existsSync } from "fs";
import { createRequire } from "node:module";
import { join } from "path";
import { execFileSync } from "child_process";
import chalk from "chalk";
import { detectAdapters } from "../commands/editors.js";
import { detectAppServer, isPlaywrightMcpInstalled, needsShell } from "../shared/index.js";
export async function doctor(options = {}) {
    const checks = [];
    const projectRoot = process.cwd();
    // Node.js
    try {
        const node = execFileSync("node", ["--version"], {
            encoding: "utf-8",
            shell: needsShell,
        }).trim();
        checks.push({
            category: "Node.js",
            name: "node",
            ok: true,
            message: node,
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
    // OpenSpec
    const hasOpenSpec = existsSync(join(projectRoot, "openspec"));
    checks.push({
        category: "OpenSpec",
        name: "openspec",
        ok: hasOpenSpec,
        message: hasOpenSpec ? "initialized" : "not initialized",
    });
    // Playwright browsers
    try {
        const pw = execFileSync("npx", ["playwright", "--version"], {
            encoding: "utf-8",
            shell: needsShell,
        }).trim();
        checks.push({
            category: "Playwright Browsers",
            name: "playwright",
            ok: true,
            message: pw,
        });
    }
    catch {
        checks.push({
            category: "Playwright Browsers",
            name: "playwright",
            ok: false,
            message: "not installed",
        });
    }
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
            message: "no editors detected (configure .claude/ or .opencode/)",
        });
    }
    else {
        for (const adapter of adapters) {
            const installed = isPlaywrightMcpInstalled(adapter);
            checks.push({
                category: "Playwright MCP",
                name: `playwright-mcp-${adapter.label}`,
                ok: installed,
                message: installed ? "installed" : `not configured for ${adapter.label}`,
            });
        }
    }
    // Seed test
    const hasSeed = existsSync(join(projectRoot, "tests", "playwright", "seed.spec.ts"));
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
    const allOk = checks.filter((c) => !c.ok && c.category !== "Seed Test" && c.category !== "App Server").length === 0;
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
        else if (check.category === "Seed Test" || check.category === "App Server" || check.category === "Vision Check") {
            console.log(chalk.yellow(`  ⚠ ${check.name}: ${check.message}`));
        }
        else {
            console.log(chalk.red(`  ✗ ${check.name}: ${check.message}`));
        }
    }
    console.log(chalk.blue("\n─── Summary ───"));
    if (allOk) {
        console.log(chalk.green("  ✅ All prerequisites met!\n"));
        console.log(chalk.gray("  Run: /opsx:e2e <change-name> in Claude Code\n"));
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
//# sourceMappingURL=doctor.js.map