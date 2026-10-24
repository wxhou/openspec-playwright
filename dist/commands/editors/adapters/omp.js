/**
 * Oh My Pi adapter: native command at `.omp/commands/opsx-<id>.md`
 * (FATAL frontmatter parsing — keep YAML valid); MCP in `.omp/mcp.json`.
 * Detected via `.omp/` or global `~/.omp/agent/`.
 */
import { join } from "path";
import { defineAdapter } from "../declaration.js";
import { formatArtifact } from "../shared.js";
import { registerAdapter } from "../registry.js";
// ─── Oh My Pi adapter ────────────────────────────────────────────────────
export function getOmpCommandPath(id) {
    return join(".omp", "commands", `opsx-${id}.md`);
}
/**
 * Oh My Pi (omp) stores project slash commands in `.omp/commands/*.md`
 * (non-recursive scan, project before user). Native commands are parsed
 * with FATAL frontmatter parsing, so the YAML must be valid; `name`
 * overrides the filename and `description` feeds autocomplete. `$1` /
 * `$ARGUMENTS` placeholders expand at prompt time.
 *
 * Conventions follow the omp docs (docs/slash-command-internals.md,
 * docs/mcp-config.md):
 *   - Commands:  `.omp/commands/*.md`, invoked via `/name`.
 *   - MCP:       `.omp/mcp.json` with `{ "mcpServers": { ... } }` — same
 *                shape as Cline/Cursor. omp also inherits `.claude/` /
 *                `.cursor/` / opencode MCP configs when present.
 *   - Rules:     omp reads `AGENTS.md` natively — no wrapper file needed.
 */
const OMP_ARTIFACT = {
    path: getOmpCommandPath,
    naming: "hyphen-prefix",
    frontmatter: { name: true, description: true },
};
const ompDeclaration = {
    id: "omp",
    label: "omp",
    displayName: "Oh My Pi",
    artifacts: [OMP_ARTIFACT],
    detection: {
        projectPaths: [".omp"],
        // Global install root is a pre-select suggestion, never a write
        // authorization.
        globalPaths: [join(".omp", "agent")],
    },
    mcp: {
        kind: "mcp-servers-file",
        path: (root) => join(root, ".omp", "mcp.json"),
    },
};
export const ompAdapter = defineAdapter(ompDeclaration);
// ─── Named exports (derived from the declaration) ────────────────────────
export function formatOmpCommand(meta) {
    return formatArtifact(OMP_ARTIFACT, meta);
}
export function hasOmp(projectRoot, homeDir) {
    return ompAdapter.detect(projectRoot, homeDir);
}
registerAdapter(ompAdapter);
//# sourceMappingURL=omp.js.map