import type { EditorAdapter } from "./types.js";
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
export declare function isEditorConfigured(adapter: EditorAdapter, projectRoot: string): boolean;
/** True when any of the adapters has been configured in this project. */
export declare function anyEditorConfigured(adapters: readonly EditorAdapter[], projectRoot: string): boolean;
/**
 * Does AGENTS.md carry an openspec-pw marker block we own? Our namespace
 * (OPENSPEC-PW) always counts. A *legacy* `OPENSPEC:` block counts only
 * when its content carries our migration signature — the same gate the
 * migration path uses — because that namespace is shared with the official
 * `@fission-ai/openspec` CLI, whose standard init block must not suppress
 * this project's first-run bypass.
 */
export declare function agentsFileHasMarkers(projectRoot: string): boolean;
