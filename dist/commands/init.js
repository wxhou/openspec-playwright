import { execFileSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { readFile } from "fs/promises";
import { buildCommandMeta, detectAdapters, getAdapter, getAllAdapters, installCommand, installProjectRules, readEmployeeStandards, resolveToolsArg, slashCommandForAdapter, } from "./editors.js";
import { isPlaywrightMcpInstalled, ensurePlaywrightMcp, needsShell, hasFrontendSignal, detectCodeGraphStatus, codegraphHintLines, } from "../shared/index.js";
const TEMPLATE_DIR = fileURLToPath(new URL("../../templates", import.meta.url));
const E2E_COMMAND_SRC = fileURLToPath(new URL("../../templates/e2e-command.md", import.meta.url));
const EMPLOYEE_STANDARDS_SRC = fileURLToPath(new URL("../../employee-standards.md", import.meta.url));
/**
 * Interactive multi-select of all supported editors, pre-selecting the
 * editors detected in the project. Dynamically imports @inquirer/prompts so
 * non-interactive runs never load it.
 */
export async function promptSelectEditors(allEditors, detectedIds) {
    const { checkbox } = await import("@inquirer/prompts");
    const selected = await checkbox({
        message: "Select editors to configure",
        choices: allEditors.map((a) => ({
            name: detectedIds.has(a.id) ? `${a.displayName} (detected)` : a.displayName,
            value: a.id,
            checked: detectedIds.has(a.id),
        })),
    });
    return selected;
}
export async function init(options, deps = {}) {
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
    // 3. Detect supported editors, then resolve the explicit selection.
    // Priority: --tools flag > interactive prompt (TTY) > detected fallback.
    // (.claude/, .opencode/, .cline/, .cursor/, .pi/, .omp/, .dsh/ in the
    // project; Pi, Oh My Pi, and DeepSeek Harness also detect via their global
    // config dirs ~/.pi/agent, ~/.omp/agent, and ~/.dsh)
    const detected = detectAdapters(projectRoot, deps.homeDir);
    console.log(detected.length > 0
        ? chalk.gray(`  Detected: ${detected.map((a) => a.label).join(", ")}`)
        : chalk.gray("  Detected: none"));
    const isTTY = deps.isTTY ?? process.stdout.isTTY === true;
    const prompt = deps.prompt ?? promptSelectEditors;
    let selectedIds;
    try {
        selectedIds = resolveToolsArg(options.tools);
    }
    catch (err) {
        throw new Error(`Invalid --tools value: ${err.message}`);
    }
    if (selectedIds === null && isTTY) {
        selectedIds = await prompt(getAllAdapters(), new Set(detected.map((a) => a.id)));
    }
    const editors = selectedIds === null
        ? detected
        : selectedIds
            .map(getAdapter)
            .filter((a) => a !== undefined);
    // No flag, non-TTY, and nothing detected → fail with --tools guidance.
    if (selectedIds === null && editors.length === 0) {
        console.log(chalk.yellow("\n  ⚠ No supported editor detected (need .claude/, .opencode/, .cline/, .cursor/, .pi/, .omp/, or .dsh/)."));
        console.log(chalk.gray("  For Cursor without an existing .cursor/ dir: mkdir -p .cursor\n"));
        console.log(chalk.gray("  Pi, Oh My Pi, and DeepSeek Harness are detected via their global config dirs (~/.pi/agent/, ~/.omp/agent/, ~/.dsh/) when no project dir exists.\n"));
        throw new Error('No supported editor detected and no --tools flag provided. Use --tools all, --tools none, or a comma-separated list: claude, opencode, cline, cursor, pi, omp, dsh (oh-my-pi aliases omp).');
    }
    // 3b. Detect a frontend signal — computed once, reused for the MCP
    // install gate (step 4) and the Summary guidance hint.
    const frontendSignal = hasFrontendSignal(projectRoot);
    // 4. Install Playwright MCP for each selected editor — only when a
    // frontend signal was detected (API-only projects test via the request
    // fixture and don't need the browser MCP; --mcp=false still overrides).
    if (options.mcp !== false && editors.length > 0 && frontendSignal === true) {
        console.log(chalk.blue("\n─── Installing Playwright MCP ───"));
        for (const adapter of editors) {
            if (isPlaywrightMcpInstalled(adapter)) {
                console.log(chalk.green(`  ✓ ${adapter.label}: Playwright MCP already installed`));
                continue;
            }
            try {
                ensurePlaywrightMcp(adapter);
                if (adapter.supportsMcp !== false) {
                    console.log(chalk.gray(`  (Restart ${adapter.label} to activate)`));
                }
            }
            catch (err) {
                const e = err;
                if (e.stderr?.includes("already exists")) {
                    console.log(chalk.green(`  ✓ ${adapter.label}: Playwright MCP already installed`));
                }
                else {
                    console.log(chalk.yellow(`  ⚠ ${adapter.label}: failed to install Playwright MCP. Run manually.`));
                    if (adapter.id === "claude") {
                        console.log(chalk.gray("    claude mcp add --scope project playwright npx @playwright/mcp@latest"));
                        if (e.stderr?.includes("--scope")) {
                            console.log(chalk.gray("    (Your claude CLI rejects --scope — update Claude Code, or install without --scope manually)"));
                        }
                    }
                    else if (adapter.id === "opencode") {
                        console.log(chalk.gray("    Add `playwright` to mcp in opencode.json / opencode.jsonc"));
                    }
                    else if (adapter.id === "cline") {
                        console.log(chalk.gray("    Add `playwright` to mcpServers in .cline/mcp.json"));
                    }
                    else if (adapter.id === "omp") {
                        console.log(chalk.gray("    Add `playwright` to mcpServers in .omp/mcp.json"));
                    }
                    else if (adapter.id === "pi") {
                        console.log(chalk.gray("    Pi has no MCP client — use `openspec-pw explore` for browser exploration"));
                    }
                    else {
                        console.log(chalk.gray("    Add `playwright` to mcpServers in .cursor/mcp.json"));
                    }
                    console.log(chalk.gray(`    (Restart ${adapter.label} to activate the MCP server)`));
                }
            }
        }
    }
    else if (options.mcp !== false && editors.length > 0) {
        console.log(chalk.gray("  - No frontend signal detected — skipping Playwright MCP (API tests use the request fixture)"));
    }
    // 5. Install E2E command for each selected editor
    if (editors.length > 0) {
        console.log(chalk.blue("\n─── Installing E2E Commands ───"));
        const body = await readFile(E2E_COMMAND_SRC, "utf-8");
        const meta = buildCommandMeta(body);
        for (const adapter of editors) {
            installCommand(adapter, meta, projectRoot);
        }
    }
    // 6. Generate seed test
    console.log(chalk.blue("\n─── Generating Seed Test ───"));
    await generateSeedTest(projectRoot);
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
    // 8. Install employee-grade standards (AGENTS.md + CLAUDE.md wrapper if Claude)
    if (editors.length > 0) {
        console.log(chalk.blue("\n─── Installing Employee Standards ───"));
        const standards = readEmployeeStandards(EMPLOYEE_STANDARDS_SRC);
        if (standards) {
            installProjectRules(projectRoot, standards, editors);
        }
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
    // Optional: CodeGraph hints — suggest `codegraph init` when the CLI is
    // installed but the project is not indexed, or `codegraph sync` +
    // (when the MCP is missing) `codegraph install` to refresh an existing
    // index. Hints only, never setup.
    const cg = detectCodeGraphStatus(projectRoot);
    const hints = codegraphHintLines(cg);
    if (hints.length > 0) {
        console.log(chalk.gray(`  6. ${hints[0]}`));
        for (const line of hints.slice(1)) {
            console.log(chalk.gray(`     ${line}`));
        }
    }
    if (frontendSignal === false) {
        console.log(chalk.gray("  • If your frontend lives in a subdirectory (monorepo): run openspec-pw init in the app directory (one Playwright config per app)"));
        console.log(chalk.gray("  • If this is an API-only project: use Playwright's request fixture for API tests and point BASE_URL at the API address"));
    }
    if (editors.length > 0) {
        for (const adapter of editors) {
            const slashCmd = slashCommandForAdapter(adapter);
            console.log(chalk.gray(`  • In ${adapter.label}, run: ${slashCmd} <change-name>`));
        }
        console.log(chalk.gray("  • Or: openspec-pw doctor to verify setup\n"));
        console.log(chalk.bold(`\n  Restart ${editors.map((a) => a.displayName).join(" + ")} to use the updated commands.`));
    }
    console.log(chalk.bold("How it works:"));
    console.log(chalk.gray("  /opsx:e2e (Claude), /opsx-e2e (OpenCode/Cline/Cursor/Pi/Oh My Pi/DeepSeek Harness) read your OpenSpec specs"));
    console.log(chalk.gray("  and run Playwright E2E tests through a three-agent pipeline:"));
    console.log(chalk.gray("  Planner → Generator → Healer\n"));
}
export async function generateSeedTest(projectRoot) {
    const testsDir = join(projectRoot, "tests", "playwright");
    mkdirSync(testsDir, { recursive: true });
    const seedPath = join(testsDir, "seed.spec.ts");
    if (existsSync(seedPath)) {
        console.log(chalk.gray("  - seed.spec.ts already exists, skipping"));
    }
    else {
        const seedContent = await readFile(TEMPLATE_DIR + "/seed.spec.ts", "utf-8");
        writeFileSync(seedPath, seedContent);
        console.log(chalk.green("  ✓ Generated: tests/playwright/seed.spec.ts"));
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