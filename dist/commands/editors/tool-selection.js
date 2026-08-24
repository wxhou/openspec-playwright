import { getAllAdapters } from "./registry.js";
// ─── Tool selection (--tools flag) ───────────────────────────────────────
/** Aliases accepted by `--tools` in addition to canonical EditorIds. */
const TOOL_ID_ALIASES = {
    "oh-my-pi": "omp",
};
const RESERVED_TOOLS = new Set(["all", "none"]);
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
export function resolveToolsArg(toolsArg) {
    if (typeof toolsArg === "undefined")
        return null;
    const raw = toolsArg.trim();
    if (raw.length === 0) {
        throw new Error('The --tools option requires a value. Use "all", "none", or a comma-separated list of editor ids.');
    }
    const editorIds = getAllAdapters().map((a) => a.id);
    const availableList = ["all", "none", ...editorIds].join(", ");
    const lowerRaw = raw.toLowerCase();
    if (lowerRaw === "all")
        return [...editorIds];
    if (lowerRaw === "none")
        return [];
    const tokens = raw
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    if (tokens.length === 0) {
        throw new Error('The --tools option requires at least one editor id when not using "all" or "none".');
    }
    const normalized = tokens.map((t) => {
        const lower = t.toLowerCase();
        return TOOL_ID_ALIASES[lower] ?? lower;
    });
    if (normalized.some((t) => RESERVED_TOOLS.has(t))) {
        throw new Error('Cannot combine reserved values "all" or "none" with specific editor ids.');
    }
    const invalid = normalized.filter((t) => !editorIds.includes(t));
    if (invalid.length > 0) {
        throw new Error(`Invalid tool id(s): ${invalid.join(", ")}. Available values: ${availableList}`);
    }
    // Deduplicate while preserving order
    const deduped = [];
    for (const id of normalized) {
        const editorId = id;
        if (!deduped.includes(editorId))
            deduped.push(editorId);
    }
    return deduped;
}
//# sourceMappingURL=tool-selection.js.map