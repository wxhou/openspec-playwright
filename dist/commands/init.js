import { execFileSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, rmdirSync, } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { readFile } from "fs/promises";
import { buildCommandMeta, detectAdapters, detectProjectAdapters, getAdapter, getAllAdapters, installCommand, installOptionalArtifacts, installProjectRules, migrateLegacyMarkers, readEmployeeStandards, resolveToolsArg, slashCommandForAdapter, intentFileEditors, enumerateAdapterArtifacts, enumerateVendoredAgents, installedAgentsSnapshotDir, isInventoryEmpty, removeAdapterMcp, removeAdapterCommandArtifacts, removeOwnedVendoredAgents, removeClaudeLegacySkill, removeClaudeWrapper, removeMarkersFromFile, normalizeEol, } from "./editors.js";
import { isEditorConfigured, agentsFileHasMarkers, } from "./editors/configured.js";
import { ensureTestRunnerMcp, isTestRunnerMcpInstalled, TEST_RUNNER_MCP_SERVER, needsShell, hasFrontendSignal, explainFrontendSignal, detectCodeGraphStatus, codegraphHintLines, CREDENTIALS_RELPATHS, credentialsIgnoreHint, findUnignoredFiles, } from "../shared/index.js";
const TEMPLATE_DIR = fileURLToPath(new URL("../../templates", import.meta.url));
const E2E_COMMAND_SRC = fileURLToPath(new URL("../../templates/e2e-command.md", import.meta.url));
const EMPLOYEE_STANDARDS_SRC = fileURLToPath(new URL("../../employee-standards.md", import.meta.url));
const TESTS_README_SRC = fileURLToPath(new URL("../../templates/tests-readme.md", import.meta.url));
/**
 * Interactive multi-select of all supported editors, pre-selecting the
 * editors passed in `preselected`. In the artifact-manifest tier those are
 * the configured editors — the `configured` set drives the "(configured)"
 * name suffix. In the first-run bypass tier `configured` is empty, so no
 * suffix renders. Dynamically imports @inquirer/prompts so non-interactive
 * runs never load it.
 */
export async function promptSelectEditors(allEditors, preselected, configured = new Set()) {
    const { checkbox } = await import("@inquirer/prompts");
    const selected = await checkbox({
        message: "Select editors to configure",
        choices: allEditors.map((a) => ({
            name: configured.has(a.id)
                ? `${a.displayName} (configured)`
                : a.displayName,
            value: a.id,
            checked: preselected.has(a.id),
        })),
    });
    return selected;
}
/**
 * Init modes: "frontend" keeps the full Playwright scaffold (existing
 * behavior); "minimal" delivers only tests/README.md plus employee
 * standards. Explicit --frontend/--no-frontend flags win over the detection
 * signal; null (no readable package.json, e.g. Python/Go backends) is
 * minimal mode — init-minimal-mode spec.
 */
