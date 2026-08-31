import { execFileSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { readFile } from "fs/promises";
import {
  buildCommandMeta,
  detectAdapters,
  detectProjectAdapters,
  getAdapter,
  getAllAdapters,
  installCommand,
  installProjectRules,
  migrateLegacyMarkers,
  readEmployeeStandards,
  resolveToolsArg,
  slashCommandForAdapter,
  enumerateAdapterArtifacts,
  isInventoryEmpty,
  removeAdapterMcp,
  removeAdapterCommandArtifacts,
  removeClaudeLegacySkill,
  removeClaudeWrapper,
  removeMarkersFromFile,
} from "./editors.js";
import { LEGACY_OPENSPEC_START, OPENSPEC_START } from "../shared/drift.js";
import type { EditorAdapter, EditorId } from "./editors.js";
import {
  ensureTestRunnerMcp,
  isTestRunnerMcpInstalled,
  TEST_RUNNER_MCP_SERVER,
  needsShell,
  hasFrontendSignal,
  detectCodeGraphStatus,
  codegraphHintLines,
  CREDENTIALS_RELPATHS,
  credentialsIgnoreHint,
  findUnignoredFiles,
} from "../shared/index.js";

const TEMPLATE_DIR = fileURLToPath(new URL("../../templates", import.meta.url));
const E2E_COMMAND_SRC = fileURLToPath(
  new URL("../../templates/e2e-command.md", import.meta.url),
);
const EMPLOYEE_STANDARDS_SRC = fileURLToPath(
  new URL("../../employee-standards.md", import.meta.url),
);

export interface InitOptions {
  change?: string;
  mcp?: boolean;
  ci?: boolean;
  tools?: string;
}

export interface InitDeps {
  /** Interactive selection prompt; defaults to @inquirer/prompts checkbox. */
  prompt?: (
    allEditors: EditorAdapter[],
    detectedIds: ReadonlySet<EditorId>,
  ) => Promise<EditorId[]>;
  /**
   * Confirmation prompt for the deselect-removal list; defaults to
   * @inquirer/prompts confirm. Separate from `prompt` — a checkbox stub
   * cannot answer a boolean question, and without an injection point tests
   * would block on stdin.
   */
  confirm?: (message: string) => Promise<boolean>;
  /** Override TTY detection (tests inject false here). */
  isTTY?: boolean;
  /** Override home dir for Pi/Oh My Pi global detection (tests inject an empty dir). */
  homeDir?: string;
}

/**
 * Interactive multi-select of all supported editors, pre-selecting the
 * editors detected in the project. Dynamically imports @inquirer/prompts so
 * non-interactive runs never load it.
 */
export async function promptSelectEditors(
  allEditors: EditorAdapter[],
  detectedIds: ReadonlySet<EditorId>,
): Promise<EditorId[]> {
  const { checkbox } = await import("@inquirer/prompts");
  const selected = await checkbox({
    message: "Select editors to configure",
    choices: allEditors.map((a) => ({
      name: detectedIds.has(a.id) ? `${a.displayName} (detected)` : a.displayName,
      value: a.id,
      checked: detectedIds.has(a.id),
    })),
  });
  return selected as EditorId[];
}

export async function init(options: InitOptions, deps: InitDeps = {}) {
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
  } catch {
    console.log(chalk.gray("  - OpenSpec not found (run: npm install -g @fission-ai/openspec@latest)"));
  }

  if (!hasNode || !hasNpm) {
    console.log(chalk.red("  ✗ Node.js/npm is required"));
    process.exit(1);
  }
  console.log(chalk.green("  ✓ Node.js and npm found"));

  // 2. Check OpenSpec
  if (!existsSync(join(projectRoot, "openspec"))) {
    console.log(
      chalk.yellow("\n⚠ OpenSpec not initialized. Run these commands first:"),
    );
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
  // Pi/Oh My Pi) — used for display and interactive
  // pre-select only. The non-TTY fallback uses `projectDetected`:
  // global config dirs never authorize editor configuration.
  const detected = detectAdapters(projectRoot, deps.homeDir);
  const projectDetected = detectProjectAdapters(projectRoot);
  // Detected is any-scope detection — its only role is the TTY multi-select
  // pre-select hint. With --tools the user has already expressed intent, so
  // stay silent: the line would be misread as the install set.
  if (options.tools === undefined) {
    console.log(
      detected.length > 0
        ? chalk.gray(
            `  Detected (pre-select): ${detected.map((a) => a.label).join(", ")}`,
          )
        : chalk.gray("  Detected: none"),
    );
  }

  const isTTY = deps.isTTY ?? process.stdout.isTTY === true;
  const prompt = deps.prompt ?? promptSelectEditors;
  let selectedIds: EditorId[] | null;
  // True only when the selection came from the interactive prompt — the
  // deselected-removal phase runs exclusively on that path (--tools is an
  // explicit authorization list; non-TTY never removes).
  let interactiveSelection = false;
  try {
    selectedIds = resolveToolsArg(options.tools);
  } catch (err) {
    throw new Error(`Invalid --tools value: ${(err as Error).message}`);
  }
  if (selectedIds === null && isTTY) {
    interactiveSelection = true;
    selectedIds = await prompt(
      getAllAdapters(),
      new Set(detected.map((a) => a.id)),
    );
  }

  const editors =
    selectedIds === null
      ? projectDetected
      : selectedIds
          .map(getAdapter)
          .filter((a): a is EditorAdapter => a !== undefined);

  // The actual install set — what this run will configure. The Selected
  // editors line is the authoritative signal (mirrors the Summary's
  // Restart list); it prints before any installCommand runs, and before
  // the empty-detection failure below so `none` accompanies the error.
  console.log(
    chalk.gray(
      `  Selected editors: ${editors.map((a) => a.label).join(", ") || "none"}`,
    ),
  );

  // No flag, non-TTY, and nothing detected → fail with --tools guidance.
  if (selectedIds === null && editors.length === 0) {
    console.log(
      chalk.yellow(
        "\n  ⚠ No supported editor detected in the project (need .claude/, .opencode/, .cline/, .cursor/, .pi/, or .omp/).",
      ),
    );
    console.log(
      chalk.gray("  For Cursor without an existing .cursor/ dir: mkdir -p .cursor\n"),
    );
    throw new Error(
      'No supported editor detected and no --tools flag provided. Use --tools all, --tools none, or a comma-separated list: claude, opencode, cline, cursor, pi, omp (oh-my-pi aliases omp).',
    );
  }

  // 3a. Deselect = remove. Interactive deselections are real removals of
  // openspec-pw products (commands, MCP entries, claude wrapper/legacy
  // skill, and the shared AGENTS.md block when no editor remains), gated on
  // one confirm. Refusal falls back to the old "skip, don't touch" semantics.
  if (interactiveSelection && selectedIds !== null) {
    const deselected = detected.filter((a) => !selectedIds!.includes(a.id));
    const inventories = deselected
      .map((adapter) => ({
        adapter,
        inv: enumerateAdapterArtifacts(adapter, projectRoot),
      }))
      // Editors with nothing to remove are silent — no confirm-list noise
      // for a merely-detected-but-never-configured editor.
      .filter(({ inv }) => !isInventoryEmpty(inv));

    // Run-level shared block: the AGENTS.md openspec-pw block serves every
    // configured editor, so it only goes when none remain. It joins the
    // same confirmation list as a per-editor item (otherwise a project
    // whose per-editor artifacts were hand-deleted would remove the shared
    // block without ever asking).
    const agentsPath = join(projectRoot, "AGENTS.md");
    const agentsHasBlock =
      selectedIds.length === 0 &&
      existsSync(agentsPath) &&
      (() => {
        const content = readFileSync(agentsPath, "utf-8");
        return (
          content.includes(OPENSPEC_START) ||
          content.includes(LEGACY_OPENSPEC_START)
        );
      })();

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
      }
      if (agentsHasBlock) {
        console.log(chalk.gray("    - AGENTS.md: shared openspec-pw block"));
      }

      const confirm =
        deps.confirm ??
        (async (message: string) => {
          const { confirm: promptConfirm } = await import("@inquirer/prompts");
          return promptConfirm({ message });
        });
      const agreed = await confirm("Proceed with removal?");

      if (!agreed) {
        console.log(
          chalk.gray("  - Removal declined — keeping existing artifacts (deselect only skips writes this run)"),
        );
      } else {
        for (const { adapter, inv } of inventories) {
          removeAdapterMcp(adapter, projectRoot, inv.mcpServers);
          removeAdapterCommandArtifacts(adapter, projectRoot);
          if (inv.legacySkillPath) {
            removeClaudeLegacySkill(projectRoot);
          }
          if (inv.hasClaudeWrapper) {
            removeClaudeWrapper(projectRoot);
          }
        }
        if (agentsHasBlock) {
          removeMarkersFromFile(agentsPath, "AGENTS.md");
          console.log(chalk.green("  ✓ AGENTS.md: shared openspec-pw block removed"));
        }
      }
    }
  }

  // 3b. Detect a frontend signal — computed once, reused for the MCP
  // install gate (step 4) and the Summary guidance hint.
  const frontendSignal = hasFrontendSignal(projectRoot);

  // 4. Install the Playwright test-runner MCP for each selected editor —
  // only when a frontend signal was detected (API-only projects test via
  // the request fixture and don't need the browser MCP; --mcp=false still
  // overrides). Single project-scoped server, matching the official
  // `playwright init-agents` layout: `playwright-test`
  // (npx playwright run-test-mcp-server) is a superset — it exposes both
  // browser_* tools and the test_run/test_debug/test_list workflow tools.
  if (options.mcp !== false && editors.length > 0 && frontendSignal === true) {
    console.log(chalk.blue("\n─── Installing Playwright MCP ───"));
    for (const adapter of editors) {
      if (isTestRunnerMcpInstalled(adapter)) {
        console.log(
          chalk.green(`  ✓ ${adapter.label}: Test-runner MCP already installed`),
        );
        continue;
      }
      try {
        ensureTestRunnerMcp(adapter);
        if (adapter.supportsMcp !== false) {
          console.log(chalk.gray(`  (Restart ${adapter.label} to activate)`));
        }
      } catch (err) {
        const e = err as { stderr?: string };
        if (e.stderr?.includes("already exists")) {
          console.log(
            chalk.green(`  ✓ ${adapter.label}: Test-runner MCP already installed`),
          );
        } else {
          console.log(
            chalk.yellow(
              `  ⚠ ${adapter.label}: failed to install Test-runner MCP. Run manually.`,
            ),
          );
          console.log(
            chalk.gray(
              `    Add "${TEST_RUNNER_MCP_SERVER}" (npx playwright run-test-mcp-server) to the editor's mcpServers config`,
            ),
          );
          if (adapter.id === "claude") {
            console.log(
              chalk.gray(
                "    claude mcp add --scope project playwright-test npx playwright run-test-mcp-server",
              ),
            );
            if (e.stderr?.includes("--scope")) {
              console.log(
                chalk.gray(
                  "    (Your claude CLI rejects --scope — update Claude Code, or install without --scope manually)",
                ),
              );
            }
          }
          console.log(
            chalk.gray(
              `    (Restart ${adapter.label} to activate the MCP server)`,
            ),
          );
        }
      }
    }
  } else if (options.mcp !== false && editors.length > 0) {
    console.log(
      chalk.gray(
        "  - No frontend signal detected — skipping Playwright MCP (API tests use the request fixture)",
      ),
    );
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

  // 7a. Advisory: real test credentials must not reach git history.
  // Detection only — the user's .gitignore is shared territory and is
  // never auto-edited. Runs whenever the scaffold completes with the
  // file present (freshly generated or pre-existing); .bak is named
  // too when one exists.
  const unignoredCredentials = findUnignoredFiles(
    projectRoot,
    CREDENTIALS_RELPATHS,
  );
  if (unignoredCredentials.length > 0) {
    console.log(
      chalk.yellow(`\n  ⚠ ${credentialsIgnoreHint(unignoredCredentials)}`),
    );
  }

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
      // Migrate surviving legacy OPENSPEC blocks first (same ordering rule as
      // syncEmployeeStandards — migration precedes any marker judgment).
      migrateLegacyMarkers(
        projectRoot,
        editors.length > 0,
        editors.some((a) => a.id === "claude"),
      );
      installProjectRules(projectRoot, standards, editors);
    }
  }

  // 9. Summary
  console.log(chalk.blue("\n─── Summary ───"));
  console.log(chalk.green("  ✓ Setup complete!\n"));

  console.log(chalk.bold("Next steps:"));
  console.log(
    chalk.gray(
      "  1. Install Playwright browsers: npx playwright install --with-deps",
    ),
  );
  console.log(
    chalk.gray(
      "  2. Customize tests/playwright/credentials.yaml with your test user",
    ),
  );
  console.log(
    chalk.gray(
      "  3. Set credentials: export E2E_USERNAME=xxx E2E_PASSWORD=yyy",
    ),
  );
  console.log(
    chalk.gray("  4. Run auth setup: npx playwright test --project=setup"),
  );
  console.log(
    chalk.gray(
      "  5. Page objects: extend tests/playwright/pages/BasePage.ts for shared selectors",
    ),
  );
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
    console.log(
      chalk.gray(
        "  • If your frontend lives in a subdirectory (monorepo): run openspec-pw init in the app directory (one Playwright config per app)",
      ),
    );
    console.log(
      chalk.gray(
        "  • If this is an API-only project: use Playwright's request fixture for API tests and point BASE_URL at the API address",
      ),
    );
  }
  if (editors.length > 0) {
    for (const adapter of editors) {
      const slashCmd = slashCommandForAdapter(adapter);
      console.log(
        chalk.gray(`  • In ${adapter.label}, run: ${slashCmd} <change-name>`),
      );
    }
    console.log(
      chalk.gray("  • Or: openspec-pw doctor to verify setup\n"),
    );

    console.log(
      chalk.bold(
        `\n  Restart ${editors.map((a) => a.displayName).join(" + ")} to use the updated commands.`,
      ),
    );
  }

  console.log(chalk.bold("How it works:"));
  console.log(
    chalk.gray(
      "  /opsx:e2e (Claude), /opsx-e2e (OpenCode/Cline/Cursor/Pi/Oh My Pi) read your OpenSpec specs",
    ),
  );
  console.log(chalk.gray("  and run Playwright E2E tests through a three-agent pipeline:"));
  console.log(chalk.gray("  Planner → Generator → Healer\n"));
}

