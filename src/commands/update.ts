import { createRequire } from "node:module";
import { join, basename, sep } from "path";
import { fileURLToPath } from "url";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readdirSync,
  statSync,
  lstatSync,
} from "fs";
import { tmpdir } from "os";
import chalk from "chalk";
import * as tar from "tar";
import {
  buildCommandMeta,
  migrateOldStyleArtifacts,
  getAllAdapters,
  getAdapter,
  hasCommandArtifacts,
  installCommand,
  installOpenSpecBlock,
  installClaudeWrapper,
  installCodebuddyWrapper,
  migrateLegacyMarkers,
  claudeAdapter,
  codebuddyAdapter,
  claudeWrapperStandardsContent,
  opencodeAdapter,
  syncVendoredAgents,
  normalizeEol,
} from "./editors.js";
import {
  ensureTestRunnerMcp,
  isTestRunnerMcpInstalled,
  hasFrontendSignal,
  resolveProjectTarget,
  detectCodeGraphStatus,
  codegraphHintLines,
  detectInstalledLanguage,
  resolveStandardsLanguage,
  missingEnglishSections,
  findUncoveredManagedPaths,
  managedBlockAdvisoryHint,
  ensureGitignoreEntries,
  readManagedSkips,
  readManagedSkipsSafe,
  managedPathFor,
  installOrRefreshChecklist,
  LINT_GUIDELINES_RELPATH,
} from "../shared/index.js";
import { execFileAsync, execFileSync } from "../shared/exec.js";
import { openSpecCliStatus } from "../shared/openspec-version.js";
import { compareBlock, OPENSPEC_START, hasLegacyTerritoryStart, extractRuleBlockContent } from "../shared/drift.js";
import { readTextFileCapped } from "../shared/file-read.js";
import { pipelineGitignoreOmit } from "./pipeline.js";
import { fullRulesFile, wrapperHasMarkers, hasRuleFileMarkers } from "./editors/project-rules.js";
import type { EditorAdapter } from "./editors.js";

/**
 * Root of the running package: `dist/commands/update.js` → package root,
 * `src/commands/update.ts` (dev/tests) → repo root. Both carry `templates/`
 * and `standards/`, so the running copy can serve as the bundle source.
 */
const PACKAGE_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Version of the running package. */
function runningVersion(): string | undefined {
  try {
    const pkg = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, "package.json"), "utf-8"),
    ) as { version?: string };
    return pkg.version;
  } catch {
    return undefined;
  }
}

/**
 * Latest published version, fetched at most once per run and reused by the
 * install-skip check, the bundle-source choice, and the version-shadow
 * self-check. Empty string means "could not be determined" (offline).
 */
let publishedVersionCache: string | undefined;
async function publishedLatestVersion(): Promise<string | undefined> {
  if (publishedVersionCache !== undefined) {
    return publishedVersionCache || undefined;
  }
  try {
    const { stdout } = await execFileAsync(
      "npm",
      ["view", "openspec-playwright", "version"],
      { timeout: 30000 },
    );
    publishedVersionCache = stdout.trim();
  } catch {
    publishedVersionCache = "";
  }
  return publishedVersionCache || undefined;
}

/** Version installed in the global npm root, or undefined when unreadable. */
async function globalInstalledVersion(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("npm", ["root", "-g"], {
      timeout: 15000,
    });
    const root = stdout.trim();
    if (!root) return undefined;
    const pkgPath = join(root, "openspec-playwright", "package.json");
    if (!existsSync(pkgPath)) return undefined;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      version?: string;
    };
    return pkg.version;
  } catch {
    return undefined;
  }
}

/** Any openspec-pw command artifact in either naming family exists. */
function hasAnyCommandArtifacts(projectRoot: string): boolean {
  for (const style of ["opsx", "openspec"] as const) {
    if (
      getAllAdapters(style).some((adapter) =>
        hasCommandArtifacts(projectRoot, adapter),
      )
    ) {
      return true;
    }
  }
  return false;
}

/** Editors whose project rules file is a thin wrapper (not AGENTS.md), with their installers. */
const WRAPPER_EDITORS: Array<[EditorAdapter, (root: string) => void]> = [
  [claudeAdapter, installClaudeWrapper],
  [codebuddyAdapter, installCodebuddyWrapper],
];

export interface UpdateOptions {
  cli?: boolean;
  skill?: boolean;
  mcp?: boolean;
  /** Employee standards language (`--lang zh|en`); invalid values are rejected by the CLI. */
  lang?: string;
}

/**
 * Adapters whose full-standards rules file carries our marker block but
 * differs from `standards`. Files without markers belong to the user and are
 * never reported.
 */
export function staleFullRulesAdapters(
  projectRoot: string,
  standards: string,
): EditorAdapter[] {
  const stale: EditorAdapter[] = [];
  for (const adapter of getAllAdapters()) {
    const full = fullRulesFile(adapter, projectRoot);
    if (!full || !existsSync(full)) continue;
    if (lstatSync(full).isSymbolicLink()) continue;
    const read = readTextFileCapped(full);
    if (read.kind !== "ok") continue;
    const content = read.content;
    if (!content.includes(OPENSPEC_START)) continue;
    if (compareBlock(content, standards).stale) stale.push(adapter);
  }
  return stale;
}

