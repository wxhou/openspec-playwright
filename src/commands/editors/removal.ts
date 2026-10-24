/**
 * Per-editor artifact removal primitives.
 *
 * Shared by two callers with different output styles:
 *   - `init` (deselect = remove): enumerates the openspec-pw products of
 *     deselected editors, prints one confirmation list, then removes.
 *   - `uninstall` (full cleanup): calls the same small delete functions
 *     inside its existing section-major loop (all MCP → all commands →
 *     legacy → rules), so its log order stays unchanged.
 *
 * The enumerate side is strictly read-only — it never prints and never
 * writes — so it doubles as the dry-run source for init's confirm list.
 * The delete side is composed of small single-purpose functions instead of
 * one monolithic `removeAdapterArtifacts` because a monolith would reorder
 * uninstall's section-major output and the MCP removal helpers in
 * shared/mcp.ts print their own status lines (unusable for dry enumeration).
 */
import { existsSync, lstatSync, readFileSync, readdirSync, rmSync, rmdirSync } from "fs";
import { dirname, join, basename } from "path";
import chalk from "chalk";
import { buildCommandMeta, type EditorAdapter } from "./types.js";
import { listCommandArtifactPaths } from "./registry.js";
import { removeMarkersFromFile, wrapperRulesFile } from "./project-rules.js";
import { LEGACY_OPENSPEC_START, OPENSPEC_START } from "../../shared/drift.js";
import { enumerateVendoredAgents, installedAgentsSnapshotDir } from "./agents.js";
import { CLAUDE_LEGACY_SKILL_REL } from "./shared.js";

// ─── MCP server names owned by openspec-pw ───────────────────────────────

/**
 * The Playwright MCP servers openspec-pw manages. `playwright-test` is the
 * official test-runner server installed today; `playwright` is the legacy
 * @playwright/mcp entry older versions wrote (uninstall removes both).
 * Literals here rather than importing shared/mcp.ts, which imports the
 * editors facade that re-exports this module (import cycle).
 */
export const OPENSPEC_PW_MCP_SERVERS = ["playwright-test", "playwright"] as const;

/** Re-exported for uninstall's fixed historical cleanup and the facade. */
export { CLAUDE_LEGACY_SKILL_REL };

// ─── Dry enumeration (read-only, never prints) ───────────────────────────

export interface AdapterArtifactInventory {
  /** Existing openspec-pw command/skill artifact paths (project-relative). */
  commandPaths: string[];
  /** Declared legacy artifact directories that exist (project-relative). */
  legacyArtifacts: string[];
  /** openspec-pw MCP server entries present in this editor's config. */
  mcpServers: string[];
  /**
   * openspec-pw MCP server entries present in this editor's config that are
   * KEPT because a still-selected editor shares the same MCP config file.
   */
  retainedMcpServers: string[];
  /** True when the adapter's wrapper file (CLAUDE.md / CODEBUDDY.md) holds an openspec-pw wrapper block. */
  hasWrapper: boolean;
}

// ─── Shared MCP config files (multi-editor consumers) ─────────────────────

/**
 * The MCP config files still depended on by the editors that remain selected.
 *
 * Several editors share one MCP config file — Claude Code, CodeBuddy CLI and
 * MiniMax Code all use the project-root `.mcp.json` — so an MCP entry in a
 * shared file serves every one of them. Removing it while another editor
 * still depends on that file would silently break that editor's Playwright
 * MCP, so the removal phase keeps it.
 */
export function retainedMcpConfigFiles(
  selected: readonly EditorAdapter[],
  projectRoot: string,
): Set<string> {
  const files = new Set<string>();
  for (const adapter of selected) {
    if (adapter.supportsMcp === false) continue;
    const path = adapter.mcpConfigPath?.(projectRoot);
    if (path) files.add(path);
  }
  return files;
}

