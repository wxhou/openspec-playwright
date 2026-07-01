import { execFileSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { readFile } from "fs/promises";
import { buildCommandMeta, detectAdapters, installCommand, installProjectRules, readEmployeeStandards, } from "./editors.js";
import { isPlaywrightMcpInstalled, ensurePlaywrightMcp, needsShell } from "../shared/index.js";
const TEMPLATE_DIR = fileURLToPath(new URL("../../templates", import.meta.url));
const E2E_COMMAND_SRC = fileURLToPath(new URL("../../templates/e2e-command.md", import.meta.url));
const EMPLOYEE_STANDARDS_SRC = fileURLToPath(new URL("../../employee-standards.md", import.meta.url));
export async function init(options) {
    console.log(chalk.blue("\n🔧 OpenSpec + Playwright E2E Setup\n"));
    const projectRoot = process.cwd();
    // 1. Check prerequisites
    console.log(chalk.blue("─── Prerequisites ───"));
    const hasNode = hasCmd("node", ["--version"], "Node.js", true);
    const hasNpm = hasCmd("npm", ["--version"], "npm", true);
    // Use execFile (no shell) so Windows paths in tmp dirs / node modules
    // are passed verbatim and `2>/dev/null` / `||` bash-isms don't reach cmd.exe.
    // Equivalent of: `npx openspec --version || echo "not found"`
    try {
        execFileSync("npx", ["openspec", "--version"], { encoding: "utf-8", stdio: "pipe", shell: needsShell });
        console.log(chalk.green("  ✓ OpenSpec found"));
    }
    catch {
        console.log(chalk.gray("  - OpenSpec not found (run: npm install -g @fission-ai/openspec@latest)"));
    }
    if (!hasNode || !hasNpm) {
        console.log(chalk.red("  ✗ Node.js/npm is required"));
        process.exit(1);
    }
    console.log(chalk.green("  ✓ Node.js and npm found"));
    // 2. Check OpenSpec
    if (!existsSync(join(projectRoot, "openspec"))) {
        console.log(chalk.yellow("\n⚠ OpenSpec not initialized. Run these commands first:"));
        console.log(chalk.gray("  npm install -g @fission-ai/openspec@latest"));
        console.log(chalk.gray("  openspec init"));
        console.log(chalk.gray("  openspec config profile core"));
        console.log(chalk.gray("  openspec update\n"));
        console.log(chalk.gray("  Then run openspec-pw init again.\n"));
        return;
    }
    console.log(chalk.green("  ✓ OpenSpec initialized"));
    // 3. Detect supported editors (.claude/ and/or .opencode/)
    const detected = detectAdapters(projectRoot);
    if (detected.length === 0) {
        console.log(chalk.yellow("\n  ⚠ No supported editor detected (need .claude/ or .opencode/)."));
        console.log(chalk.gray("  Run openspec-pw init from a Claude Code or OpenCode project to install commands.\n"));
        return;
    }
    console.log(chalk.gray(`  Detected: ${detected.map((a) => a.label).join(", ")}`));
    // 4. Install Playwright MCP for each detected editor
    if (options.mcp !== false) {
        console.log(chalk.blue("\n─── Installing Playwright MCP ───"));
        for (const adapter of detected) {
            if (isPlaywrightMcpInstalled(adapter)) {
                console.log(chalk.green(`  ✓ ${adapter.label}: Playwright MCP already installed`));
                continue;
            }
            try {
                ensurePlaywrightMcp(adapter);
                console.log(chalk.gray(`  (Restart ${adapter.label} to activate)`));
            }
            catch (err) {
                const e = err;
                if (e.stderr?.includes("already exists")) {
                    console.log(chalk.green(`  ✓ ${adapter.label}: Playwright MCP already installed`));
                }
                else {
                    console.log(chalk.yellow(`  ⚠ ${adapter.label}: failed to install Playwright MCP. Run manually.`));
                    if (adapter.id === "claude") {
                        console.log(chalk.gray("    claude mcp add playwright npx @playwright/mcp@latest"));
                    }
                    else {
                        console.log(chalk.gray("    Add `playwright` to mcp in opencode.json / opencode.jsonc"));
                    }
                    console.log(chalk.gray(`    (Restart ${adapter.label} to activate the MCP server)`));
                }
            }
        }
    }
    // 5. Install E2E command for each detected editor
    console.log(chalk.blue("\n─── Installing E2E Commands ───"));
    const body = await readFile(E2E_COMMAND_SRC, "utf-8");
    const meta = buildCommandMeta(body);
    for (const adapter of detected) {
        installCommand(adapter, meta, projectRoot);
    }
    // 6. Generate seed test
    console.log(chalk.blue("\n─── Generating Seed Test ───"));
    await generateSeedTest(projectRoot, options.seed === true);
    // 6b. Generate shared pages directory
    console.log(chalk.blue("\n─── Generating Shared Pages ───"));
    await generateSharedPages(projectRoot);
    // 6c. Generate playwright.config.ts
    console.log(chalk.blue("\n─── Generating Playwright Config ───"));
    await generatePlaywrightConfig(projectRoot);
    // 7. Generate app-knowledge.md
    console.log(chalk.blue("\n─── Generating App Knowledge ───"));
    await generateAppKnowledge(projectRoot);
    // 7b. Generate GitHub Actions workflow (if --ci)
    if (options.ci) {
        console.log(chalk.blue("\n─── Generating CI Workflow ───"));
        await generateGithubWorkflow(projectRoot);
    }
    // 8. Install employee-grade CLAUDE.md
    console.log(chalk.blue("\n─── Installing Employee Standards ───"));
    const standards = readEmployeeStandards(EMPLOYEE_STANDARDS_SRC);
    if (standards) {
        installProjectRules(projectRoot, standards, detected);
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
    for (const adapter of detected) {
        const slashCmd = adapter.id === "claude" ? "/opsx:e2e" : "/opsx-e2e";
        console.log(chalk.gray(`  • In ${adapter.label}, run: ${slashCmd} <change-name>`));
    }
    console.log(chalk.gray("  • Or: openspec-pw run <change-name>"));
    console.log(chalk.gray("  • Or: openspec-pw doctor to verify setup\n"));
    console.log(chalk.bold(`\n  Restart ${detected.map((a) => a.displayName).join(" + ")} to use the updated commands.`));
    console.log(chalk.bold("How it works:"));
    console.log(chalk.gray("  /opsx:e2e (Claude) and /opsx-e2e (OpenCode) read your OpenSpec specs"));
    console.log(chalk.gray("  and run Playwright E2E tests through a three-agent pipeline:"));
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
export async function generateGithubWorkflow(projectRoot) {
    const workflowsDir = join(projectRoot, ".github", "workflows");
    mkdirSync(workflowsDir, { recursive: true });
    const workflowSrc = join(TEMPLATE_DIR, "github-workflow.yml");
    const workflowDest = join(workflowsDir, "openspec-pw.yml");
    if (existsSync(workflowDest)) {
        console.log(chalk.gray("  - .github/workflows/openspec-pw.yml already exists, skipping"));
        return;
    }
    if (existsSync(workflowSrc)) {
        writeFileSync(workflowDest, readFileSync(workflowSrc));
        console.log(chalk.green("  ✓ Generated: .github/workflows/openspec-pw.yml"));
        console.log(chalk.gray("  Set E2E_USERNAME, E2E_PASSWORD, BASE_URL secrets in repo settings."));
    }
    else {
        console.log(chalk.gray("  - CI template not found in package"));
    }
}
export async function generatePlaywrightConfig(projectRoot) {
    const configSrc = join(TEMPLATE_DIR, "playwright.config.ts");
    const configDest = join(projectRoot, "playwright.config.ts");
    if (existsSync(configDest)) {
        console.log(chalk.gray("  - playwright.config.ts already exists, skipping"));
        suggestPlaywrightConfigPatch(configDest);
        return;
    }
    if (existsSync(configSrc)) {
        writeFileSync(configDest, readFileSync(configSrc));
        console.log(chalk.green("  ✓ Generated: playwright.config.ts"));
        console.log(chalk.gray("  Customize webServer command and port for your app."));
    }
    else {
        console.log(chalk.gray("  - Playwright config template not found in package"));
    }
}
function suggestPlaywrightConfigPatch(configPath) {
    const config = readFileSync(configPath, "utf-8");
    const suggestions = [];
    if (!config.includes("webServer")) {
        suggestions.push("add webServer so Playwright can start/stop your app automatically");
    }
    if (!config.includes("tests/playwright") && !config.includes("testDir")) {
        suggestions.push("set testDir to tests/playwright");
    }
    if (!config.includes("storageState")) {
        suggestions.push("optionally wire storageState from playwright/.auth/user.json for authenticated tests");
    }
    if (!config.includes("dependencies") || !config.includes("setup")) {
        suggestions.push("add a setup project for auth.setup.ts when login is required");
    }
    if (suggestions.length === 0)
        return;
    console.log(chalk.yellow("  ⚠ Existing config was not modified. Recommended checks:"));
    for (const suggestion of suggestions) {
        console.log(chalk.gray(`    - ${suggestion}`));
    }
    console.log(chalk.gray("    Compare with: openspec-pw init in a temporary project, or copy from templates/playwright.config.ts"));
}
function hasCmd(bin, args, name, silent = false) {
    try {
        execFileSync(bin, args, { stdio: "pipe", shell: needsShell });
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