export function resolveInitMode(options, frontendSignal) {
    if (options.frontend === true)
        return "frontend";
    if (options.frontend === false)
        return "minimal";
    return frontendSignal === true ? "frontend" : "minimal";
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
    // `detected` is any-scope (project dirs + global config dirs for
    // Pi/Oh My Pi) — used for display and, on a project with zero
    // openspec-pw state (first run), the interactive pre-select. The
    // pre-select itself reads the configured manifest (isEditorConfigured):
    // detection is the keep-alive signal (official openspec CLI files, user
    // config, global home dirs), so it must not drive the checkbox once the
    // project has real openspec-pw products.
    const detected = detectAdapters(projectRoot, deps.homeDir);
    const projectDetected = detectProjectAdapters(projectRoot);
    const configuredIds = new Set(detected
        .filter((a) => isEditorConfigured(a, projectRoot))
        .map((a) => a.id));
    const hasAnyState = configuredIds.size > 0 || agentsFileHasMarkers(projectRoot);
    // Two-tier pre-select: artifact-manifest tier pre-checks only configured
    // editors; the first-run bypass (zero openspec-pw state) pre-checks the
    // pre-select signal set — project marker dirs plus root intent files.
    // Machine state (global home dirs) never pre-checks an editor.
    const preselectHintIds = [
        ...new Set([
            ...projectDetected.map((a) => a.id),
            ...intentFileEditors(projectRoot),
        ]),
    ];
    const preselectedIds = hasAnyState
        ? configuredIds
        : new Set(preselectHintIds);
    // With --tools the user has already expressed intent, so stay silent: the
    // line would be misread as the install set.
    if (options.tools === undefined) {
        if (hasAnyState) {
            console.log(configuredIds.size > 0
                ? chalk.gray(`  Configured (pre-select): ${[...configuredIds]
                    .map((id) => getAdapter(id)?.label ?? id)
                    .join(", ")}`)
                : chalk.gray("  Configured: none"));
        }
        else {
            console.log(preselectHintIds.length > 0
                ? chalk.gray(`  Detected (pre-select): ${preselectHintIds
                    .map((id) => getAdapter(id)?.label ?? id)
                    .join(", ")}`)
                : chalk.gray("  Detected: none"));
            // First-run tier only: editors installed on this machine (global home
            // dirs) but not pre-selected — the user can still check them.
            const globalOnly = detected.filter((a) => !preselectHintIds.includes(a.id));
            if (globalOnly.length > 0) {
                console.log(chalk.gray(`  Globally detected, not pre-selected: ${globalOnly
                    .map((a) => a.label)
                    .join(", ")} — check to include`));
            }
        }
    }
    const isTTY = deps.isTTY ?? process.stdout.isTTY === true;
    const prompt = deps.prompt ?? promptSelectEditors;
    let selectedIds;
    // True only when the selection came from the interactive prompt — the
    // deselected-removal phase runs exclusively on that path (--tools is an
    // explicit authorization list; non-TTY never removes).
    let interactiveSelection = false;
    try {
        selectedIds = resolveToolsArg(options.tools);
    }
    catch (err) {
        throw new Error(`Invalid --tools value: ${err.message}`);
    }
    // Agents are an editor add-on — "--tools none --agents" has nothing to
    // attach to. Fail before any writes, mirroring the resolveToolsArg errors.
    if (options.agents && selectedIds !== null && selectedIds.length === 0) {
        throw new Error('The --agents option requires at least one configured editor (claude) and cannot be combined with "--tools none".');
    }
    if (selectedIds === null && isTTY) {
        interactiveSelection = true;
        selectedIds = await prompt(getAllAdapters(), preselectedIds, configuredIds);
    }
    const editors = selectedIds === null
        ? projectDetected
        : selectedIds
            .map(getAdapter)
            .filter((a) => a !== undefined);
    // The actual install set — what this run will configure. The Selected
    // editors line is the authoritative signal (mirrors the Summary's
    // Restart list); it prints before any installCommand runs, and before
    // the empty-detection failure below so `none` accompanies the error.
    console.log(chalk.gray(`  Selected editors: ${editors.map((a) => a.label).join(", ") || "none"}`));
    // No flag, non-TTY, and nothing detected → fail with --tools guidance.
    if (selectedIds === null && editors.length === 0) {
        console.log(chalk.yellow("\n  ⚠ No supported editor detected in the project (need .claude/, .opencode/, .cline/, .cursor/, .pi/, or .omp/)."));
        console.log(chalk.gray("  For Cursor without an existing .cursor/ dir: mkdir -p .cursor\n"));
        throw new Error('No supported editor detected and no --tools flag provided. Use --tools all, --tools none, or a comma-separated list: claude, opencode, cline, cursor, pi, omp (oh-my-pi aliases omp).');
    }
    // --agents with no agent-capable editor in the selection: informational
    // no-op (agents are claude-scoped), the run itself still succeeds.
    const claudeSelected = editors.some((a) => a.id === "claude");
    if (options.agents && !claudeSelected) {
        console.log(chalk.gray("  - No agent-capable editor (claude) selected — vendored agents skipped"));
    }
    // 3a. Deselect = remove. Interactive deselections are real removals of
    // openspec-pw products (commands, MCP entries, claude wrapper/legacy
    // skill, vendored agents, and the shared AGENTS.md block when no editor
    // remains), gated on one confirm. Refusal falls back to the old "skip,
    // don't touch" semantics.
    const confirmPrompt = deps.confirm ??
        (async (message) => {
            const { confirm: promptConfirm } = await import("@inquirer/prompts");
            // default: false is load-bearing — both confirms (removal, agents)
            // must default to No.
            return promptConfirm({ message, default: false });
        });
    if (interactiveSelection && selectedIds !== null) {
        // Removal candidates share the configured manifest: never-configured
        // editors own no products, so there is nothing to enumerate (and no
        // confirm noise for a merely-detected editor that was never set up).
        const deselected = detected
            .filter((a) => !selectedIds.includes(a.id) && configuredIds.has(a.id));
        const inventories = deselected
            .map((adapter) => ({
            adapter,
            inv: enumerateAdapterArtifacts(adapter, projectRoot),
        }))
            // Editors with nothing to remove are silent — no confirm-list noise.
            .filter(({ inv }) => !isInventoryEmpty(inv));
        // Run-level shared block: the AGENTS.md openspec-pw block serves every
        // configured editor, so it only goes when none remain. It joins the
        // same confirmation list as a per-editor item (otherwise a project
        // whose per-editor artifacts were hand-deleted would remove the shared
        // block without ever asking).
        const agentsHasBlock = selectedIds.length === 0 && agentsFileHasMarkers(projectRoot);
        if (inventories.length > 0 || agentsHasBlock) {
            console.log(chalk.blue("\n─── Removing Deselected Editors ───"));
            console.log(chalk.yellow("  The following openspec-pw artifacts will be removed:"));
            for (const { adapter, inv } of inventories) {
                for (const relPath of inv.commandPaths) {
                    console.log(chalk.gray(`    - ${adapter.label}: ${relPath}`));
                }
                if (inv.legacySkillPath) {
                    console.log(chalk.gray(`    - ${adapter.label}: ${inv.legacySkillPath}/`));
                }
                for (const server of inv.mcpServers) {
                    console.log(chalk.gray(`    - ${adapter.label}: ${server} MCP entry`));
                }
                if (inv.hasClaudeWrapper) {
                    console.log(chalk.gray(`    - ${adapter.label}: CLAUDE.md wrapper block`));
                }
                // Consent-gated optional artifacts (vendored agents): only the
                // tool-owned files join the list — user-modified files are kept.
                if (adapter.optionalArtifacts) {
                    for (const relPath of enumerateVendoredAgents(projectRoot, installedAgentsSnapshotDir()).owned) {
                        console.log(chalk.gray(`    - ${adapter.label}: ${relPath}`));
                    }
                }
            }
            if (agentsHasBlock) {
                console.log(chalk.gray("    - AGENTS.md: shared openspec-pw block"));
            }
            const agreed = await confirmPrompt("Proceed with removal?");
            if (!agreed) {
                console.log(chalk.gray("  - Removal declined — keeping existing artifacts (deselect only skips writes this run)"));
            }
            else {
                for (const { adapter, inv } of inventories) {
                    removeAdapterMcp(adapter, projectRoot, inv.mcpServers);
                    removeAdapterCommandArtifacts(adapter, projectRoot);
                    removeOwnedVendoredAgents(projectRoot, adapter);
                    if (inv.legacySkillPath) {
                        removeClaudeLegacySkill(projectRoot);
                    }
                    if (inv.hasClaudeWrapper) {
                        removeClaudeWrapper(projectRoot);
                    }
                }
                if (agentsHasBlock) {
                    removeMarkersFromFile(join(projectRoot, "AGENTS.md"), "AGENTS.md");
                    console.log(chalk.green("  ✓ AGENTS.md: shared openspec-pw block removed"));
                }
            }
        }
    }
    // 3b. Init mode: explicit flag wins, otherwise the frontend signal
    // decides (false and null both → minimal). Reused by every phase gate
    // (MCP, agents, scaffold, Summary) below.
    const frontendSignal = hasFrontendSignal(projectRoot);
    const mode = resolveInitMode(options, frontendSignal);
    if (frontendSignal === null) {
        // Detection fact only — the mode decision is printed in the Summary
        // (an explicit --frontend keeps frontend mode despite the unreadable
        // package.json, so this line must not claim a mode).
        console.log(chalk.gray("  - No readable package.json detected — frontend signal undetectable"));
    }
    // 4. Install the Playwright test-runner MCP for each selected editor —
    // only in frontend mode (minimal-mode projects test with their own stack;
    // --mcp=false still overrides). Single project-scoped server, matching the
    // official `playwright init-agents` layout: `playwright-test`
    // (npx playwright run-test-mcp-server) is a superset — it exposes both
    // browser_* tools and the test_run/test_debug/test_list workflow tools.
    if (options.mcp !== false && editors.length > 0 && mode === "frontend") {
        console.log(chalk.blue("\n─── Installing Playwright MCP ───"));
        for (const adapter of editors) {
            if (isTestRunnerMcpInstalled(adapter)) {
                console.log(chalk.green(`  ✓ ${adapter.label}: Test-runner MCP already installed`));
                continue;
            }
            try {
                ensureTestRunnerMcp(adapter);
                if (adapter.supportsMcp !== false) {
                    console.log(chalk.gray(`  (Restart ${adapter.label} to activate)`));
                }
            }
            catch (err) {
                const e = err;
                if (e.stderr?.includes("already exists")) {
                    console.log(chalk.green(`  ✓ ${adapter.label}: Test-runner MCP already installed`));
                }
                else {
                    console.log(chalk.yellow(`  ⚠ ${adapter.label}: failed to install Test-runner MCP. Run manually.`));
                    console.log(chalk.gray(`    Add "${TEST_RUNNER_MCP_SERVER}" (npx playwright run-test-mcp-server) to the editor's mcpServers config`));
                    if (adapter.id === "claude") {
                        console.log(chalk.gray("    claude mcp add --scope project playwright-test npx playwright run-test-mcp-server"));
                        if (e.stderr?.includes("--scope")) {
                            console.log(chalk.gray("    (Your claude CLI rejects --scope — update Claude Code, or install without --scope manually)"));
                        }
                    }
                    console.log(chalk.gray(`    (Restart ${adapter.label} to activate the MCP server)`));
                }
            }
        }
        // Naming provenance: search results for "Playwright MCP" surface the
        // separate @playwright/mcp package (server name "playwright"); ours is
        // the official init-agents name for the test-runner superset.
        console.log(chalk.gray("  (server name \"playwright-test\" = the official `playwright init-agents` name; superset of @playwright/mcp — see README)"));
    }
    else if (options.mcp !== false && editors.length > 0) {
        // Reaching here guarantees mode !== "frontend" (the if above consumed it).
        console.log(chalk.gray("  - Minimal mode — skipping Playwright MCP (backend projects test with their own stack)"));
    }
    // 4b. Vendored official Playwright agents (claude only, opt-in). Every
    // tool the agents reference lives on the playwright-test MCP server, so
    // the phase follows the same frontend-mode gate as the MCP install.
    const claudeEditor = editors.find((a) => a.id === "claude");
    if (claudeEditor && mode === "frontend") {
        let agentsConsent = options.agents === true;
        if (!agentsConsent && interactiveSelection) {
            agentsConsent = await confirmPrompt("Install the official Playwright agents (planner/generator/healer) into .claude/agents/?");
        }
        if (agentsConsent) {
            console.log(chalk.blue("\n─── Installing Vendored Agents ───"));
            installOptionalArtifacts(claudeEditor, projectRoot, true);
        }
        else if (interactiveSelection) {
            console.log(chalk.gray("  - Agents skipped (opt in later with: openspec-pw init --tools claude --agents)"));
        }
    }
    else if (claudeEditor && options.agents === true) {
        console.log(chalk.gray("  - Minimal mode — skipping vendored agents (their tools depend on the Playwright MCP)"));
    }
    // 5. Install E2E command for each selected editor (frontend mode only —
    // the command drives the Playwright E2E workflow, which minimal-mode
    // projects don't run).
    if (editors.length > 0 && mode === "frontend") {
        console.log(chalk.blue("\n─── Installing E2E Commands ───"));
        const body = await readFile(E2E_COMMAND_SRC, "utf-8");
        const meta = buildCommandMeta(body);
        for (const adapter of editors) {
            installCommand(adapter, meta, projectRoot);
        }
    }
    else if (editors.length > 0) {
        console.log(chalk.gray("  - Minimal mode — skipping E2E command (it drives the Playwright workflow)"));
    }
    if (mode !== "frontend") {
        // Minimal mode: the only scaffold is tests/README.md. Employee
        // standards install in step 8 below (editor-driven), everything else
        // Playwright-specific is skipped.
        console.log(chalk.blue("\n─── Generating Minimal Scaffold ───"));
        await generateTestsReadme(projectRoot);
    }
    else {
        // Frontend mode: a tool-owned tests/README.md from a previous
        // minimal-mode run is an outdated marker — prune it (ownership-aware).
        console.log(chalk.blue("\n─── Generating Seed Test ───"));
        await pruneMinimalModeReadme(projectRoot);
        await generateSeedTest(projectRoot);
        // 6b. Generate shared pages directory
        console.log(chalk.blue("\n─── Generating Shared Pages ───"));
        await generateSharedPages(projectRoot);
        await generateTestPlanTemplate(projectRoot);
        // 6c. Generate playwright.config.ts
        console.log(chalk.blue("\n─── Generating Playwright Config ───"));
        await generatePlaywrightConfig(projectRoot);
        // 7. Generate app-knowledge.md
        console.log(chalk.blue("\n─── Generating App Knowledge ───"));
        await generateAppKnowledge(projectRoot);
    }
    // 7a. Advisory: real test credentials must not reach git history.
    // Detection only — the user's .gitignore is shared territory and is
    // never auto-edited. Runs whenever the scaffold completes with the
    // file present (freshly generated or pre-existing); .bak is named
    // too when one exists. Unconditional: it still guards a pre-existing
    // credentials.yaml in a project that later switched to --no-frontend.
    const unignoredCredentials = findUnignoredFiles(projectRoot, CREDENTIALS_RELPATHS);
    if (unignoredCredentials.length > 0) {
        console.log(chalk.yellow(`\n  ⚠ ${credentialsIgnoreHint(unignoredCredentials)}`));
    }
    // 7b. Generate GitHub Actions workflow (if --ci; frontend mode only —
    // the workflow runs Playwright, which minimal-mode projects don't have)
    if (options.ci && mode === "frontend") {
        console.log(chalk.blue("\n─── Generating CI Workflow ───"));
        await generateGithubWorkflow(projectRoot);
    }
    // 8. Install employee-grade standards (AGENTS.md + CLAUDE.md wrapper if Claude)
    if (editors.length > 0) {
        console.log(chalk.blue("\n─── Installing Employee Standards ───"));
        const standards = readEmployeeStandards(EMPLOYEE_STANDARDS_SRC);
        if (standards) {
            // Migrate surviving legacy OPENSPEC blocks first (same ordering rule as
            // syncEmployeeStandards — migration precedes any marker judgment).
            migrateLegacyMarkers(projectRoot, editors.length > 0, editors.some((a) => a.id === "claude"));
            installProjectRules(projectRoot, standards, editors);
        }
    }
    // 9. Summary — mode + basis line first (init-minimal-mode: 判定依据透明化;
    // users should be able to spot a misjudgment and correct with --frontend).
    console.log(chalk.blue("\n─── Summary ───"));
    console.log(chalk.green("  ✓ Setup complete!\n"));
    if (mode === "frontend") {
        const basis = explainFrontendSignal(projectRoot);
        console.log(chalk.green(`  Mode: frontend${basis ? ` (signal: ${basis})` : ""}`));
    }
    else {
        // The minimal-mode reason reflects reality: a signal miss vs an explicit
        // --no-frontend override (the signal may have actually hit).
        const reason = options.frontend === false ? "--no-frontend" : "no frontend signal";
        console.log(chalk.gray(`  Mode: minimal (${reason}) — tests/README.md + employee standards installed`));
    }
    if (mode === "frontend") {
        console.log(chalk.bold("Next steps:"));
        console.log(chalk.gray("  1. Install Playwright browsers: npx playwright install --with-deps"));
        console.log(chalk.gray("  2. Customize tests/playwright/credentials.yaml with your test user"));
        console.log(chalk.gray("  3. Set credentials: export E2E_USERNAME=xxx E2E_PASSWORD=yyy"));
        console.log(chalk.gray("  4. Run auth setup: npx playwright test --project=setup"));
        console.log(chalk.gray("  5. Page objects: extend tests/playwright/pages/BasePage.ts for shared selectors"));
    }
    else {
        console.log(chalk.bold("Next steps:"));
        console.log(chalk.gray("  1. Acceptance tests live in tests/ — see tests/README.md for the contract"));
        console.log(chalk.gray("  2. Added a frontend? Re-run openspec-pw init (or with --frontend) to install the Playwright scaffold"));
    }
    // Optional: CodeGraph hints — suggest `codegraph init` when the CLI is
    // installed but the project is not indexed, or `codegraph sync` +
    // (when the MCP is missing) `codegraph install` to refresh an existing
    // index. Hints only, never setup.
    const cg = detectCodeGraphStatus(projectRoot);
    const hints = codegraphHintLines(cg);
    if (hints.length > 0) {
        console.log(chalk.gray(`  ${mode === "frontend" ? 6 : 3}. ${hints[0]}`));
        for (const line of hints.slice(1)) {
            console.log(chalk.gray(`     ${line}`));
        }
    }
    if (mode === "frontend" && editors.length > 0) {
        for (const adapter of editors) {
            const slashCmd = slashCommandForAdapter(adapter);
            console.log(chalk.gray(`  • In ${adapter.label}, run: ${slashCmd} <change-name>`));
        }
        console.log(chalk.gray("  • Or: openspec-pw doctor to verify setup\n"));
        console.log(chalk.bold(`\n  Restart ${editors.map((a) => a.displayName).join(" + ")} to use the updated commands.`));
    }
    if (mode === "frontend") {
        console.log(chalk.bold("How it works:"));
        console.log(chalk.gray("  /opsx:e2e (Claude), /opsx-e2e (OpenCode/Cline/Cursor/Pi/Oh My Pi) read your OpenSpec specs"));
        console.log(chalk.gray("  and run Playwright E2E tests through a three-agent pipeline:"));
        console.log(chalk.gray("  Planner → Generator → Healer\n"));
    }
}
/**
 * Minimal-mode scaffold: tests/README.md describing the acceptance-test
 * contract (init-minimal-mode). Exists → skip — drift sync belongs to the
 * update phase, ownership pruning to pruneMinimalModeReadme.
 */
