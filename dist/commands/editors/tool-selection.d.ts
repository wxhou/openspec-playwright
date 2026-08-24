/**
 * `--tools` flag parsing for `openspec-pw init` — mirrors upstream
 * OpenSpec semantics (all | none | comma-separated ids).
 */
import type { EditorId } from "./types.js";
/**
 * Parse the `--tools` flag value for `openspec-pw init`.
 *
 * Returns the selected editor ids, or `null` when the flag was not provided.
 * Mirrors the upstream OpenSpec `openspec init --tools` semantics:
 *   - "all" → every registered editor
 *   - "none" → no editors
 *   - comma-separated ids, case-insensitive; "oh-my-pi" aliases "omp"
 *   - mixing "all"/"none" with specific ids, or unknown ids, throw
 *   - duplicate ids are deduplicated preserving first-occurrence order
 */
export declare function resolveToolsArg(toolsArg: string | undefined): EditorId[] | null;
