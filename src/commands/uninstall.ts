import {
  existsSync,
  rmSync,
  readdirSync,
  rmdirSync,
} from "fs";
import { join, dirname } from "path";
import chalk from "chalk";
import {
  buildCommandMeta,
  cleanProjectRules,
  claudeAdapter,
  detectAdapters,
  listCommandArtifactPaths,
} from "./editors.js";
import {
  removePlaywrightMcp,
  removeTestRunnerMcp,
  detectCodeGraphStatus,
} from "../shared/index.js";

export async function uninstall() {
  console.log(chalk.blue("\n🗑️  Uninstalling OpenSpec + Playwright E2E\n"));

  const projectRoot = process.cwd();
  const detected = detectAdapters(projectRoot);
  // Body unused — only need paths from commandFilePath / extraArtifacts
  const meta = buildCommandMeta("");

  // 1. Remove Playwright MCP servers for each detected editor — both the
  // browser-control server and the official test-runner server.
  console.log(chalk.blue("\n─── Removing Playwright MCP ───"));
  for (const adapter of detected) {
    removePlaywrightMcp(adapter);
    removeTestRunnerMcp(adapter);
  }

  // 2. Remove E2E command (+ extraArtifacts) for each detected editor
  console.log(chalk.blue("\n─── Removing E2E Commands ───"));
  for (const adapter of detected) {
    const relPaths = listCommandArtifactPaths(adapter, meta);
    let removedAny = false;
    for (const relPath of relPaths) {
      const absPath = join(projectRoot, relPath);
      if (existsSync(absPath)) {
        rmSync(absPath);
        cleanupEmptyDirs(dirname(absPath), projectRoot);
        console.log(chalk.green(`  ✓ ${adapter.label}: ${relPath}`));
        removedAny = true;
      }
    }
    if (!removedAny) {
      console.log(
        chalk.gray(`  - ${adapter.label}: E2E command not found, skipping`),
      );
    }
  }

  // 3. Remove legacy skill directory (if present from older versions)
  console.log(chalk.blue("\n─── Removing Legacy Skill ───"));
  const skillDir = join(projectRoot, ".claude", "skills", "openspec-e2e");
  if (existsSync(skillDir)) {
    rmSync(skillDir, { recursive: true, force: true });
    console.log(chalk.green("  ✓ Removed .claude/skills/openspec-e2e/"));
  } else {
    console.log(chalk.gray("  - Legacy skill directory not found, skipping"));
  }

  // 3b. Remove the retired dsh skill. The dsh adapter no longer exists, so
  // the detected-adapters loop above never sees these files — clean the
  // precise path openspec-pw owned under .dsh (opsx-e2e was its only command;
  // no glob, to never touch user-authored skills). When the adapter comes
  // back (once official OpenSpec supports dsh), this section is redundant
  // and should be removed with it.
  console.log(chalk.blue("\n─── Removing Retired dsh Skill ───"));
  const dshSkillDir = join(projectRoot, ".dsh", "skills", "opsx-e2e");
  if (existsSync(dshSkillDir)) {
    rmSync(dshSkillDir, { recursive: true, force: true });
    cleanupEmptyDirs(dirname(dshSkillDir), projectRoot);
    console.log(chalk.green("  ✓ Removed .dsh/skills/opsx-e2e/"));
    // A dsh-only project's AGENTS.md block would otherwise survive: with no
    // detected editor the rules-cleaning loop above is skipped entirely.
    // For mixed projects the loop already cleaned it — only call when the
    // loop had nothing to iterate (dsh-only), so logs stay noise-free.
    if (detected.length === 0) {
      cleanProjectRules(claudeAdapter, projectRoot);
    }
  } else {
    console.log(chalk.gray("  - Retired dsh skill not found, skipping"));
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

  // 5. Clean rules file markers for each detected editor
  console.log(chalk.blue("\n─── Cleaning Rules Files ───"));
  for (const adapter of detected) {
    cleanProjectRules(adapter, projectRoot);
  }

  // Summary
  console.log(chalk.blue("\n─── Summary ───"));
  console.log(chalk.green("  ✓ Uninstall complete!\n"));
  console.log(
    chalk.gray("  Note: Run openspec-pw doctor to verify clean removal.\n"),
  );

  // CodeGraph MCP is a codegraph-owned asset — never touch it here, only
  // point the user at the removal command.
  const cg = detectCodeGraphStatus(projectRoot);
  if (cg.mcpInstalledAdapters.length > 0) {
    console.log(
      chalk.gray(
        "  Note: codegraph MCP remains in your agents — remove with: codegraph uninstall",
      ),
    );
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