export async function generateSeedTest(projectRoot: string) {
  const testsDir = join(projectRoot, "tests", "playwright");
  mkdirSync(testsDir, { recursive: true });

  const seedPath = join(testsDir, "seed.spec.ts");
  if (existsSync(seedPath)) {
    console.log(chalk.gray("  - seed.spec.ts already exists, skipping"));
  } else {
    const seedContent = await readFile(TEMPLATE_DIR + "/seed.spec.ts", "utf-8");
    writeFileSync(seedPath, seedContent);
    console.log(chalk.green("  ✓ Generated: tests/playwright/seed.spec.ts"));
  }

  // Generate auth.setup.ts
  const authSetupPath = join(testsDir, "auth.setup.ts");
  if (existsSync(authSetupPath)) {
    console.log(chalk.gray("  - auth.setup.ts already exists, skipping"));
  } else {
    const authContent = await readFile(
      TEMPLATE_DIR + "/auth.setup.ts",
      "utf-8",
    );
    writeFileSync(authSetupPath, authContent);
    console.log(chalk.green("  ✓ Generated: tests/playwright/auth.setup.ts"));
  }

  // Generate credentials.yaml
  const credsPath = join(testsDir, "credentials.yaml");
  if (existsSync(credsPath)) {
    console.log(chalk.gray("  - credentials.yaml already exists, skipping"));
  } else {
    const credsContent = await readFile(
      TEMPLATE_DIR + "/credentials.yaml",
      "utf-8",
    );
    writeFileSync(credsPath, credsContent);
    console.log(
      chalk.green("  ✓ Generated: tests/playwright/credentials.yaml"),
    );
  }

  console.log(
    chalk.gray("  (Customize BASE_URL and credentials for your app)"),
  );
}

