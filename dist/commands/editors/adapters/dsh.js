/**
 * DeepSeek Harness adapter: skill bundle at `.dsh/skills/opsx-<id>/SKILL.md`
 * (project-dsh root, rank 100).
 *
 * dsh has no project-level MCP carrier — it configures MCP servers through
 * per-user profile patch layers under $DSH_HOME, disabled by default — so the
 * adapter declares `mcp: { kind: "none" }` and shared MCP phases skip it.
 *
 * No artifact-root detection tier: `.dsh/skills` sits inside `.dsh/`, so the
 * marker directory would always match first.
 *
 * Project rules: dsh loads `AGENTS.md` / `CLAUDE.md` natively — no wrapper.
 */
import { join } from "path";
import { defineAdapter } from "../declaration.js";
import { formatArtifact } from "../shared.js";
import { registerAdapter } from "../registry.js";
// ─── DeepSeek Harness adapter ────────────────────────────────────────────
export function getDshSkillPath(id) {
    return join(".dsh", "skills", `opsx-${id}`, "SKILL.md");
}
const DSH_SKILL = {
    path: getDshSkillPath,
    naming: "hyphen-prefix",
    frontmatter: { name: true, description: true },
};
const dshDeclaration = {
    id: "dsh",
    label: "dsh",
    displayName: "DeepSeek Harness",
    artifacts: [DSH_SKILL],
    detection: {
        projectPaths: [".dsh"],
        // ~/.dsh (DSH_HOME) — any-scope detection only, never a write authorization.
        globalPaths: [".dsh"],
    },
    mcp: { kind: "none" },
};
export const dshAdapter = defineAdapter(dshDeclaration);
// ─── Named exports (derived from the declaration) ────────────────────────
export function formatDshSkill(meta) {
    return formatArtifact(DSH_SKILL, meta);
}
export function hasDsh(projectRoot, homeDir) {
    return dshAdapter.detect(projectRoot, homeDir);
}
export function hasDshProjectSignal(projectRoot) {
    return dshAdapter.projectSignal(projectRoot);
}
registerAdapter(dshAdapter);
//# sourceMappingURL=dsh.js.map