export async function update(options: UpdateOptions) {
  console.log(chalk.blue("\n🔄 Updating OpenSpec + Playwright E2E\n"));

  const projectRoot = process.cwd();
  // Artifact paths follow the installed CLI major; wrapper files do not, so
  // the same adapter id serves both gates.
  const claude = getAdapter("claude") ?? claudeAdapter;
  const codebuddy = getAdapter("codebuddy") ?? codebuddyAdapter;

  // Check if init has been run
  const hasCommand = hasAnyCommandArtifacts(projectRoot);
  const hasOpenSpec = existsSync(join(projectRoot, "openspec"));
  if (!hasCommand && !hasOpenSpec) {
    console.log(chalk.yellow("  ⚠ OpenSpec + Playwright E2E not initialized."));
    console.log(
      chalk.gray('  Run "openspec-pw init" first to set up the integration.\n'),
    );
    return;
  }

  // 1.x and 2.x are both supported; an unsupported or unreadable CLI is
  // reported but does not block the update itself.
  const openspec = openSpecCliStatus();
  if (!openspec.ok && openspec.kind !== "missing") {
    console.log(chalk.yellow(`  ⚠ ${openspec.message}`));
  }

  // 1. Update CLI tool from npm
  if (options.cli !== false) {
    console.log(chalk.blue("─── Updating CLI ───"));
    // Already at the published latest → nothing to install.
    const latest = await publishedLatestVersion();
    const installed = await globalInstalledVersion();
    if (isCliCurrent(installed, latest)) {
      console.log(chalk.green(`  ✓ CLI already at latest (${installed})`));
    } else {
      let cliUpdated = false;
      try {
        await execFileAsync(
          "npm",
          ["install", "-g", "openspec-playwright@latest"],
          {
            timeout: 120000,
            cwd: projectRoot,
            stdio: "inherit",
          },
        );
        console.log(chalk.green("  ✓ CLI updated via npm"));
        cliUpdated = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.yellow(`  ⚠ Failed to update CLI via npm: ${msg}`));
        console.log(
          chalk.gray("  Run manually: npm install -g openspec-playwright@latest"),
        );
      }

      // Re-execute remaining steps (templates, commands, AGENTS.md) with the
      // newly-installed binary so that the latest code handles project setup.
      // The original process still runs old code and would miss AGENTS.md creation
      // (which was added in a later version).
      if (cliUpdated) {
        try {
          // Re-run with --no-cli (avoid re-updating the just-updated CLI) and
          // forward the user's other flags so the restarted process honors them
          // too (e.g. --no-mcp must still skip the MCP phase, --lang must switch).
          const reExecArgs = ["update", "--no-cli"];
          if (options.mcp === false) reExecArgs.push("--no-mcp");
          if (options.skill === false) reExecArgs.push("--no-skill");
          if (options.lang) reExecArgs.push("--lang", options.lang);
          execFileSync("openspec-pw", reExecArgs, {
            stdio: "inherit",
            cwd: projectRoot,
          });
          return;
        } catch {
          console.log(
            chalk.yellow(
              "  ⚠ Re-execution failed, continuing with current binary...",
            ),
          );
          // Fall through — let the old binary attempt remaining steps
        }
      }
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
          "  ⚠ openspec-playwright is in devDependencies (shadows the global CLI) — syncing to latest",
        ),
      );
      try {
        await execFileAsync(
          "npm",
          ["install", "-D", "openspec-playwright@latest"],
          {
            timeout: 120000,
            cwd: projectRoot,
            stdio: "inherit",
          },
        );
        console.log(chalk.green("  ✓ devDependency synced to latest"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.yellow(`  ⚠ Failed to sync devDependency: ${msg}`));
        console.log(
          chalk.gray(
            "    Run manually: npm install -D openspec-playwright@latest\n",
          ),
        );
      }
    }
  }

  // 2. Update commands/templates (skipped by --no-skill) + standards (always)
  // Latest checklist template from the fetched bundle, when this run has one.
  // Captured before the temporary extract dir is removed; the running
  // package's copy is the fallback for runs whose fetch failed.
  let checklistTemplate: string | null = null;
  if (options.skill !== false) {
    console.log(chalk.blue("\n─── Updating Commands ───"));
    try {
      const bundle = await resolveBundle();
      const tmpDir = bundle.root;

      const fetchedChecklist = join(tmpDir, "templates", "lint-guidelines.md");
      if (existsSync(fetchedChecklist)) {
        checklistTemplate = readFileSync(fetchedChecklist, "utf-8");
      }

      // Read e2e command content from template
      const commandSrc = join(tmpDir, "templates", "e2e-command.md");
      let body = "";
      if (existsSync(commandSrc)) {
        body = readFileSync(commandSrc, "utf-8");
      }

      // Write authorization = tool-owned artifacts exist ("existing artifacts
      // are the manifest") — never detect(): a global config dir or a
      // hand-created marker directory does not authorize writes. update
      // maintains territory; it never expands it. Both naming families
      // authorize: a project still on 1.x artifacts must be migratable after
      // the CLI upgrade.
      const installed = syncE2eCommands(projectRoot, body);

      // Sync project templates (BasePage.ts, seed.spec.ts)
      syncProjectTemplates(tmpDir, projectRoot);

      // Vendored Playwright agents (claude, opt-in): refresh tool-owned
      // files to the fetched snapshot; user-owned files are skipped with a
      // notice; missing files are never created (opt-in via init --agents).
      syncVendoredAgents(
        join(tmpDir, "templates", "agents"),
        projectRoot,
        hasCommandArtifacts(projectRoot, claude),
      );

      // Standards sync (drift-aware). Under --no-skill this phase still runs
      // via the else branch below — the flag only scopes command/template
      // installation, not standards. Wrapper files (CLAUDE.md / CODEBUDDY.md)
      // are gated on the editor's command-artifact authorization OR the
      // wrapper marker block (minimal-mode projects — init-minimal-mode).
      syncEmployeeStandards(
        tmpDir,
        projectRoot,
        hasCommandArtifacts(projectRoot, claude) || wrapperHasMarkers(claude, projectRoot),
        installed || hasRuleFileMarkers(projectRoot),
        hasCommandArtifacts(projectRoot, codebuddy) || wrapperHasMarkers(codebuddy, projectRoot),
        options.lang,
      );

      if (bundle.disposable) rmSync(tmpDir, { recursive: true, force: true });
      console.log(chalk.green("  ✓ Commands & templates updated to latest"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.yellow(`  ⚠ Failed to update from npm: ${msg}`));
      console.log(chalk.gray("  Trying npm install to pull latest version..."));
      try {
        await execFileAsync(
          "npm",
          ["install", "-g", "openspec-playwright@latest"],
          {
            timeout: 120000,
            cwd: projectRoot,
            stdio: "inherit",
          },
        );
        console.log(chalk.green("  ✓ Updated via npm install"));
      } catch (err2) {
        const msg2 = err2 instanceof Error ? err2.message : String(err2);
        console.log(chalk.red(`  ✗ Failed to update: ${msg2}`));
        console.log(
          chalk.gray(
            "    Run manually: npm install -g openspec-playwright@latest",
          ),
        );
      }
    }
  } else {
    // --no-skill skips command/template installation only — the standards
    // drift check is not a skill and must not be silently skipped.
    console.log(
      chalk.gray("  - --no-skill: commands and templates left untouched"),
    );
    console.log(chalk.blue("\n─── Standards Sync ───"));
    try {
      const bundle = await resolveBundle();
      const tmpDir = bundle.root;
      const fetchedChecklist = join(tmpDir, "templates", "lint-guidelines.md");
      if (existsSync(fetchedChecklist)) {
        checklistTemplate = readFileSync(fetchedChecklist, "utf-8");
      }
      syncEmployeeStandards(
        tmpDir,
        projectRoot,
        hasCommandArtifacts(projectRoot, claude) || wrapperHasMarkers(claude, projectRoot),
        hasAnyCommandArtifacts(projectRoot) || hasRuleFileMarkers(projectRoot),
        hasCommandArtifacts(projectRoot, codebuddy) || wrapperHasMarkers(codebuddy, projectRoot),
        options.lang,
      );
      if (bundle.disposable) rmSync(tmpDir, { recursive: true, force: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.yellow(`  ⚠ Standards sync failed: ${msg}`));
    }
  }

  // 2b. Install the Playwright test-runner MCP for each authorized editor
  // (tool-owned command artifacts exist). Single project-scoped server
  // matching the official `playwright init-agents` layout: `playwright-test`
  // exposes both browser_* tools and the test_run/test_debug/test_list
  // workflow tools. Frontend gate mirrors init — API-only projects don't
  // need the browser MCP (the skip is announced, not silent). Unauthorized
  // editors are skipped: MCP config files (e.g. .omp/mcp.json) are never
  // created out of thin air.
  if (options.mcp !== false) {
    if (hasFrontendSignal(projectRoot) !== true) {
      console.log(
        chalk.gray(
          "  - No frontend signal detected — skipping Playwright MCP (API tests use the request fixture)",
        ),
      );
    } else {
      const authorized = getAllAdapters().filter((a) =>
        hasCommandArtifacts(projectRoot, a),
      );
      if (authorized.length === 0) {
        console.log(
          chalk.gray(
            '  - No openspec-pw artifacts in this project — run "openspec-pw init" to set up the Playwright MCP',
          ),
        );
      } else {
        console.log(chalk.blue("\n─── Installing Playwright MCP ───"));
        for (const adapter of getAllAdapters()) {
          if (!hasCommandArtifacts(projectRoot, adapter)) continue;
          if (isTestRunnerMcpInstalled(adapter, projectRoot)) {
            console.log(
              chalk.green(
                `  ✓ ${adapter.label}: Test-runner MCP already installed`,
              ),
            );
            continue;
          }
          try {
            ensureTestRunnerMcp(adapter, projectRoot);
          } catch {
            console.log(
              chalk.yellow(
                `  ⚠ ${adapter.label}: Failed to install Test-runner MCP`,
              ),
            );
            console.log(
              chalk.gray(`    Install manually (see ${adapter.label} docs).`),
            );
          }
        }
      }
    }
  }

  // Swallow-error lint checklist — content-based ownership (lint-guidelines
  // capability): identical → silent; tool-owned → refresh; user-modified →
  // notice and keep. Inside the initialized gate, so update never expands
  // territory.
  const checklist = installOrRefreshChecklist(
    projectRoot,
    checklistTemplate ?? undefined,
  );
  if (checklist === "created") {
    console.log(chalk.green(`  ✓ Generated: ${LINT_GUIDELINES_RELPATH}`));
  } else if (checklist === "refreshed") {
    console.log(chalk.green(`  ✓ Refreshed: ${LINT_GUIDELINES_RELPATH}`));
  } else if (checklist === "kept-modified") {
    console.log(
      chalk.yellow(
        `  ⚠ ${LINT_GUIDELINES_RELPATH} is locally modified — kept as-is (compare with the shipped checklist if unsure)`,
      ),
    );
  }

  // Summary
  console.log(chalk.blue("\n─── Summary ───"));
  console.log(chalk.green("  ✓ Update complete!"));

  // Self-check: detect when the actually-resolved package version
  // (by Node module resolution from this CLI script) differs from
  // the latest published version. Either a project-local devDependency
  // shadows the global binary, or the global install itself is stale —
  // the advice printed depends on which one it is.
  await checkVersionShadow(projectRoot);

  const editorsForHint = getAllAdapters().filter((a) =>
    hasCommandArtifacts(projectRoot, a),
  );
  if (editorsForHint.length > 0) {
    const labels = editorsForHint.map((a) => a.displayName).join(" + ");
    console.log(
      chalk.bold(`\n  Restart ${labels} to use the updated commands.`),
    );
  } else {
    console.log(
      chalk.bold("\n  No configured editors — nothing to restart."),
    );
  }

  // CodeGraph hints — suggest `codegraph init` when the CLI is installed but
  // the project is not indexed, or `codegraph sync` to refresh an existing
  // index. Hints only, never setup.
  const cg = detectCodeGraphStatus(projectRoot);
  const hints = codegraphHintLines(cg);
  if (hints.length > 0) {
    console.log(chalk.gray(`\n  ${hints[0]}`));
    for (const line of hints.slice(1)) {
      console.log(chalk.gray(`  ${line}`));
    }
  }
}

/**
 * Lines describing a CLI-vs-registry version mismatch. The advice depends on
 * where the running copy resolved from: a copy inside the project's
 * node_modules shadows the global binary, while a stale global install is
 * fixed by reinstalling globally (npm can serve a cached "latest" right after
 * a release, hence --prefer-online). Exported for tests.
 */
export function versionMismatchLines(
  resolvedPath: string,
  projectRoot: string,
  resolvedVersion: string,
  publishedVersion: string,
): string[] {
  const installRoot = resolvedPath.replace(/[\\/]package\.json$/, "");
  const localModules = join(projectRoot, "node_modules") + sep;
  const isProjectLocal = (installRoot + sep).startsWith(localModules);

  const lines = [
    `\n  ⚠ Version mismatch: loaded ${resolvedVersion}, latest ${publishedVersion}`,
    `    Resolved from: ${installRoot}`,
  ];
  if (isProjectLocal) {
    lines.push(
      "    A devDependency in this project's package.json shadows the global CLI binary.",
      "    Fix: npm uninstall openspec-playwright, then re-run: openspec-pw update",
      "         (or: npm install -D openspec-playwright@latest)",
    );
  } else {
    lines.push(
      '    The global install is outdated (npm may still serve a cached "latest" right after a release).',
      "    Fix: npm install -g openspec-playwright@latest --prefer-online",
    );
  }
  return lines;
}

/**
 * Self-check: print warning if Node module resolution is loading
 * a different `openspec-playwright` version than the one just
 * installed, with advice matching where that copy came from.
 */
async function checkVersionShadow(projectRoot: string): Promise<void> {
  let resolvedVersion: string | undefined;
  let resolvedPath: string | undefined;
  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve("openspec-playwright/package.json");
    resolvedPath = pkgPath;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      version?: string;
    };
    resolvedVersion = pkg.version;
  } catch {
    // openspec-playwright not in module path — nothing to check
    return;
  }
  if (!resolvedVersion || !resolvedPath) return;

  // Reuse the version resolved earlier in this run (one registry round trip).
  const publishedVersion = await publishedLatestVersion();
  if (!publishedVersion || resolvedVersion === publishedVersion) return;

  const lines = versionMismatchLines(
    resolvedPath,
    projectRoot,
    resolvedVersion,
    publishedVersion,
  );
  console.log(chalk.yellow(lines[0]));
  for (const line of lines.slice(1)) {
    console.log(chalk.gray(line));
  }
}

