import {
  existsSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  rmdirSync,
} from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import { getClaudeCommandPath } from "./editors.js";

export async function uninstall() {
  console.log(chalk.blue("\n🗑️  Uninstalling OpenSpec + Playwright E2E\n"));

  const projectRoot = process.cwd();

  // 1. Remove Playwright MCP using claude CLI
  console.log(chalk.blue("─── Removing Playwright MCP ───"));
  removeMcp();

  // 2. Remove E2E command file for Claude Code
  console.log(chalk.blue("\n─── Removing E2E Commands ───"));
  const relPath = getClaudeCommandPath("e2e");
  const absPath = join(projectRoot, relPath);
  if (existsSync(absPath)) {
    rmSync(absPath);
    cleanupEmptyDirs(dirname(absPath), projectRoot);
    console.log(chalk.green(`  ✓ Removed ${relPath}`));
  } else {
    console.log(chalk.gray("  - E2E command not found, skipping"));
  }

  // 3. Remove SKILL.md
  console.log(chalk.blue("\n─── Removing Skill ───"));
  const skillDir = join(projectRoot, ".claude", "skills", "openspec-e2e");
  if (existsSync(skillDir)) {
    rmSync(skillDir, { recursive: true, force: true });
    console.log(chalk.green("  ✓ Removed .claude/skills/openspec-e2e/"));
  } else {
    console.log(chalk.gray("  - Skill not found, skipping"));
  }

  // 4. Remove schema
  console.log(chalk.blue("\n─── Removing Schema ───"));
  const schemaDir = join(projectRoot, "openspec", "schemas", "playwright-e2e");
  if (existsSync(schemaDir)) {
    rmSync(schemaDir, { recursive: true, force: true });
    console.log(chalk.green("  ✓ Removed openspec/schemas/playwright-e2e/"));
  } else {
    console.log(chalk.gray("  - Schema not found, skipping"));
  }

  // 5. Clean CLAUDE.md markers
  console.log(chalk.blue("\n─── Cleaning CLAUDE.md ───"));
  cleanClaudeMd(projectRoot);

  // Summary
  console.log(chalk.blue("\n─── Summary ───"));
  console.log(chalk.green("  ✓ Uninstall complete!\n"));
  console.log(
    chalk.gray("  Note: Run openspec-pw doctor to verify clean removal.\n"),
  );
}

function removeMcp() {
  try {
    execSync("claude mcp remove playwright", {
      encoding: "utf-8",
      stdio: "pipe",
    });
    console.log(chalk.green("  ✓ Removed playwright MCP"));
    console.log(chalk.gray("    Restart Claude Code to complete removal"));
  } catch (err) {
    const e = err as { stderr?: string };
    if (e.stderr?.includes("not found") || e.stderr?.includes("does not exist")) {
      console.log(chalk.gray("  - Playwright MCP not found, skipping"));
    } else {
      console.log(
        chalk.yellow(
          `  ⚠ Failed to remove playwright MCP: ${e.stderr || (err instanceof Error ? err.message : String(err))}`,
        ),
      );
      console.log(
        chalk.gray("    Run manually: claude mcp remove playwright"),
      );
    }
  }
}

function cleanupEmptyDirs(dir: string, stopAt: string) {
  while (dir !== stopAt && dir.length > stopAt.length) {
    try {
      const entries = readdirSync(dir);
      if (entries.length === 0) {
        rmdirSync(dir);
        dir = dirname(dir);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
}

function cleanClaudeMd(projectRoot: string) {
  const dest = join(projectRoot, "CLAUDE.md");
  if (!existsSync(dest)) {
    console.log(chalk.gray("  - CLAUDE.md not found, skipping"));
    return;
  }

  const existing = readFileSync(dest, "utf-8");
  const markerStart = "<!-- OPENSPEC:START -->";
  const markerEnd = "<!-- OPENSPEC:END -->";

  if (!existing.includes(markerStart)) {
    console.log(chalk.gray("  - No OpenSpec markers found in CLAUDE.md"));
    return;
  }

  const updated =
    existing
      .split("\n")
      .filter(
        (line) =>
          !line.trim().startsWith(markerStart) &&
          !line.trim().startsWith(markerEnd),
      )
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n";

  writeFileSync(dest, updated);
  console.log(chalk.green("  ✓ Removed OpenSpec markers from CLAUDE.md"));
}