export async function generateAppKnowledge(projectRoot: string) {
  const src = join(TEMPLATE_DIR, "app-knowledge.md");
  const dest = join(projectRoot, "tests", "playwright", "app-knowledge.md");

  if (existsSync(dest)) {
    console.log(chalk.gray("  - app-knowledge.md already exists, skipping"));
    return;
  }

  if (existsSync(src)) {
    writeFileSync(dest, readFileSync(src));
    console.log(
      chalk.green("  ✓ Generated: tests/playwright/app-knowledge.md"),
    );
  }
}

export async function generateSharedPages(projectRoot: string) {
  const pagesDir = join(projectRoot, "tests", "playwright", "pages");
  mkdirSync(pagesDir, { recursive: true });

  const basePageSrc = join(TEMPLATE_DIR, "pages", "BasePage.ts");
  const basePageDest = join(pagesDir, "BasePage.ts");
  if (existsSync(basePageDest)) {
    console.log(chalk.gray("  - pages/BasePage.ts already exists, skipping"));
  } else if (existsSync(basePageSrc)) {
    writeFileSync(basePageDest, readFileSync(basePageSrc));
    console.log(
      chalk.green("  ✓ Generated: tests/playwright/pages/BasePage.ts"),
    );
    console.log(
      chalk.gray(
        "  (Extend BasePage to create page objects: pages/LoginPage.ts, etc.)",
      ),
    );
  }
}

