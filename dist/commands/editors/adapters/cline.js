/**
 * Cline adapter: `.cline/skills/opsx-<id>/SKILL.md` with name+description
 * frontmatter; MCP lives in `.cline/mcp.json`. Cline auto-detects
 * AGENTS.md as project rules — no wrapper file needed.
 */
import { join } from "path";
import { defineAdapter } from "../declaration.js";
import { formatArtifact } from "../shared.js";
import { registerAdapter } from "../registry.js";
// ─── Cline adapter ───────────────────────────────────────────────────────
export function getClineCommandPath(id) {
    return join(".cline", "skills", `opsx-${id}`, "SKILL.md");
}
/**
 * Cline's skill artifact. The shared `formatArtifact` keeps Cline and
 * MiniMax Code byte-identical for the same shape.
 *
 * Cline stores project-level config in `.cline/` (skills/, rules/, mcp.json).
 * `.clinerules/` is the legacy rules-only directory, still auto-detected.
 */
const CLINE_ARTIFACT = {
    path: getClineCommandPath,
    naming: "hyphen-prefix",
    frontmatter: { name: true, description: true },
};
const clineDeclaration = {
    id: "cline",
    label: "cline",
    displayName: "Cline",
    artifacts: [CLINE_ARTIFACT],
    detection: { projectPaths: [".cline", ".clinerules"] },
    mcp: {
        kind: "mcp-servers-file",
        path: (root) => join(root, ".cline", "mcp.json"),
    },
};
export const clineAdapter = defineAdapter(clineDeclaration);
// ─── Named exports (derived from the declaration) ────────────────────────
export function formatClineCommand(meta) {
    return formatArtifact(CLINE_ARTIFACT, meta);
}
export function hasCline(projectRoot, homeDir) {
    return clineAdapter.detect(projectRoot, homeDir);
}
registerAdapter(clineAdapter);
//# sourceMappingURL=cline.js.map