export async function generateTestsReadme(projectRoot) {
    const readmeDest = join(projectRoot, "tests", "README.md");
    if (existsSync(readmeDest)) {
        console.log(chalk.gray("  - tests/README.md already exists, skipping"));
        return;
    }
    mkdirSync(join(projectRoot, "tests"), { recursive: true });
    writeFileSync(readmeDest, readFileSync(TESTS_README_SRC));
    console.log(chalk.green("  ✓ Generated: tests/README.md"));
}
/**
 * Frontend-mode counterpart: a tool-owned tests/README.md from a previous
 * minimal-mode run describes the minimal contract and is outdated once the
 * full Playwright scaffold installs. Byte-identical to the template →
 * tool-owned → removed (empty tests/ dir goes too); anything else is
 * user-owned → kept with a notice.
 */
export async function pruneMinimalModeReadme(projectRoot) {
    const readmeDest = join(projectRoot, "tests", "README.md");
    if (!existsSync(readmeDest))
        return;
    const template = readFileSync(TESTS_README_SRC, "utf-8");
    if (normalizeEol(readFileSync(readmeDest, "utf-8")) === normalizeEol(template)) {
        rmSync(readmeDest);
        const testsDir = join(projectRoot, "tests");
        try {
            rmdirSync(testsDir); // only succeeds when empty
        }
        catch {
            // user content in tests/ — leave the directory
        }
        console.log(chalk.green("  ✓ Removed tests/README.md (minimal-mode marker, full scaffold installed)"));
    }
    else {
        console.log(chalk.yellow("  ⚠ tests/README.md differs from the minimal-mode template — left untouched"));
    }
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
/**
 * Copy the special-element test-plan playbook into the user's project as a
 * reference template (app-exploration.md points here). Same lifecycle as
 * BasePage.ts: init creates it once, update refreshes it on drift.
 */
export async function generateTestPlanTemplate(projectRoot) {
    const src = join(TEMPLATE_DIR, "test-plan.md");
    const dest = join(projectRoot, "tests", "playwright", "test-plan.template.md");
    if (existsSync(dest)) {
        console.log(chalk.gray("  - test-plan.template.md already exists, skipping"));
        return;
    }
    if (existsSync(src)) {
        writeFileSync(dest, readFileSync(src));
        console.log(chalk.green("  ✓ Generated: tests/playwright/test-plan.template.md"));
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