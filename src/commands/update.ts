import { execSync, exec } from "child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readdirSync,
  statSync,
} from "fs";
import { join } from "path";
import { tmpdir, homedir } from "os";
import { promisify } from "util";
import chalk from "chalk";
import * as tar from "tar";
import { syncMcpTools } from "./mcpSync.js";
import {
  detectEditors,
  installForAllEditors,
  installSkill,
} from "./editors.js";

export interface UpdateOptions {
  cli?: boolean;
  skill?: boolean;
  mcp?: boolean;
}

export async function update(options: UpdateOptions) {
  console.log(chalk.blue("\n🔄 Updating OpenSpec + Playwright E2E\n"));

  const projectRoot = process.cwd();

  // Check if init has been run
  const hasSkill = existsSync(
    join(projectRoot, ".claude", "skills", "openspec-e2e", "SKILL.md"),
  );
  const hasOpenSpec = existsSync(join(projectRoot, "openspec"));
  if (!hasSkill && !hasOpenSpec) {
    console.log(chalk.yellow("  ⚠ OpenSpec + Playwright E2E not initialized."));
    console.log(
      chalk.gray('  Run "openspec-pw init" first to set up the integration.\n'),
    );
    return;
  }

  // 1. Update CLI tool from npm
  if (options.cli !== false) {
    console.log(chalk.blue("─── Updating CLI ───"));
    try {
      execSync("npm install -g openspec-playwright", {
        stdio: "inherit",
        cwd: projectRoot,
      });
      console.log(chalk.green("  ✓ CLI updated via npm"));
    } catch {
      console.log(chalk.yellow("  ⚠ Failed to update CLI via npm"));
      console.log(
        chalk.gray("  Run manually: npm install -g openspec-playwright"),
      );
    }
  }

  // 2. Update commands for all detected editors
  if (options.skill !== false) {
    console.log(chalk.blue("\n─── Updating Commands & Skill ───"));
    try {
      const tmpDir = join(tmpdir(), "openspec-e2e-update");
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });

      const execAsync = promisify(exec);
      await execAsync(
        `npm pack openspec-playwright --pack-destination ${tmpDir}`,
        { timeout: 30000 },
      );

      // Find the latest tarball by mtime
      const tgzFiles = readdirSync(tmpDir)
        .filter(
          (f) => f.startsWith("openspec-playwright-") && f.endsWith(".tgz"),
        )
        .map((f) => ({ name: f, mtime: statSync(join(tmpDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      if (tgzFiles.length === 0) throw new Error("No tarball found");
      const tarballPath = join(tmpDir, tgzFiles[0].name);

      // Extract tarball
      await tar.extract({ file: tarballPath, cwd: tmpDir, strip: 1 });

      const bodySrc = join(
        tmpDir,
        ".claude",
        "commands",
        "opsx",
        "e2e-body.md",
      );

      // Install commands for all detected editors
      const adapters = detectEditors(projectRoot);
      if (adapters.length > 0 && existsSync(bodySrc)) {
        const body = readFileSync(bodySrc, "utf-8");
        installForAllEditors(body, adapters, projectRoot);
      }

      // Install SKILL.md for Claude Code
      const skillSrc = join(
        tmpDir,
        ".claude",
        "skills",
        "openspec-e2e",
        "SKILL.md",
      );
      if (existsSync(join(projectRoot, ".claude")) && existsSync(skillSrc)) {
        const skillContent = readFileSync(skillSrc, "utf-8");
        installSkill(projectRoot, skillContent);
      }

      // Clean up deprecated schema installed by pre-v0.1.71 versions
      cleanupDeprecatedSchema(projectRoot);

      // Sync SKILL reference templates
      syncSkillTemplates(tmpDir, projectRoot);

      // Sync project templates (BasePage.ts, seed.spec.ts)
      syncProjectTemplates(tmpDir, projectRoot);

      rmSync(tmpDir, { recursive: true, force: true });
      console.log(chalk.green("  ✓ Commands, skill & templates updated to latest"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.yellow(`  ⚠ Failed to update from npm: ${msg}`));
      console.log(chalk.gray("  Trying npm install to pull latest version..."));
      try {
        execSync("npm install -g openspec-playwright", {
          stdio: "inherit",
          cwd: projectRoot,
        });
        console.log(chalk.green("  ✓ Updated via npm install"));
      } catch {
        console.log(chalk.red("  ✗ Failed to update. Run manually:"));
        console.log(chalk.gray("    npm install -g openspec-playwright"));
      }
    }
  }

  // 2b. Install Playwright MCP if not present (Claude Code only)
  if (options.mcp !== false && existsSync(join(projectRoot, ".claude"))) {
    console.log(chalk.blue("\n─── Installing Playwright MCP ───"));
    const claudeJsonPath = join(homedir(), ".claude.json");
    const claudeJson = existsSync(claudeJsonPath)
      ? JSON.parse(readFileSync(claudeJsonPath, "utf-8"))
      : {};
    const globalMcp = claudeJson?.mcpServers ?? {};
    const localMcp = claudeJson?.projects?.[projectRoot]?.mcpServers ?? {};

    if (globalMcp["playwright"] || localMcp["playwright"]) {
      console.log(chalk.green("  ✓ Playwright MCP already installed"));
    } else {
      try {
        execSync("claude mcp add playwright npx @playwright/mcp@latest", {
          cwd: projectRoot,
          stdio: "inherit",
        });
        console.log(chalk.green("  ✓ Playwright MCP installed globally"));
        console.log(chalk.gray("  (Restart Claude Code to activate)"));
      } catch {
        console.log(chalk.yellow("  ⚠ Failed to install Playwright MCP"));
        console.log(
          chalk.gray(
            "  Run manually: claude mcp add playwright npx @playwright/mcp@latest",
          ),
        );
        console.log(
          chalk.gray("  (Restart Claude Code to activate the MCP server)"),
        );
      }
    }
  }

  // 3. Sync Healer tools (Claude Code only)
  if (
    existsSync(
      join(projectRoot, ".claude", "skills", "openspec-e2e", "SKILL.md"),
    )
  ) {
    console.log(chalk.blue("\n─── Syncing Healer Tools ───"));
    const skillDest = join(
      projectRoot,
      ".claude",
      "skills",
      "openspec-e2e",
      "SKILL.md",
    );
    await syncMcpTools(skillDest, true);
  }

  // Summary
  console.log(chalk.blue("\n─── Summary ───"));
  console.log(chalk.green("  ✓ Update complete!\n"));

  if (existsSync(join(projectRoot, ".claude"))) {
    console.log(chalk.bold("Restart Claude Code to use the updated skill."));
    console.log(chalk.gray("  Then run /opsx:e2e <change-name> to verify.\n"));
  } else {
    console.log(
      chalk.bold(
        "Restart your AI coding assistant to use the updated commands.",
      ),
    );
    console.log(
      chalk.gray("  Then run openspec-pw run <change-name> to verify.\n"),
    );
  }
}

// Clean up deprecated openspec/schemas/playwright-e2e/ from pre-v0.1.71 versions
function cleanupDeprecatedSchema(projectRoot: string) {
  const deprecatedSchemaPath = join(
    projectRoot,
    "openspec",
    "schemas",
    "playwright-e2e",
  );
  if (existsSync(deprecatedSchemaPath)) {
    rmSync(deprecatedSchemaPath, { recursive: true, force: true });
    console.log(
      chalk.green(
        "  ✓ Cleaned up deprecated openspec/schemas/playwright-e2e/ (v0.1.71 refactor — no longer needed)",
      ),
    );
  }
}

// Sync SKILL reference templates from extracted tarball to project
function syncSkillTemplates(tmpDir: string, projectRoot: string) {
  if (!existsSync(join(projectRoot, ".claude"))) return;

  const SKILL_DIR = join(
    projectRoot,
    ".claude",
    "skills",
    "openspec-e2e",
  );
  const templatesDir = join(SKILL_DIR, "templates");
  mkdirSync(templatesDir, { recursive: true });

  const SKILL_TEMPLATE_FILES = [
    "app-exploration.md",
    "test-plan.md",
    "playwright.config.ts",
    "report.md",
    "e2e-test.ts",
  ];

  for (const file of SKILL_TEMPLATE_FILES) {
    const src = join(tmpDir, "templates", file);
    const dest = join(templatesDir, file);
    if (existsSync(src)) {
      writeFileSync(dest, readFileSync(src));
    }
  }

  // Sync project-level templates (BasePage.ts)
  syncProjectTemplates(tmpDir, projectRoot);
}

// Sync project-level templates that SKILL.md depends on
function syncProjectTemplates(tmpDir: string, projectRoot: string) {
  const testsDir = join(projectRoot, "tests", "playwright");
  if (!existsSync(testsDir)) return;

  // 1. Sync BasePage.ts — SKILL.md references fillAndVerify(), byTestId(), etc.
  const basePageSrc = join(tmpDir, "templates", "pages", "BasePage.ts");
  const basePageDest = join(testsDir, "pages", "BasePage.ts");

  if (existsSync(basePageSrc)) {
    if (!existsSync(basePageDest)) {
      // BasePage.ts missing — create it
      mkdirSync(join(testsDir, "pages"), { recursive: true });
      writeFileSync(basePageDest, readFileSync(basePageSrc));
      console.log(
        chalk.green("  ✓ Generated: tests/playwright/pages/BasePage.ts"),
      );
    } else {
      // BasePage.ts exists — check if it has fillAndVerify (v0.1.75+)
      const existing = readFileSync(basePageDest, "utf-8");
      const latest = readFileSync(basePageSrc, "utf-8");

      const hasFillAndVerify = existing.includes("fillAndVerify");
      const latestHasFillAndVerify = latest.includes("fillAndVerify");

      if (!hasFillAndVerify && latestHasFillAndVerify) {
        // Old version detected — update it
        writeFileSync(basePageDest, latest);
        console.log(
          chalk.green(
            "  ✓ Updated: tests/playwright/pages/BasePage.ts (v0.1.75+ with fillAndVerify)",
          ),
        );
      }
    }
  }

  // 2. Sync seed.spec.ts — only if it matches the template (user hasn't customized)
  const seedSrc = join(tmpDir, "templates", "seed.spec.ts");
  const seedDest = join(testsDir, "seed.spec.ts");

  if (existsSync(seedSrc) && existsSync(seedDest)) {
    const existing = readFileSync(seedDest, "utf-8");
    const latest = readFileSync(seedSrc, "utf-8");

    // Check if seed.spec.ts references fillAndVerify (v0.1.75+)
    const hasFillAndVerify = existing.includes("fillAndVerify");
    const latestHasFillAndVerify = latest.includes("fillAndVerify");

    if (!hasFillAndVerify && latestHasFillAndVerify) {
      // Old version — prompt user (seed.spec.ts may have custom tests)
      console.log(
        chalk.yellow(
          "  ⚠ tests/playwright/seed.spec.ts is outdated (missing fillAndVerify examples)",
        ),
      );
      console.log(
        chalk.gray(
          "    The SKILL references fillAndVerify() in examples. Your seed.spec.ts may be outdated.",
        ),
      );
      console.log(
        chalk.gray(
          "    To update: backup your customizations, then run 'openspec-pw init --seed' to regenerate.",
        ),
      );
    }
  }
}