/** True when this adapter's MCP entries live in a file another editor still needs. */
function isMcpFileRetained(
  adapter: EditorAdapter,
  projectRoot: string,
  retainedFiles: ReadonlySet<string> | undefined,
): boolean {
  if (!retainedFiles || retainedFiles.size === 0) return false;
  const path = adapter.mcpConfigPath?.(projectRoot);
  return !!path && retainedFiles.has(path);
}

/** Does the adapter's wrapper file carry an openspec-pw marker block we could remove? */
function wrapperFileHasMarkersForRemoval(
  adapter: EditorAdapter,
  projectRoot: string,
): boolean {
  const wrapper = wrapperRulesFile(adapter, projectRoot);
  if (!wrapper) return false;
  const dest = join(projectRoot, basename(wrapper));
  if (!existsSync(dest)) return false;
  // A symlinked wrapper (typically → AGENTS.md) is never cleaned through —
  // enumeration follows the same guard the removal does.
  if (lstatSync(dest).isSymbolicLink()) return false;
  const content = readFileSync(dest, "utf-8");
  return content.includes(OPENSPEC_START) || content.includes(LEGACY_OPENSPEC_START);
}

/**
 * Enumerate the openspec-pw artifacts one editor owns in this project —
 * command/skill files (incl. extraArtifacts), MCP server entries, the
 * claude-only legacy skill dir and wrapper. Read-only and silent: this is
 * the source for init's confirmation list, so it must not write, delete,
 * or print.
 */
export function enumerateAdapterArtifacts(
  adapter: EditorAdapter,
  projectRoot: string,
  retainedFiles?: ReadonlySet<string>,
): AdapterArtifactInventory {
  const meta = buildCommandMeta("");
  const commandPaths = listCommandArtifactPaths(adapter, meta).filter((rel) =>
    existsSync(join(projectRoot, rel)),
  );
  const legacyArtifacts = (adapter.declaration?.legacyArtifacts ?? []).filter(
    (rel) => existsSync(join(projectRoot, rel)),
  );
  const installedMcpServers =
    adapter.supportsMcp === false
      ? []
      : OPENSPEC_PW_MCP_SERVERS.filter((server) =>
          adapter.isMcpInstalled(projectRoot, server),
        );
  // An MCP entry in a shared config file is kept while another selected
  // editor depends on that file — it is reported separately so the confirm
  // list never promises a removal that will not happen.
  const sharedFile = isMcpFileRetained(adapter, projectRoot, retainedFiles);
  const mcpServers = sharedFile ? [] : installedMcpServers;
  const retainedMcpServers = sharedFile ? installedMcpServers : [];
  const hasWrapper =
    wrapperRulesFile(adapter, projectRoot) !== null &&
    wrapperFileHasMarkersForRemoval(adapter, projectRoot);
  return { commandPaths, legacyArtifacts, mcpServers, retainedMcpServers, hasWrapper };
}

/** True when this editor has nothing for init to remove. */
export function isInventoryEmpty(inv: AdapterArtifactInventory): boolean {
  return (
    inv.commandPaths.length === 0 &&
    inv.legacyArtifacts.length === 0 &&
    inv.mcpServers.length === 0 &&
    inv.retainedMcpServers.length === 0 &&
    !inv.hasWrapper
  );
}

// ─── Delete functions (small, single-purpose) ────────────────────────────

/**
 * Remove the openspec-pw MCP entries for one editor. Only entries passed in
 * `servers` (the enumeration result) are touched — user-owned server entries
 * in the same config file are never written to.
 *
 * When `retainedFiles` names this editor's MCP config file, the entries are
 * kept: a still-selected editor shares that file and depends on the entry.
 */
export function removeAdapterMcp(
  adapter: EditorAdapter,
  projectRoot: string,
  servers: readonly string[],
  retainedFiles?: ReadonlySet<string>,
): void {
  if (adapter.supportsMcp === false) return;
  if (isMcpFileRetained(adapter, projectRoot, retainedFiles)) {
    if (servers.length > 0) {
      console.log(
        chalk.gray(
          `  - ${adapter.label}: ${servers.join(", ")} MCP kept (shared config file still used by a selected editor)`,
        ),
      );
    }
    return;
  }
  for (const serverName of servers) {
    try {
      adapter.removeMcp(projectRoot, serverName);
      console.log(chalk.green(`  ✓ ${adapter.label}: ${serverName} MCP removed`));
    } catch {
      // Same posture as uninstall: claude CLI missing/degraded warns, never throws.
      console.warn(chalk.yellow(`  ⚠ ${adapter.label}: failed to remove ${serverName} MCP`));
    }
  }
}

