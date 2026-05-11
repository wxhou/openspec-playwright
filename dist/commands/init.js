import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { readFile } from "fs/promises";
import { hasClaudeCode, installForClaudeCode, installProjectClaudeMd, readEmployeeStandards, } from "./editors.js";
const TEMPLATE_DIR = fileURLToPath(new URL("../../templates", import.meta.url));
const E2E_COMMAND_SRC = fileURLToPath(new URL("../../templates/e2e-command.md", import.meta.url));
const EMPLOYEE_STANDARDS_SRC = fileURLToPath(new URL("../../employee-standards.md", import.meta.url));
export async function init(options) {
    console.log(chalk.blue("\n🔧 OpenSpec + Playwright E2E Setup\n"));
    const projectRoot = process.cwd();
    // 1. Check prerequisites
    console.log(chalk.blue("─── Prerequisites ───"));
    const hasNode = execCmd("node --version", "Node.js", true);
    const hasNpm = execCmd("npm --version", "npm", true);
    execCmd('npx openspec --version 2>/dev/null || echo "not found"', "OpenSpec", true);
    if (!hasNode || !hasNpm) {
        console.log(chalk.red("  ✗ Node.js/npm is required"));
        process.exit(1);
    }
    console.log(chalk.green("  ✓ Node.js and npm found"));
    // 2. Check OpenSpec
    if (!existsSync(join(projectRoot, "openspec"))) {
        console.log(chalk.yellow("\n⚠ OpenSpec not initialized. Run these commands first:"));
        console.log(chalk.gray("  npm install -g @fission-ai/openspec"));
        console.log(chalk.gray("  openspec init"));
        console.log(chalk.gray("  openspec config profile core"));
        console.log(chalk.gray("  openspec update\n"));
        console.log(chalk.gray("  Then run openspec-pw init again.\n"));
        return;
    }
    console.log(chalk.green("  ✓ OpenSpec initialized"));
    // 3. Install Playwright MCP (global)
    if (options.mcp !== false) {
        console.log(chalk.blue("\n─── Installing Playwright MCP ───"));
        // Check using `claude mcp list` as source of truth (platform-independent)
        let mcpInstalled = false;
        try {
            const output = execSync("claude mcp list", {
                encoding: "utf-8",
                timeout: 10000,
            });
            if (output.includes("playwright")) {
                mcpInstalled = true;
            }
        }
        catch {
            // claude CLI not available — will try to install
        }
        if (mcpInstalled) {
            console.log(chalk.green("  ✓ Playwright MCP already installed"));
        }
        else {
            try {
                execSync("claude mcp add playwright npx @playwright/mcp@latest", {
                    cwd: projectRoot,
                    stdio: "pipe",
                    encoding: "utf-8",
                });
                console.log(chalk.green("  ✓ Playwright MCP installed globally"));
                console.log(chalk.gray("  (Restart Claude Code to activate)"));
            }
            catch (err) {
                const e = err;
                if (e.stderr?.includes("already exists")) {
                    console.log(chalk.green("  ✓ Playwright MCP already installed"));
                }
                else {
                    console.log(chalk.yellow("  ⚠ Failed to run claude mcp add. Run manually:"));
                    console.log(chalk.gray("    claude mcp add playwright npx @playwright/mcp@latest"));
                    console.log(chalk.gray("    (Restart Claude Code to activate the MCP server)"));
                }
            }
        }
    }
    // 4. Install E2E command for Claude Code
    console.log(chalk.blue("\n─── Installing E2E Commands ───"));
    const body = await readFile(E2E_COMMAND_SRC, "utf-8");
    if (hasClaudeCode(projectRoot)) {
        installForClaudeCode(body, projectRoot);
    }
    else {
        console.log(chalk.yellow("  ⚠ Claude Code not detected (.claude/ not found)."));
        console.log(chalk.gray("  Run openspec-pw init from a Claude Code project to install commands.\n"));
        return;
    }
    // 6. Generate seed test
    if (options.seed !== false) {
        console.log(chalk.blue("\n─── Generating Seed Test ───"));
        await generateSeedTest(projectRoot, options.seed === true);
    }
    // 6b. Generate shared pages directory
    if (options.seed !== false) {
        console.log(chalk.blue("\n─── Generating Shared Pages ───"));
        await generateSharedPages(projectRoot);
    }
    // 7. Generate app-knowledge.md
    console.log(chalk.blue("\n─── Generating App Knowledge ───"));
    await generateAppKnowledge(projectRoot);
    // 8. Install employee-grade CLAUDE.md
    console.log(chalk.blue("\n─── Installing Employee Standards ───"));
    const standards = readEmployeeStandards(EMPLOYEE_STANDARDS_SRC);
    if (standards) {
        installProjectClaudeMd(projectRoot, standards);
    }
    // 9. Summary
    console.log(chalk.blue("\n─── Summary ───"));
    console.log(chalk.green("  ✓ Setup complete!\n"));
    console.log(chalk.bold("Next steps:"));
    console.log(chalk.gray("  1. Install Playwright browsers: npx playwright install --with-deps"));
    console.log(chalk.gray("  2. Customize tests/playwright/credentials.yaml with your test user"));
    console.log(chalk.gray("  3. Set credentials: export E2E_USERNAME=xxx E2E_PASSWORD=yyy"));
    console.log(chalk.gray("  4. Run auth setup: npx playwright test --project=setup"));
    console.log(chalk.gray("  5. Page objects: extend tests/playwright/pages/BasePage.ts for shared selectors"));
    const hasClaude = existsSync(join(projectRoot, ".claude"));
    if (hasClaude) {
        console.log(chalk.gray("  6. In Claude Code, run: /opsx:e2e <change-name>"));
    }
    console.log(chalk.gray(`  ${hasClaude ? "7." : "6."} Or: openspec-pw run <change-name>`));
    console.log(chalk.gray(`  ${hasClaude ? "8." : "7."} Or: openspec-pw doctor to verify setup\n`));
    console.log(chalk.bold("How it works:"));
    console.log(chalk.gray("  /opsx:e2e reads your OpenSpec specs and runs Playwright"));
    console.log(chalk.gray("  E2E tests through a three-agent pipeline:"));
    console.log(chalk.gray("  Planner → Generator → Healer\n"));
}
export async function generateSeedTest(projectRoot, force) {
    const testsDir = join(projectRoot, "tests", "playwright");
    mkdirSync(testsDir, { recursive: true });
    const seedPath = join(testsDir, "seed.spec.ts");
    if (existsSync(seedPath) && !force) {
        console.log(chalk.gray("  - seed.spec.ts already exists, skipping (use --seed to overwrite)"));
    }
    else {
        const seedContent = await readFile(TEMPLATE_DIR + "/seed.spec.ts", "utf-8");
        writeFileSync(seedPath, seedContent);
        console.log(chalk.green("  ✓ Generated: tests/playwright/seed.spec.ts" + (force ? " (overwritten)" : "")));
    }
    // Generate auth.setup.ts
    const authSetupPath = join(testsDir, "auth.setup.ts");
    if (existsSync(authSetupPath)) {
        console.log(chalk.gray("  - auth.setup.ts already exists, skipping"));
    }
    else {
        const authContent = await readFile(TEMPLATE_DIR + "/auth.setup.ts", "utf-8");
        writeFileSync(authSetupPath, authContent);
        console.log(chalk.green("  ✓ Generated: tests/playwright/auth.setup.ts"));
    }
    // Generate credentials.yaml
    const credsPath = join(testsDir, "credentials.yaml");
    if (existsSync(credsPath)) {
        console.log(chalk.gray("  - credentials.yaml already exists, skipping"));
    }
    else {
        const credsContent = await readFile(TEMPLATE_DIR + "/credentials.yaml", "utf-8");
        writeFileSync(credsPath, credsContent);
        console.log(chalk.green("  ✓ Generated: tests/playwright/credentials.yaml"));
    }
    console.log(chalk.gray("  (Customize BASE_URL and credentials for your app)"));
}
export async function generateAppKnowledge(projectRoot) {
    const src = join(TEMPLATE_DIR, "app-knowledge.md");
    const dest = join(projectRoot, "tests", "playwright", "app-knowledge.md");
    if (existsSync(dest)) {
        console.log(chalk.gray("  - app-knowledge.md already exists, skipping"));
        return;
    }
    if (existsSync(src)) {
        writeFileSync(dest, readFileSync(src));
        console.log(chalk.green("  ✓ Generated: tests/playwright/app-knowledge.md"));
    }
}
export async function generateSharedPages(projectRoot) {
    const pagesDir = join(projectRoot, "tests", "playwright", "pages");
    mkdirSync(pagesDir, { recursive: true });
    const basePageSrc = join(TEMPLATE_DIR, "pages", "BasePage.ts");
    const basePageDest = join(pagesDir, "BasePage.ts");
    if (existsSync(basePageDest)) {
        console.log(chalk.gray("  - pages/BasePage.ts already exists, skipping"));
    }
    else if (existsSync(basePageSrc)) {
        writeFileSync(basePageDest, readFileSync(basePageSrc));
        console.log(chalk.green("  ✓ Generated: tests/playwright/pages/BasePage.ts"));
        console.log(chalk.gray("  (Extend BasePage to create page objects: pages/LoginPage.ts, etc.)"));
    }
}
function execCmd(cmd, name, silent = false) {
    try {
        execSync(cmd, { stdio: "pipe" });
        if (!silent)
            console.log(chalk.green(`  ✓ ${name} found`));
        return true;
    }
    catch {
        if (!silent)
            console.log(chalk.yellow(`  ⚠ ${name} not found`));
        return false;
    }
}
//# sourceMappingURL=init.js.map