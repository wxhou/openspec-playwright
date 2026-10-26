import { existsSync, readFileSync, rmSync, rmdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { uninstallStopHook } from "./hooks.js";
import {
  buildCommandMeta,
  CLAUDE_LEGACY_SKILL_REL,
  cleanProjectRules,
  claudeAdapter,
  codebuddyAdapter,
  detectAdapters,
  listCommandArtifactPaths,
  removeAdapterCommandArtifacts,
  removeOwnedVendoredAgents,
  hasRuleFileMarkers,
  normalizeEol,
} from "./editors.js";
import {
  removePlaywrightMcp,
  removeTestRunnerMcp,
  detectCodeGraphStatus,
  removeManagedBlock,
  removeChecklist,
  LINT_GUIDELINES_RELPATH,
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

  // 2. Remove E2E command (+ extraArtifacts) for each detected editor —
  // delegates to the removal.ts primitive (same rm + empty-dir cascade +
  // per-path success line as the original inline loop).
  console.log(chalk.blue("\n─── Removing E2E Commands ───"));
  for (const adapter of detected) {
    const relPaths = listCommandArtifactPaths(adapter, meta);
    let removedAny = false;
    for (const relPath of relPaths) {
      if (existsSync(join(projectRoot, relPath))) {
        removedAny = true;
      }
    }
    if (removedAny) {
      removeAdapterCommandArtifacts(adapter, projectRoot);
    } else {
      console.log(
        chalk.gray(`  - ${adapter.label}: E2E command not found, skipping`),
      );
    }
  }

  // 2b. Remove the vendored Playwright agent files (opt-in `init --agents`
  // installs). Tool-owned files go; user-modified files are kept and named.
  console.log(chalk.blue("\n─── Removing Vendored Agents ───"));
  if (detected.some((a) => a.id === "claude")) {
    const removedAgents = removeOwnedVendoredAgents(projectRoot, claudeAdapter);
    if (removedAgents.length === 0) {
      console.log(
        chalk.gray("  - No tool-owned vendored agents found (nothing to remove)"),
      );
    }
  } else {
    console.log(chalk.gray("  - Claude not detected, skipping"));
  }

  // 2c. Remove the swallow-error lint checklist (lint-guidelines capability).
  // Editor-agnostic asset — no adapter owns it, so this runs outside the
  // per-adapter loops above. app-knowledge/app-exploration stay (user-generated
  // domain content); this file is a static tool reference, so tool-owned copies
  // go and user-modified copies are kept and named (same split as 2b).
  console.log(chalk.blue("\n─── Removing Lint Guidelines ───"));
  const checklistResult = removeChecklist(projectRoot);
  if (checklistResult === "removed") {
    console.log(chalk.green(`  ✓ Removed ${LINT_GUIDELINES_RELPATH}`));
  } else if (checklistResult === "kept-modified") {
    console.log(
      chalk.yellow(
        `  ⚠ ${LINT_GUIDELINES_RELPATH} is locally modified — kept`,
      ),
    );
  } else {
    console.log(chalk.gray("  - Lint guidelines not found, skipping"));
  }

  // 3. Remove legacy skill directory (if present from older versions)
  console.log(chalk.blue("\n─── Removing Legacy Skill ───"));
  const skillDir = join(projectRoot, CLAUDE_LEGACY_SKILL_REL);
  if (existsSync(skillDir)) {
    rmSync(skillDir, { recursive: true, force: true });
    console.log(chalk.green("  ✓ Removed .claude/skills/openspec-e2e/"));
  } else {
    console.log(chalk.gray("  - Legacy skill directory not found, skipping"));
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

  // 4b. Remove the minimal-mode scaffold (tests/README.md) — content-owned:
  // byte-identical to the bundled template → tool-owned → removed; anything
  // else is user-owned → kept with a notice.
  console.log(chalk.blue("\n─── Removing Minimal Scaffold ───"));
  const readmeDest = join(projectRoot, "tests", "README.md");
  if (existsSync(readmeDest)) {
    const template = readFileSync(
      fileURLToPath(new URL("../../templates/tests-readme.md", import.meta.url)),
      "utf-8",
    );
    if (normalizeEol(readFileSync(readmeDest, "utf-8")) === normalizeEol(template)) {
      rmSync(readmeDest);
      try {
        rmdirSync(dirname(readmeDest)); // only succeeds when empty
      } catch {
        // user content in tests/ — leave the directory
      }
      console.log(chalk.green("  ✓ Removed tests/README.md"));
    } else {
      console.log(
        chalk.yellow(
          "  ⚠ tests/README.md differs from the bundled template — kept (user-modified or user-owned)",
        ),
      );
    }
  } else {
    console.log(chalk.gray("  - tests/README.md not found, skipping"));
  }

  // 5. Clean rules file markers for each detected editor
  console.log(chalk.blue("\n─── Cleaning Rules Files ───"));
  for (const adapter of detected) {
    cleanProjectRules(adapter, projectRoot);
  }
  // Minimal-mode projects carry standards without command artifacts (and
  // without a marker dir for the wrapper editors) — detection may miss
  // claude/codebuddy entirely (or the project may mix a detected editor
  // with a wrapper-only editor). Clean the rules files whenever a wrapper
  // editor is not among the detected editors but our territory is present;
  // removeMarkersFromFile stays quiet-ish (gray info lines) when the files
  // carry no markers.
  if (!detected.some((a) => a.id === "claude") && hasRuleFileMarkers(projectRoot)) {
    cleanProjectRules(claudeAdapter, projectRoot);
  }
  if (!detected.some((a) => a.id === "codebuddy") && hasRuleFileMarkers(projectRoot)) {
    cleanProjectRules(codebuddyAdapter, projectRoot);
  }

  // 5b. Remove the managed .gitignore block. Idempotent — no block is a
  // silent no-op. Credentials stay on disk: deleting user credentials is
  // data loss — they just lose the ignore protection.
  console.log(chalk.blue("\n─── Removing Managed .gitignore Block ───"));
  const blockResult = removeManagedBlock(projectRoot);
  if (blockResult.removed) {
    console.log(chalk.green("  ✓ Removed openspec-pw managed block from .gitignore"));
    if (existsSync(join(projectRoot, "tests", "playwright", "credentials.yaml"))) {
      console.log(
        chalk.yellow(
          "  ⚠ tests/playwright/credentials.yaml kept on disk — no longer ignore-protected, handle it yourself",
        ),
      );
    }
  } else {
    console.log(chalk.gray("  - No managed block found, skipping"));
  }

  console.log(chalk.blue("\n─── Removing Stop Hook ───"));
  const hookResult = uninstallStopHook(projectRoot);
  if ("error" in hookResult) {
    console.log(chalk.yellow(`  ⚠ ${hookResult.error}`));
  } else if (hookResult.removed) {
    console.log(chalk.green(`  ✓ Removed openspec-pw Stop hook from ${hookResult.path}`));
  } else {
    console.log(chalk.gray("  - No openspec-pw Stop hook found, skipping"));
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