/**
 * Pre-select-only intent-file signals for the interactive first-run tier.
 *
 * A root project-intent file (documented convention of the editor itself)
 * says "this project is configured for that editor" even before the
 * editor's marker directory exists. Each adapter declares these paths in
 * `detection.intentPaths`; they feed ONLY the interactive first-run
 * pre-select — deliberately NOT `projectSignal`/`detectProjectAdapters`:
 * the non-TTY fallback and write authorization stay marker-directory-only
 * (see the Non-interactive fallback requirement in
 * openspec/specs/init-tool-selection/spec.md).
 *
 * Precision notes (design D5): Pi also reads a root CLAUDE.md natively, so
 * a Pi-first project with only that file is a known residual false positive
 * (correctable by deselecting). `.cursor/rules/*.mdc` is excluded — its
 * existence implies `.cursor/`, so the marker signal already covers it.
 * AGENTS.md is excluded — every editor reads it, no discriminating power.
 */
import { existsSync } from "fs";
import { join } from "path";
import { getAllAdapters } from "./registry.js";
/** Editors whose declared root intent files exist in the project. */
export function intentFileEditors(projectRoot) {
    const hits = [];
    for (const adapter of getAllAdapters()) {
        const intentPaths = adapter.declaration?.detection.intentPaths ?? [];
        if (intentPaths.some((p) => existsSync(join(projectRoot, p)))) {
            hits.push(adapter.id);
        }
    }
    return hits;
}
//# sourceMappingURL=preselect.js.map