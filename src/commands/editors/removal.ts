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
import { dirname, join } from "path";
import chalk from "chalk";
import { buildCommandMeta, type EditorAdapter } from "./types.js";
import { listCommandArtifactPaths } from "./registry.js";
import { removeMarkersFromFile } from "./project-rules.js";
import { LEGACY_OPENSPEC_START, OPENSPEC_START } from "../../shared/drift.js";

// ─── MCP server names owned by openspec-pw ───────────────────────────────

/**
 * The Playwright MCP servers openspec-pw manages. `playwright-test` is the
 * official test-runner server installed today; `playwright` is the legacy
 * @playwright/mcp entry older versions wrote (uninstall removes both).
 * Literals here rather than importing shared/mcp.ts, which imports the
 * editors facade that re-exports this module (import cycle).
 */
export const OPENSPEC_PW_MCP_SERVERS = ["playwright-test", "playwright"] as const;

/** The claude-only skill directory retired installs left behind. */
export const CLAUDE_LEGACY_SKILL_REL = join(".claude", "skills", "openspec-e2e");

// ─── Dry enumeration (read-only, never prints) ───────────────────────────

export interface AdapterArtifactInventory {
  /** Existing openspec-pw command/skill artifact paths (project-relative). */
  commandPaths: string[];
  /** Claude-only legacy skill dir, when present (project-relative). */
  legacySkillPath: string | null;
  /** openspec-pw MCP server entries present in this editor's config. */
  mcpServers: string[];
  /** True when CLAUDE.md holds an openspec-pw wrapper block (claude only). */
  hasClaudeWrapper: boolean;
}

/** Does CLAUDE.md carry an openspec-pw marker block we could remove? */
function claudeWrapperHasMarkers(projectRoot: string): boolean {
  const dest = join(projectRoot, "CLAUDE.md");
  if (!existsSync(dest)) return false;
  // A symlinked CLAUDE.md (typically → AGENTS.md) is never cleaned through —
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
): AdapterArtifactInventory {
  const meta = buildCommandMeta("");
  const commandPaths = listCommandArtifactPaths(adapter, meta).filter((rel) =>
    existsSync(join(projectRoot, rel)),
  );
  const legacySkillPath =
    adapter.id === "claude" && existsSync(join(projectRoot, CLAUDE_LEGACY_SKILL_REL))
      ? CLAUDE_LEGACY_SKILL_REL
      : null;
  const mcpServers =
    adapter.supportsMcp === false
      ? []
      : OPENSPEC_PW_MCP_SERVERS.filter((server) =>
          adapter.isMcpInstalled(projectRoot, server),
        );
  const hasClaudeWrapper =
    adapter.id === "claude" && claudeWrapperHasMarkers(projectRoot);
  return { commandPaths, legacySkillPath, mcpServers, hasClaudeWrapper };
}

/** True when this editor has nothing for init to remove. */
export function isInventoryEmpty(inv: AdapterArtifactInventory): boolean {
  return (
    inv.commandPaths.length === 0 &&
    inv.legacySkillPath === null &&
    inv.mcpServers.length === 0 &&
    !inv.hasClaudeWrapper
  );
}

// ─── Delete functions (small, single-purpose) ────────────────────────────

/**
 * Remove the openspec-pw MCP entries for one editor. Only entries passed in
 * `servers` (the enumeration result) are touched — user-owned server entries
 * in the same config file are never written to.
 */
export function removeAdapterMcp(
  adapter: EditorAdapter,
  projectRoot: string,
  servers: readonly string[],
): void {
  if (adapter.supportsMcp === false) return;
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

/** Delete claude's retired-install skill directory. Returns the path or null. */
export function removeClaudeLegacySkill(projectRoot: string): string | null {
  const absPath = join(projectRoot, CLAUDE_LEGACY_SKILL_REL);
  if (!existsSync(absPath)) return null;
  rmSync(absPath, { recursive: true, force: true });
  cleanupEmptyDirs(dirname(absPath), projectRoot);
  console.log(chalk.green(`  ✓ claude: ${CLAUDE_LEGACY_SKILL_REL}/`));
  return CLAUDE_LEGACY_SKILL_REL;
}

/**
 * Remove the openspec-pw wrapper block from CLAUDE.md (claude-owned
 * territory). Skips symlinked CLAUDE.md entirely — writing through the
 * symlink would strip the shared block out of AGENTS.md.
 */
export function removeClaudeWrapper(projectRoot: string): string | null {
  const dest = join(projectRoot, "CLAUDE.md");
  if (!existsSync(dest)) return null;
  if (lstatSync(dest).isSymbolicLink()) {
    console.log(
      chalk.gray(
        "  - CLAUDE.md is a symlink — skipping wrapper cleanup (would write through to AGENTS.md)",
      ),
    );
    return null;
  }
  removeMarkersFromFile(dest, "CLAUDE.md");
  return "CLAUDE.md";
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