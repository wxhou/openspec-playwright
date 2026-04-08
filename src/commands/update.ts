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

      // Read SKILL.md body as command content
      const skillSrc = join(tmpDir, ".claude", "skills", "openspec-e2e", "SKILL.md");
      let body = "";
      if (existsSync(skillSrc)) {
        const skillContent = readFileSync(skillSrc, "utf-8");
        body = skillContent.replace(/^---\n[\s\S]*?\n---\n*/, "");
      }

      const hasClaude = existsSync(join(projectRoot, ".claude"));
      // Install commands for all detected editors (only if .claude exists)
      const adapters = detectEditors(projectRoot);
      if (adapters.length > 0 && body && hasClaude) {
        installForAllEditors(body, adapters, projectRoot);
      } else if (adapters.length === 0 && body && hasClaude) {
        console.log(chalk.gray("  - No editors detected, skipping command installation"));
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
function syncCredentials(tmpDir: string, projectRoot: string) {
  const credsSrc = join(tmpDir, "templates", "credentials.yaml");
  const credsDest = join(projectRoot, "tests", "playwright", "credentials.yaml");

  if (!existsSync(credsSrc)) return;

  const latest = readFileSync(credsSrc, "utf-8");

  if (!existsSync(credsDest)) {
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
  const userBlockMatch = existing.match(/^users:\s*\n([\s\S]*?)(?=\n\w|\n$)/m);
  if (userBlockMatch) {
    const userEntries = userBlockMatch[1].match(/^\s+- name:\s*(\S+)[\s\S]*?username:\s*(.+?)[\s\S]*?password:\s*(.+?)(?:\n|$)/gm);
    if (userEntries) {
      for (const entry of userEntries) {
        const nameMatch = entry.match(/^- name:\s*(\S+)/);
        const userMatch = entry.match(/username:\s*(.+?)[\n#]/);
        const passMatch = entry.match(/password:\s*(.+?)(?:\n|$)/);
        if (nameMatch && userMatch && passMatch) {
          users.push({
            name: nameMatch[1],
            username: userMatch[1].trim(),
            password: passMatch[1].trim(),
          });
        }
      }
    }
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

