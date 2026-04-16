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
import { tmpdir } from "os";
import { promisify } from "util";
import chalk from "chalk";
import * as tar from "tar";
import { installProjectClaudeMd } from "./editors.js";
import { syncMcpTools } from "./mcpSync.js";
import {
  hasClaudeCode,
  installForClaudeCode,
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

  // 1b. Sync local devDependency if present
  const pkgJsonPath = join(projectRoot, "package.json");
  if (existsSync(pkgJsonPath)) {
    let devDepVersion: string | undefined;
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
      devDepVersion = pkg.devDependencies?.["openspec-playwright"];
    } catch {
      // ignore parse errors
    }
    if (devDepVersion) {
      console.log(chalk.blue("─── Syncing devDependency ───"));
      console.log(
        chalk.yellow(
          "  ⚠ openspec-playwright found in devDependencies —",
        ),
      );
      console.log(
        chalk.gray(
          "    Node module resolution will use local version, not global CLI.",
        ),
      );
      console.log(
        chalk.gray(
          "    Syncing local devDependency to latest...",
        ),
      );
      try {
        execSync("npm install -D openspec-playwright@latest", {
          stdio: "inherit",
          cwd: projectRoot,
        });
        console.log(chalk.green("  ✓ devDependency synced to latest"));
      } catch {
        console.log(
          chalk.yellow("  ⚠ Failed to sync devDependency. Run manually:"),
        );
        console.log(
          chalk.gray("    npm install -D openspec-playwright@latest\n"),
        );
      }
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

      // Read SKILL.md body as command content
      const skillSrc = join(tmpDir, ".claude", "skills", "openspec-e2e", "SKILL.md");
      let body = "";
      if (existsSync(skillSrc)) {
        const skillContent = readFileSync(skillSrc, "utf-8");
        body = skillContent.replace(/^---\n[\s\S]*?\n---\n*/, "");
      }

      const hasClaude = hasClaudeCode(projectRoot);
      // Install command and SKILL.md for Claude Code
      if (hasClaude && body) {
        installForClaudeCode(body, projectRoot);
      } else if (!hasClaude) {
        console.log(chalk.gray("  - .claude not found, skipping command installation"));
      }

      // Install SKILL.md for Claude Code (only if .claude exists)
      if (hasClaude && existsSync(skillSrc)) {
        const skillContent = readFileSync(skillSrc, "utf-8");
        installSkill(projectRoot, skillContent);
      }

      // Sync SKILL reference templates
      syncSkillTemplates(tmpDir, projectRoot);

      // Sync project templates (BasePage.ts, seed.spec.ts)
      syncProjectTemplates(tmpDir, projectRoot);

      // Update employee-grade standards in project CLAUDE.md
      const standardsSrc = join(tmpDir, "employee-standards.md");
      if (existsSync(standardsSrc)) {
        const standards = readFileSync(standardsSrc, "utf-8");
        installProjectClaudeMd(projectRoot, standards);
      }

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

    // Use `claude mcp list` as source of truth (platform-independent)
    let mcpInstalled = false;
    try {
      const output = execSync("claude mcp list", {
        encoding: "utf-8",
        timeout: 10000,
      });
      if (output.includes("playwright")) {
        mcpInstalled = true;
      }
    } catch {
      // claude CLI not available — will try to install
    }

    if (mcpInstalled) {
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

// Sync SKILL reference templates from extracted tarball to project
export function syncSkillTemplates(tmpDir: string, projectRoot: string) {
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
      const existing = existsSync(dest) ? readFileSync(dest, "utf-8") : "";
      const latest = readFileSync(src, "utf-8");
      if (existing !== latest) {
        writeFileSync(dest, latest);
        console.log(chalk.green(`  ✓ Updated: ${file}`));
      }
    }
  }
}

// Sync project-level templates that SKILL.md depends on
function syncProjectTemplates(tmpDir: string, projectRoot: string) {
  const testsDir = join(projectRoot, "tests", "playwright");
  if (!existsSync(testsDir)) return;

  // 1. Sync BasePage.ts — always update if content differs
  const basePageSrc = join(tmpDir, "templates", "pages", "BasePage.ts");
  const basePageDest = join(testsDir, "pages", "BasePage.ts");

  if (existsSync(basePageSrc)) {
    if (!existsSync(basePageDest)) {
      mkdirSync(join(testsDir, "pages"), { recursive: true });
      writeFileSync(basePageDest, readFileSync(basePageSrc));
      console.log(
        chalk.green("  ✓ Generated: tests/playwright/pages/BasePage.ts"),
      );
    } else {
      const existing = readFileSync(basePageDest, "utf-8");
      const latest = readFileSync(basePageSrc, "utf-8");
      if (existing !== latest) {
        writeFileSync(basePageDest, latest);
        console.log(
          chalk.green("  ✓ Updated: tests/playwright/pages/BasePage.ts"),
        );
      }
    }
  }

  // 2. Sync app-knowledge.md — generate if missing
  const appKnowledgeSrc = join(tmpDir, "templates", "app-knowledge.md");
  const appKnowledgeDest = join(testsDir, "app-knowledge.md");

  if (existsSync(appKnowledgeSrc) && !existsSync(appKnowledgeDest)) {
    writeFileSync(appKnowledgeDest, readFileSync(appKnowledgeSrc));
    console.log(
      chalk.green("  ✓ Generated: tests/playwright/app-knowledge.md"),
    );
  }

  // 3. Sync seed.spec.ts — warn if content differs (may have user customizations)
  const seedSrc = join(tmpDir, "templates", "seed.spec.ts");
  const seedDest = join(testsDir, "seed.spec.ts");

  if (existsSync(seedSrc) && existsSync(seedDest)) {
    const existing = readFileSync(seedDest, "utf-8");
    const latest = readFileSync(seedSrc, "utf-8");
    if (existing !== latest) {
      console.log(
        chalk.yellow(
          "  ⚠ tests/playwright/seed.spec.ts differs from latest template",
        ),
      );
      console.log(
        chalk.gray(
          "    Run 'openspec-pw init --seed' to regenerate (overwrites existing).",
        ),
      );
    }
  }

  // 4. Sync credentials.yaml — preserve user credentials
  syncCredentials(tmpDir, projectRoot);
}

/**
 * Sync credentials.yaml — update template structure while preserving user data.
 * Extracts api + users array from existing file, injects into latest template.
 * Falls back to warning if template structure changed significantly.
 */
export function syncCredentials(tmpDir: string, projectRoot: string) {
  const credsSrc = join(tmpDir, "templates", "credentials.yaml");
  const credsDest = join(projectRoot, "tests", "playwright", "credentials.yaml");

  if (!existsSync(credsSrc)) return;

  const latest = readFileSync(credsSrc, "utf-8");

  if (!existsSync(credsDest)) {
    mkdirSync(join(projectRoot, "tests", "playwright"), { recursive: true });
    writeFileSync(credsDest, latest);
    console.log(
      chalk.green("  ✓ Generated: tests/playwright/credentials.yaml"),
    );
    return;
  }

  const existing = readFileSync(credsDest, "utf-8");
  if (existing === latest) return;

  // Backup existing credentials
  const backupDest = credsDest + ".bak";
  writeFileSync(backupDest, existing);
  console.log(chalk.gray(`  - Backed up: tests/playwright/credentials.yaml → credentials.yaml.bak`));

  // Extract user data from existing file
  const users: Array<{ name: string; username: string; password: string }> = [];
  // Match user entries directly without block matching (more robust)
  const regex = /^  - name:\s*(\S+)\n    username:\s*(.+?)\n    password:\s*(.+?)(?:\n|$)/gm;
  let match;
  while ((match = regex.exec(existing)) !== null) {
    users.push({
      name: match[1],
      username: match[2].trim(),
      password: match[3].trim(),
    });
  }

  // Extract api field from existing
  const apiMatch = existing.match(/^api:\s*(.+?)(?:\n|$)/m);
  const apiValue = apiMatch ? apiMatch[1].trim() : "";

  // Build updated template with preserved user data
  let updated = latest;
  if (users.length > 0) {
    const userLines = users
      .map(
        (u) =>
          `  - name: ${u.name}\n    username: ${u.username}\n    password: ${u.password}`,
      )
      .join("\n\n");

    // Replace the users section in template
    updated = updated.replace(
      /^users:\s*\n(\s*- name:[\s\S]*?)(\n\s*#|\n\s*# Multi-user)/m,
      `users:\n${userLines}\n$2`,
    );
  }

  if (apiValue && !apiValue.includes("CHANGE_ME")) {
    updated = updated.replace(/^api:\s*.*$/m, `api: ${apiValue}`);
  }

  writeFileSync(credsDest, updated);
  console.log(
    chalk.green("  ✓ Updated: tests/playwright/credentials.yaml (preserved user data)"),
  );
}