export async function generateGithubWorkflow(projectRoot: string) {
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
    console.log(
      chalk.green("  ✓ Generated: .github/workflows/openspec-pw.yml"),
    );
    console.log(
      chalk.gray("  Set E2E_USERNAME, E2E_PASSWORD, BASE_URL secrets in repo settings."),
    );
  } else {
    console.log(chalk.gray("  - CI template not found in package"));
  }
}

export async function generatePlaywrightConfig(projectRoot: string) {
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
  } else {
    console.log(chalk.gray("  - Playwright config template not found in package"));
  }
}

function suggestPlaywrightConfigPatch(configPath: string) {
  const config = readFileSync(configPath, "utf-8");
  const suggestions: string[] = [];

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

  if (suggestions.length === 0) return;

  console.log(chalk.yellow("  ⚠ Existing config was not modified. Recommended checks:"));
  for (const suggestion of suggestions) {
    console.log(chalk.gray(`    - ${suggestion}`));
  }
  console.log(chalk.gray("    Compare with: openspec-pw init in a temporary project, or copy from templates/playwright.config.ts"));
}

function hasCmd(bin: string, args: string[], name: string, silent = false): boolean {
  try {
    execFileSync(bin, args, { stdio: "pipe", shell: needsShell });
    if (!silent) console.log(chalk.green(`  ✓ ${name} found`));
    return true;
  } catch {
    if (!silent) console.log(chalk.yellow(`  ⚠ ${name} not found`));
    return false;
  }
}