/** Delete one editor's openspec-pw command/skill files. Returns the removed project-relative paths. */
export function removeAdapterCommandArtifacts(
  adapter: EditorAdapter,
  projectRoot: string,
): string[] {
  const meta = buildCommandMeta("");
  const removed: string[] = [];
  for (const relPath of listCommandArtifactPaths(adapter, meta)) {
    const absPath = join(projectRoot, relPath);
    if (existsSync(absPath)) {
      rmSync(absPath);
      cleanupEmptyDirs(dirname(absPath), projectRoot);
      console.log(chalk.green(`  ✓ ${adapter.label}: ${relPath}`));
      removed.push(relPath);
    }
  }
  return removed;
}

/**
 * Remove the tool-owned vendored Playwright agent files (claude; init
 * deselection + uninstall). User-owned files are never deleted — each is
 * reported as kept-modified. Returns the removed project-relative paths.
 */
export function removeOwnedVendoredAgents(
  projectRoot: string,
  adapter: EditorAdapter,
): string[] {
  if (!adapter.optionalArtifacts) return [];
  const { owned, modified } = enumerateVendoredAgents(
    projectRoot,
    installedAgentsSnapshotDir(),
  );
  const removed: string[] = [];
  for (const relPath of owned) {
    const absPath = join(projectRoot, relPath);
    if (!existsSync(absPath)) continue;
    rmSync(absPath);
    cleanupEmptyDirs(dirname(absPath), projectRoot);
    console.log(chalk.green(`  ✓ ${adapter.label}: ${relPath}`));
    removed.push(relPath);
  }
  for (const relPath of modified) {
    console.log(
      chalk.gray(
        `  - ${adapter.label}: ${relPath} kept (differs from the bundled snapshot — not openspec-pw-owned)`,
      ),
    );
  }
  return removed;
}

/**
 * Delete one legacy artifact directory declared by the adapter. Returns the
 * removed project-relative path, or null when it does not exist.
 */
export function removeLegacyArtifact(
  adapter: EditorAdapter,
  projectRoot: string,
  relPath: string,
): string | null {
  const absPath = join(projectRoot, relPath);
  if (!existsSync(absPath)) return null;
  rmSync(absPath, { recursive: true, force: true });
  cleanupEmptyDirs(dirname(absPath), projectRoot);
  console.log(chalk.green(`  ✓ ${adapter.label}: ${relPath}/`));
  return relPath;
}

/**
 * Remove the openspec-pw wrapper block from the adapter's wrapper file
 * (CLAUDE.md for claude, CODEBUDDY.md for codebuddy — adapter-owned
 * territory). Skips symlinked wrappers entirely — writing through the
 * symlink would strip the shared block out of AGENTS.md.
 */
export function removeWrapper(adapter: EditorAdapter, projectRoot: string): string | null {
  const wrapper = wrapperRulesFile(adapter, projectRoot);
  if (!wrapper) return null;
  const dest = join(projectRoot, basename(wrapper));
  if (!existsSync(dest)) return null;
  if (lstatSync(dest).isSymbolicLink()) {
    console.log(
      chalk.gray(
        `  - ${basename(wrapper)} is a symlink — skipping wrapper cleanup (would write through to AGENTS.md)`,
      ),
    );
    return null;
  }
  removeMarkersFromFile(dest, basename(wrapper));
  return basename(wrapper);
}

/**
 * Delete empty directories up to (not including) `stopAt`. Moved here from
 * uninstall.ts so both the section loop and the per-editor removals share it.
 */
export function cleanupEmptyDirs(dir: string, stopAt: string): void {
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