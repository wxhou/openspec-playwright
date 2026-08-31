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
import { join } from "path";
import type { EditorAdapter } from "./types.js";
import { hasCommandArtifacts } from "./registry.js";
import { enumerateAdapterArtifacts, isInventoryEmpty } from "./removal.js";
import {
  hasLegacyTerritoryStart,
  LEGACY_OPENSPEC_END,
  LEGACY_OPENSPEC_START,
  OPENSPEC_START,
} from "../../shared/drift.js";
import { LEGACY_MAIN_SIGNATURE } from "./project-rules.js";

/**
 * True when openspec-pw has configured this editor in the project: any
 * command/extraArtifacts product, any openspec-pw MCP entry, or (claude
 * only) the legacy skill directory from pre-0.3.74 installs.
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
  return !isInventoryEmpty(enumerateAdapterArtifacts(adapter, projectRoot));
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