/**
 * Bundle source decision: the running package already carries the published
 * content when it is at the published latest — or when the registry cannot be
 * reached. Otherwise the published package must be fetched.
 */
export function chooseBundleSource(
  latest: string | undefined,
  running: string | undefined,
  hasLocalContent: boolean,
): "local" | "pack" {
  if (!hasLocalContent) return "pack";
  if (latest === undefined) return "local";
  return running === latest ? "local" : "pack";
}

/** The global install can be left alone only when it is the published latest. */
export function isCliCurrent(
  installed: string | undefined,
  latest: string | undefined,
): boolean {
  return Boolean(installed && latest && installed === latest);
}

/**
 * Source of the published content (templates/, standards/): the running
 * package when it already is the published latest — or when the registry
 * cannot be reached — otherwise a fresh `npm pack` of the published package.
 */
interface BundleSource {
  /** Directory holding templates/ and standards/. */
  root: string;
  /** True for a temp dir this run owns and must delete. */
  disposable: boolean;
}

/**
 * Resolve the bundle root. Shared by the full phase and the `--no-skill`
 * standards-only path.
 */
async function resolveBundle(): Promise<BundleSource> {
  const latest = await publishedLatestVersion();
  const running = runningVersion();
  const hasLocalContent = existsSync(
    join(PACKAGE_ROOT, "templates", "e2e-command.md"),
  );
  if (chooseBundleSource(latest, running, hasLocalContent) === "local") {
    return { root: PACKAGE_ROOT, disposable: false };
  }

  const tmpDir = join(tmpdir(), "openspec-e2e-update");
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  // Cross-spawn passes argv verbatim without shell interpretation, so paths
  // with spaces (OneDrive, CJK user names) reach npm unchanged.
  await execFileAsync(
    "npm",
    ["pack", "openspec-playwright", "--pack-destination", tmpDir],
    { timeout: 30000 },
  );

  const tgzFiles = readdirSync(tmpDir)
    .filter((f) => f.startsWith("openspec-playwright-") && f.endsWith(".tgz"))
    .map((f) => ({ name: f, mtime: statSync(join(tmpDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (tgzFiles.length === 0) throw new Error("No tarball found");

  await tar.extract({
    file: join(tmpDir, tgzFiles[0].name),
    cwd: tmpDir,
    strip: 1,
  });
  return { root: tmpDir, disposable: true };
}

/**
 * Drift-aware refresh of every configured editor's command artifact.
 *
 * Write authorization = tool-owned artifacts exist ("existing artifacts are
 * the manifest") — never detect(): a global config dir or a hand-created
 * marker directory does not authorize writes. update maintains territory; it
 * never expands it. Editors without artifacts are reported and skipped.
 *
 * Extracted from `update()` so the per-adapter refresh is testable without a
 * network round-trip to the npm registry.
 */
/**
 * Refresh the e2e command for every editor that already carries one. Migration
 * deletes the 1.x file before the 2.x write, so migrated editors stay
 * authorized while no artifact exists at that path. Returns whether the
 * project carried any e2e artifact.
 */
export function syncE2eCommands(projectRoot: string, body: string): boolean {
  const ids = new Set<string>();
  for (const style of ["opsx", "openspec"] as const) {
    for (const adapter of getAllAdapters(style)) {
      if (hasCommandArtifacts(projectRoot, adapter)) ids.add(adapter.id);
    }
  }
  if (!body) return ids.size > 0;
  const meta = buildCommandMeta(body);
  // Migration is not gated on authorization: it only removes files whose
  // content is this tool's 1.x render. The shared `.agents/skills` path never
  // authorizes a write, so gating here would strand its 1.x copy.
  const migrated = new Set<string>();
  for (const adapter of getAllAdapters()) {
    if (migrateOldStyleArtifacts(adapter, projectRoot, meta).length > 0) {
      migrated.add(adapter.id);
    }
  }
  if (ids.size === 0 && migrated.size === 0) {
    console.log(
      chalk.gray(
        '  - No openspec-pw artifacts in this project — run "openspec-pw init" to set up editor integrations',
      ),
    );
    return false;
  }
  const unchanged = syncCommandArtifacts(projectRoot, body, migrated);
  if (unchanged > 0) {
    console.log(
      chalk.gray(
        `  - ${unchanged} editor${unchanged === 1 ? "" : "s"} already current`,
      ),
    );
  }
  return true;
}

/** Rewrite stale command artifacts; returns how many editors needed no write. */
export function syncCommandArtifacts(
  projectRoot: string,
  body: string,
  migratedIds?: ReadonlySet<string>,
): number {
  const meta = buildCommandMeta(body);
  let unchanged = 0;
  for (const adapter of getAllAdapters()) {
    const relPath = adapter.commandFilePath(meta.id);
    const absPath = join(projectRoot, relPath);
    // Shared artifacts (Codex + MiniMax) never authorize writes, but an
    // existing file is still this tool's artifact — update maintains it.
    // A just-migrated editor has neither yet: its 1.x file was removed in
    // this run and the 2.x one is what we are about to write.
    if (
      !hasCommandArtifacts(projectRoot, adapter) &&
      !existsSync(absPath) &&
      !migratedIds?.has(adapter.id)
    ) {
      continue;
    }
    // Drift-aware: only rewrite a command file when its content differs
    // from the formatted template. Untouched files keep their mtime.
    const expected = adapter.formatCommand(meta);
    let needsWrite = !existsSync(absPath);
    if (!needsWrite) {
      needsWrite = readFileSync(absPath, "utf-8") !== expected;
    }

    // Extra artifacts (e.g. Cursor skill SKILL.md) must also match —
    // a missing/stale secondary file is repaired along with the command.
    if (!needsWrite) {
      for (const extra of adapter.extraArtifacts?.(meta) ?? []) {
        const extraAbs = join(projectRoot, extra.relativePath);
        if (
          !existsSync(extraAbs) ||
          readFileSync(extraAbs, "utf-8") !== extra.contents
        ) {
          needsWrite = true;
          break;
        }
      }
    }

    if (needsWrite) {
      installCommand(adapter, meta, projectRoot);
    } else {
      unchanged += 1;
    }
  }
  return unchanged;
}

/**
 * Drift-aware sync of employee-grade standards into AGENTS.md (SSOT) and the
 * CLAUDE.md wrapper (when Claude is detected). Extracted so it can also run
 * under `--no-skill` — standards sync is not a skill install and must not be
 * silently skipped by that flag.
 */
export function syncEmployeeStandards(
  tmpDir: string,
  projectRoot: string,
  claudeAuthorized: boolean,
  hasPwArtifacts: boolean,
  codebuddyAuthorized = false,
  lang?: string,
): void {
  // Update employee-grade standards in project rules files (AGENTS.md +
  // wrapper files CLAUDE.md / CODEBUDDY.md). Drift-aware: only rewrite a
  // rules file when its OPENSPEC block differs from the bundled template;
  // matching content is left untouched (no mtime change). 标记即领土,
  // judged per artifact: AGENTS.md is only maintained when it already
  // carries the tool-owned OPENSPEC block — a missing file or one without
  // markers is NOT created/appended here (run `openspec-pw init` to
  // install). Wrapper files are gated on their editor's command-artifact
  // authorization, not their own markers.
  const agentsPath = join(projectRoot, "AGENTS.md");
  const agentsRaw = existsSync(agentsPath)
    ? readFileSync(agentsPath, "utf-8")
    : null;
  const installed = detectInstalledLanguage(
    agentsRaw ? extractRuleBlockContent(agentsRaw) : null,
  );
  const hasStandardsBlock =
    agentsRaw !== null &&
    (agentsRaw.includes(OPENSPEC_START) ||
      hasLegacyTerritoryStart(agentsRaw));
  const language = resolveStandardsLanguage({ flag: lang, installed });
  const standardsFile =
    language === "en" ? "employee-standards.en.md" : "employee-standards.md";
  // The fetched bundle can predate the standards/ layout move; accept the
  // legacy root location until the first release with the new layout ships.
  const standardsSrc = [
    join(tmpDir, "standards", standardsFile),
    join(tmpDir, standardsFile),
  ].find((candidate) => existsSync(candidate));
  if (!standardsSrc) {
    console.error(
      chalk.red(`  ✗ Employee standards file missing: ${standardsFile}`),
    );
    console.error(chalk.gray("    Reinstall the CLI or pass --lang zh|en"));
    process.exitCode = 1;
    return;
  }
  const standards = readFileSync(standardsSrc, "utf-8");
  if (language === "en") {
    const missing = missingEnglishSections(standards);
    if (missing.length > 0) {
      console.error(
        chalk.red(
          `  ✗ English standards incomplete — missing ${missing.map((n) => `§${n}`).join(", ")}`,
        ),
      );
      console.error(chalk.gray("    Reinstall the CLI or pass --lang zh"));
      process.exitCode = 1;
      return;
    }
  }
  if (lang && !hasStandardsBlock) {
    console.log(
      chalk.gray(
        '  - --lang has no effect without an installed standards block — run "openspec-pw init"',
      ),
    );
  } else if (
    hasStandardsBlock &&
    (installed === null ? Boolean(lang) : installed !== language)
  ) {
    console.log(
      chalk.gray(
        `  ✓ Employee standards switched to ${language === "en" ? "English" : "Chinese"}`,
      ),
    );
  }

  // Migrate surviving legacy OPENSPEC blocks FIRST — every marker judgment
  // below reads the migrated file. (Ordering is load-bearing: a legacy
  // wrapper's inner @AGENTS.md line would otherwise false-match the
  // bare-import check before migration fixes it.)
  migrateLegacyMarkers(projectRoot, hasPwArtifacts, claudeAuthorized, codebuddyAuthorized);

  // Re-read after migration: the marker judgment below must see the migrated
  // markers. Language detection above only needed the content anchors.
  const agentsContent = existsSync(agentsPath)
    ? readFileSync(agentsPath, "utf-8")
    : null;

  let agentsStale = false;
  let agentsInTerritory = false;
  if (agentsContent === null) {
    console.log(
      chalk.gray(
        '  - AGENTS.md not found — run "openspec-pw init" to install employee standards',
      ),
    );
  } else {
    const fileContent = agentsContent;
    if (!fileContent.includes(OPENSPEC_START)) {
      if (hasPwArtifacts && !hasLegacyTerritoryStart(fileContent)) {
        // Territorial block vanished (e.g. wiped by the official openspec
        // CLI's legacy cleanup) — loud warning, not a gray info line.
        console.log(
          chalk.yellow(
            "\n  ⚠ AGENTS.md has no OPENSPEC-PW block — the employee-grade standards block is missing.",
          ),
        );
        console.log(
          chalk.yellow(
            "    This can happen when the official `openspec update` legacy cleanup removes",
          ),
        );
        console.log(
          chalk.yellow(
            "    blocks wrapped in plain OPENSPEC:START/END markers (shared namespace).",
          ),
        );
        console.log(
          chalk.yellow('    Restore: run "openspec-pw init".'),
        );
        console.log(
          chalk.yellow(
            '    If the removal was intentional, run "openspec-pw remove" to stop these warnings.',
          ),
        );
      } else {
        console.log(
          chalk.gray(
            '  - AGENTS.md has no OPENSPEC block — run "openspec-pw init" to install employee standards',
          ),
        );
      }
    } else {
      agentsInTerritory = true;
      agentsStale = compareBlock(fileContent, standards).stale;
    }
  }

  // Rule-copy opt-out (--no-rule-files) lives on the managed block's skip
  // line; those files are neither recreated nor refreshed below.
  const ruleSkips = new Set(readManagedSkipsSafe(projectRoot));

  // Wrapper files (CLAUDE.md / CODEBUDDY.md) are only maintained when their
  // editor is authorized. A bare `@AGENTS.md` import without markers is left
  // untouched (added by the openspec CLI or the user) — not stale.
  const staleWrapperInstallers: Array<(root: string) => void> = [];
  for (const [adapter, installer] of WRAPPER_EDITORS) {
    const authorized = adapter.id === "claude" ? claudeAuthorized : codebuddyAuthorized;
    if (!authorized) continue;
    const wrapperPath = adapter.projectRulesPath(projectRoot);
    const wrapperLabel = basename(wrapperPath);
    if (ruleSkips.has(managedPathFor(projectRoot, wrapperPath))) {
      console.log(
        chalk.gray(`  - ${wrapperLabel}: rules copy disabled (--no-rule-files)`),
      );
      continue;
    }
    // A symlinked wrapper (→ AGENTS.md, the official reuse pattern)
    // is what the editor reads; the AGENTS.md check above already
    // tracks its content drift, and rewriting a wrapper would overwrite
    // the standards through the symlink. Not stale.
    if (existsSync(wrapperPath) && lstatSync(wrapperPath).isSymbolicLink()) {
      console.log(
        chalk.gray(
          `  - ${wrapperLabel} is a symlink to AGENTS.md — drift tracked via AGENTS.md`,
        ),
      );
      continue;
    }
    let wrapperStale = !existsSync(wrapperPath);
    if (!wrapperStale) {
      const fileContent = readFileSync(wrapperPath, "utf-8");
      if (!fileContent.includes(OPENSPEC_START)) {
        wrapperStale = !/^@AGENTS\.md\r?$/m.test(fileContent);
      } else {
        wrapperStale = compareBlock(
          fileContent,
          claudeWrapperStandardsContent(),
        ).stale;
      }
    }
    if (wrapperStale) staleWrapperInstallers.push(installer);
  }

  // Full-standards rules files (GEMINI.md, QWEN.md, copilot-instructions,
  // Roo/Trae rule files) carry our block directly. Refresh them when the
  // block is present and differs from the bundled standards; a file without
  // our markers belongs to the user and is left alone.
  const staleFullRules = staleFullRulesAdapters(projectRoot, standards).filter(
    (adapter) => {
      const full = fullRulesFile(adapter, projectRoot);
      return !(full && ruleSkips.has(managedPathFor(projectRoot, full)));
    },
  );

  if (
    agentsStale ||
    staleWrapperInstallers.length > 0 ||
    staleFullRules.length > 0
  ) {
    console.log(
      chalk.gray(
        "  检测到非模板内容将被覆盖 — OPENSPEC block differs from bundled version",
      ),
    );
    if (agentsStale) {
      installOpenSpecBlock(projectRoot, standards, opencodeAdapter);
    }
    for (const installer of staleWrapperInstallers) {
      installer(projectRoot);
    }
    for (const adapter of staleFullRules) {
      installOpenSpecBlock(projectRoot, standards, adapter);
    }
  } else if (agentsInTerritory) {
    console.log(chalk.green("  ✓ employee-grade standards already in sync"));
  }
}

// Sync project-level templates
// 1.x command names that older templates wrote into generated files; the exact
// sentences map to their current neutral wording.
const LEGACY_E2E_HINTS: ReadonlyArray<readonly [string, string]> = [
  [
    "Then re-run /opsx:e2e.",
    "Then re-run the E2E workflow command for your editor.",
  ],
  [
    "Then re-run the E2E workflow command (/opsx:e2e or /opsx-e2e depending on your editor).",
    "Then re-run the E2E workflow command for your editor.",
  ],
  [
    "// Setup project (used by /opsx:e2e Healer and local auth setup)",
    "// Setup project (used by the E2E Healer and local auth setup)",
  ],
  [
    "// Setup project (configured by openspec-pw run)",
    "// Setup project (used by the E2E Healer and local auth setup)",
  ],
  [
    "// Setup project for authentication (configured by openspec-pw run)",
    "// Setup project (used by the E2E Healer and local auth setup)",
  ],
];

// Possible Playwright config filenames: doctor, gate and app-detect each accept
// a different subset of these extensions, so scan all of them.
const PLAYWRIGHT_CONFIG_NAMES = [
  "playwright.config.ts",
  "playwright.config.js",
  "playwright.config.mjs",
  "playwright.config.mts",
  "playwright.config.cjs",
] as const;

/**
 * Replace known legacy command-name sentences in a generated file the user
 * owns. Exact-substring only: everything else in the file stays untouched.
 * Symlinks are skipped (a shared config must not be rewritten through the
 * link); an unwritable file is reported and skipped — it must not abort the
 * update.
 */
function migrateLegacyE2eHints(filePath: string, label: string) {
  try {
    if (!existsSync(filePath) || lstatSync(filePath).isSymbolicLink()) return;
    const existing = readFileSync(filePath, "utf-8");
    let updated = existing;
    for (const [from, to] of LEGACY_E2E_HINTS) {
      updated = updated.split(from).join(to);
    }
    if (updated === existing) return;
    writeFileSync(filePath, updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(
      chalk.yellow(
        `  ⚠ Could not migrate ${label}: ${msg} — fix the file permissions or ownership, then re-run 'openspec-pw update'`,
      ),
    );
    return;
  }
  console.log(chalk.green(`  ✓ Migrated: ${label}`));
}

export function syncProjectTemplates(tmpDir: string, projectRoot: string) {
  const mini = resolveProjectTarget(projectRoot) === "miniprogram";
  // 0. tests/README.md — minimal-mode deliverable, independent of the
  // tests/playwright gate (minimal-mode projects have no tests/playwright).
  // Stateless asset: matching the bundled template → no-op; anything else is
  // user-owned (or an outdated tool copy) — never auto-overwritten, hinted
  // instead (asset-sync: no version tracking for a low-value static doc).
  // The mini-program target keeps its contract doc next to the tests.
  const readmeRel = mini ? join("tests", "playwright", "README.md") : join("tests", "README.md");
  // POSIX label for messages: the hint is asserted verbatim and must not vary
  // with the platform separator.
  const readmeLabel = mini ? "tests/playwright/README.md" : "tests/README.md";
  const readmeTemplate = mini
    ? join("templates", "miniprogram", "tests-readme.md")
    : join("templates", "tests-readme.md");
  const readmeSrc = join(tmpDir, readmeTemplate);
  const readmeDest = join(projectRoot, readmeRel);
  if (existsSync(readmeSrc) && existsSync(readmeDest)) {
    if (normalizeEol(readFileSync(readmeDest, "utf-8")) !== normalizeEol(readFileSync(readmeSrc, "utf-8"))) {
      console.log(
        chalk.yellow(
          `  ⚠ ${readmeLabel} differs from the bundled template — update it manually, or delete it and re-run \`openspec-pw init\``,
        ),
      );
    }
  }

  const testsDir = join(projectRoot, "tests", "playwright");
  // Minimal-mode projects (no tests/playwright/) still get managed-block
  // maintenance — the block is a forward-looking declaration (review F4):
  // the early return below must not skip it, or a minimal project whose
  // .gitignore lost the block silently stops ignoring openspec/ etc.
  let managedSkips: readonly string[] = [];
  try {
    managedSkips = readManagedSkips(projectRoot);
    const result = ensureGitignoreEntries(projectRoot, {
      omit: pipelineGitignoreOmit(projectRoot),
      skip: managedSkips,
    });
    if (result.changed) {
      console.log(
        chalk.green(
          `  ✓ .gitignore: managed block updated (+${result.added.length} paths)`,
        ),
      );
    }
  } catch {
    printCredentialsIgnoreHint(projectRoot, managedSkips);
  }
  // 0b. Migrate 1.x command names in generated files the user owns. The config
  // comes before the tests/playwright gate: a project that moved its test dir
  // still carries the tool's config.
  for (const name of PLAYWRIGHT_CONFIG_NAMES) {
    migrateLegacyE2eHints(join(projectRoot, name), name);
  }
  if (!existsSync(testsDir)) return;

  // 0c. Seed migration runs before the comparison below so a migrated seed is
  // compared in its new form.
  migrateLegacyE2eHints(
    join(testsDir, "seed.spec.ts"),
    "tests/playwright/seed.spec.ts",
  );

  // 1. Sync BasePage.ts — always update if content differs
  const basePageSrc = join(
    tmpDir,
    ...(mini
      ? ["templates", "miniprogram", "pages", "BasePage.ts"]
      : ["templates", "pages", "BasePage.ts"]),
  );
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

  // 1b. Sync test-plan.template.md — always update if content differs
  const testPlanSrc = join(
    tmpDir,
    ...(mini ? ["templates", "miniprogram", "test-plan.md"] : ["templates", "test-plan.md"]),
  );
  const testPlanDest = join(testsDir, "test-plan.template.md");

  if (existsSync(testPlanSrc)) {
    if (!existsSync(testPlanDest)) {
      writeFileSync(testPlanDest, readFileSync(testPlanSrc));
      console.log(
        chalk.green("  ✓ Generated: tests/playwright/test-plan.template.md"),
      );
    } else {
      const existing = readFileSync(testPlanDest, "utf-8");
      const latest = readFileSync(testPlanSrc, "utf-8");
      if (existing !== latest) {
        writeFileSync(testPlanDest, latest);
        console.log(
          chalk.green("  ✓ Updated: tests/playwright/test-plan.template.md"),
        );
      }
    }
  }

  // 2. Sync app-knowledge.md — generate if missing
  const appKnowledgeSrc = join(
    tmpDir,
    ...(mini
      ? ["templates", "miniprogram", "app-knowledge.md"]
      : ["templates", "app-knowledge.md"]),
  );
  const appKnowledgeDest = join(testsDir, "app-knowledge.md");

  if (existsSync(appKnowledgeSrc) && !existsSync(appKnowledgeDest)) {
    writeFileSync(appKnowledgeDest, readFileSync(appKnowledgeSrc));
    console.log(
      chalk.green("  ✓ Generated: tests/playwright/app-knowledge.md"),
    );
  }

  // 3. Sync seed.spec.ts — warn if content differs (may have user customizations).
  // The mini-program seed is rendered with the resolved home page, so it can
  // never match the raw template; init owns its (re)generation.
  const seedSrc = join(
    tmpDir,
    ...(mini ? ["templates", "miniprogram", "seed.spec.ts"] : ["templates", "seed.spec.ts"]),
  );
  const seedDest = join(testsDir, "seed.spec.ts");

  if (!mini && existsSync(seedSrc) && existsSync(seedDest)) {
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
          "    Remove the file and run 'openspec-pw init' to regenerate.",
        ),
      );
    }
  }

  // 3b. Mini-program import wrapper — content-owned: the file is the single
  // place users upgrade the fixture import, so a modified copy is kept and
  // only a missing one is regenerated.
  if (mini) {
    const wrapperSrc = join(tmpDir, "templates", "miniprogram", "wxa-test.ts");
    const wrapperDest = join(testsDir, "wxa-test.ts");
    if (existsSync(wrapperSrc)) {
      const latest = readFileSync(wrapperSrc, "utf-8");
      if (!existsSync(wrapperDest)) {
        writeFileSync(wrapperDest, latest);
        console.log(chalk.green("  ✓ Generated: tests/playwright/wxa-test.ts"));
      } else if (
        normalizeEol(readFileSync(wrapperDest, "utf-8")) !== normalizeEol(latest)
      ) {
        console.log(
          chalk.yellow(
            "  ⚠ tests/playwright/wxa-test.ts differs from the bundled template — update it manually (the fixture import lives here), or delete it and re-run `openspec-pw init`",
          ),
        );
      }
    }
  }

  // 4. Sync credentials.yaml — preserve user credentials. The mini-program
  // target has no credentials file; login state lives in wxa.setup.ts.
  if (!mini) syncCredentials(tmpDir, projectRoot);

  // (Managed-block maintenance runs at the top of this function — before
  // the minimal-mode early return — see review F4.)
}

/**
 * Sync credentials.yaml — update template structure while preserving user data.
 * Extracts the users array from the existing file, injects it into the latest template.
 */
export function syncCredentials(tmpDir: string, projectRoot: string) {
  const credsSrc = join(tmpDir, "templates", "credentials.yaml");
  const credsDest = join(
    projectRoot,
    "tests",
    "playwright",
    "credentials.yaml",
  );

  if (!existsSync(credsSrc)) return;

  const latest = readFileSync(credsSrc, "utf-8");

  if (!existsSync(credsDest)) {
    mkdirSync(join(projectRoot, "tests", "playwright"), { recursive: true });
    writeFileSync(credsDest, latest);
    console.log(
      chalk.green("  ✓ Generated: tests/playwright/credentials.yaml"),
    );
    // Coverage advisory lives in the managed-block degradation path (4b)
    // — no hint here, or a successful managed-block write would be
    // followed by a stale warning (review S3).
    return;
  }

  const existing = readFileSync(credsDest, "utf-8");
  if (existing === latest) return;

  // Backup existing credentials
  const backupDest = credsDest + ".bak";
  writeFileSync(backupDest, existing);
  console.log(
    chalk.gray(
      `  - Backed up: tests/playwright/credentials.yaml → credentials.yaml.bak`,
    ),
  );

  // Preserve the user's whole users block verbatim. Rebuilding entries from
  // fixed-indent lines loses valid YAML reformatting, and injecting user data
  // through String.replace would expand `$` patterns in names or passwords.
  const existingUsers = extractUsersBlock(existing);
  let updated = latest;
  if (existingUsers !== null && existingUsers.some((line) => line.trim() !== "")) {
    const latestLines = latest.split(/\r?\n/);
    const latestRange = findUsersBlockRange(latestLines);
    if (latestRange) {
      updated = [
        ...latestLines.slice(0, latestRange.start + 1),
        ...existingUsers,
        ...latestLines.slice(latestRange.end),
      ].join("\n");
    }
  }

  writeFileSync(credsDest, updated);
  console.log(
    chalk.green(
      "  ✓ Updated: tests/playwright/credentials.yaml (preserved user data)",
    ),
  );
}

/** Locate the top-level `users:` block; stop at the next top-level key. */
function findUsersBlockRange(
  lines: string[],
): { start: number; end: number } | null {
  const start = lines.findIndex((line) => /^users:\s*(?:#.*)?$/.test(line));
  if (start === -1) return null;
  let end = start + 1;
  while (
    end < lines.length &&
    (lines[end].trim() === "" || /^\s/.test(lines[end]))
  ) {
    end++;
  }
  return { start, end };
}

function extractUsersBlock(text: string): string[] | null {
  const lines = text.split(/\r?\n/);
  const range = findUsersBlockRange(lines);
  if (!range) return null;
  return lines.slice(range.start + 1, range.end);
}

/**
 * Degradation-only advisory (see 4b): printed when the managed-block write
 * fails, listing managed paths still uncovered. The per-write-path calls
 * that used to live in syncCredentials were folded into this single
 * degradation branch (review S3) — a successful managed-block write covers
 * the credentials, so no warning follows a green ✓ line.
 */
function printCredentialsIgnoreHint(
  projectRoot: string,
  skips: readonly string[],
): void {
  const uncovered = findUncoveredManagedPaths(projectRoot, [
    ...pipelineGitignoreOmit(projectRoot),
    ...skips,
  ]);
  if (uncovered.length > 0) {
    console.log(chalk.yellow(`\n  ⚠ ${managedBlockAdvisoryHint(uncovered)}`));
  }
}
