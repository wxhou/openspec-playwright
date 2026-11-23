/**
 * "Has this editor been configured by openspec-pw?" predicates.
 *
 * The init interactive pre-select reads these instead of detect() — the
 * detection signal (marker-directory presence) is kept alive by foreign
 * content (the official openspec CLI's own opsx-* files, the user's own
 * config, Pi/Oh My Pi global home dirs), so a deselected editor would stay
 * pre-checked forever. The authorization gate (update/doctor
 * hasCommandArtifacts) and the pre-select now share one source of truth:
 * openspec-pw products on disk.
 */
import { existsSync, readFileSync } from "fs";
import { join, resolve as pathResolve } from "path";
import type { EditorAdapter } from "./types.js";
import { buildCommandMeta } from "./types.js";
import { getAllAdapters, hasCommandArtifacts } from "./registry.js";
import { enumerateAdapterArtifacts } from "./removal.js";
import {
  hasLegacyTerritoryStart,
  LEGACY_OPENSPEC_END,
  LEGACY_OPENSPEC_START,
  OPENSPEC_START,
} from "../../shared/drift.js";
import { LEGACY_MAIN_SIGNATURE } from "./project-rules.js";

/**
 * True when the adapter's own project marker directory exists (e.g. `.codex/`,
 * `.minimax/`). Deliberately excludes `artifactRoots` and `globalPaths`: a
 * shared artifact or a home-dir install cannot prove project ownership.
 */
function hasExclusiveProjectSignal(
  adapter: EditorAdapter,
  projectRoot: string,
): boolean {
  const paths = adapter.declaration?.detection.projectPaths ?? [];
  return paths.some((rel) => existsSync(pathResolve(projectRoot, rel)));
}

/** True when another adapter resolves its MCP config to the same file. */
export function isSharedMcpConfigPath(
  adapter: EditorAdapter,
  projectRoot: string,
): boolean {
  const own = adapter.mcpConfigPath?.(projectRoot);
  if (!own) return false;
  const ownResolved = pathResolve(own);
  return getAllAdapters().some((other) => {
    if (other.id === adapter.id) return false;
    const otherPath = other.mcpConfigPath?.(projectRoot);
    return otherPath !== undefined && pathResolve(otherPath) === ownResolved;
  });
}

/**
 * Shared artifact ownership: attribute a shared path to the adapter only when
 * no other declarer has an exclusive project signal; when none does, the file
 * cannot prove ownership and every declarer may claim it (all pre-selected —
 * one unchecked box is reversible, a missing editor is not).
 */
function hasAttributedSharedArtifact(
  adapter: EditorAdapter,
  projectRoot: string,
): boolean {
  const meta = buildCommandMeta("");
  for (const artifact of adapter.declaration?.artifacts ?? []) {
    if (!artifact.shared) continue;
    const rel = artifact.path(meta.id);
    if (!existsSync(pathResolve(projectRoot, rel))) continue;
    const declarers = getAllAdapters().filter((other) =>
      (other.declaration?.artifacts ?? []).some(
        (candidate) => candidate.shared && candidate.path(meta.id) === rel,
      ),
    );
    const signalHolders = declarers.filter((other) =>
      hasExclusiveProjectSignal(other, projectRoot),
    );
    if (
      signalHolders.length === 0 ||
      signalHolders.some((other) => other.id === adapter.id)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * True when openspec-pw has configured this editor in the project: any
 * command/extraArtifacts product, any openspec-pw MCP entry, or (claude
 * only) the legacy skill directory from pre-0.3.74 installs.
 *
 * Shared paths are attributed by ownership: a shared command artifact counts
 * only when no other declarer owns it via an exclusive project signal; a
 * shared MCP config file's entry counts only when the adapter also has an
 * exclusive project signal. A single `.mcp.json` entry therefore no longer
 * pre-selects every editor that reads that file.
 *
 * Intentionally a *wider* signal than update/doctor's authorization gate
 * (hasCommandArtifacts, command artifacts only): an editor carrying only an
 * openspec-pw MCP entry is "configured" here so it stays pre-selected, while
 * write authorization still requires real command products.
 */
export function isEditorConfigured(
  adapter: EditorAdapter,
  projectRoot: string,
): boolean {
  if (hasCommandArtifacts(projectRoot, adapter)) return true;
  // Shared artifacts (Codex + MiniMax `.agents/skills`) are excluded by
  // hasCommandArtifacts; the inventory's commandPaths must not re-introduce
  // them here either. Only non-command signals count.
  const inv = enumerateAdapterArtifacts(adapter, projectRoot);
  const mcpSignal =
    inv.mcpServers.length > 0 &&
    (!isSharedMcpConfigPath(adapter, projectRoot) ||
      hasExclusiveProjectSignal(adapter, projectRoot));
  return (
    inv.legacyArtifacts.length > 0 ||
    mcpSignal ||
    inv.hasWrapper ||
    inv.hasFullRules ||
    hasAttributedSharedArtifact(adapter, projectRoot)
  );
}

/** True when any of the adapters has been configured in this project. */
export function anyEditorConfigured(
  adapters: readonly EditorAdapter[],
  projectRoot: string,
): boolean {
  return adapters.some((a) => isEditorConfigured(a, projectRoot));
}

/**
 * Does AGENTS.md carry an openspec-pw marker block we own? Our namespace
 * (OPENSPEC-PW) always counts. A *legacy* `OPENSPEC:` block counts only
 * when its content carries our migration signature — the same gate the
 * migration path uses — because that namespace is shared with the official
 * `@fission-ai/openspec` CLI, whose standard init block must not suppress
 * this project's first-run bypass.
 */
export function agentsFileHasMarkers(projectRoot: string): boolean {
  const agentsPath = join(projectRoot, "AGENTS.md");
  if (!existsSync(agentsPath)) return false;
  const content = readFileSync(agentsPath, "utf-8");
  if (content.includes(OPENSPEC_START)) return true;
  if (!hasLegacyTerritoryStart(content)) return false;
  const startIdx = content.indexOf(LEGACY_OPENSPEC_START);
  const endIdx = content.indexOf(LEGACY_OPENSPEC_END);
  // Bounded legacy block: check the inner content; a lone/truncated START
  // falls back to "anything after it" — same posture as the migration gate.
  const inner =
    endIdx !== -1 && endIdx > startIdx
      ? content.slice(startIdx + LEGACY_OPENSPEC_START.length, endIdx)
      : content.slice(startIdx);
  return inner.includes(LEGACY_MAIN_SIGNATURE);
}