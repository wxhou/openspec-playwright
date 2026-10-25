/**
 * Generates the autonomous pipeline workflow.
 *
 * The tool writes the file once and never touches it again — a workflow is
 * something teams edit, so silently regenerating it would be destructive.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "templates");
export const AUTO_PIPELINE_REL = join(".github", "workflows", "openspec-auto.yml");
export const AUTO_PIPELINE_TEMPLATE = "auto-pipeline.yml";
/**
 * Paths the pipeline needs committed: CI checks out the repository, and
 * without the OpenSpec artifacts in the tree there is no change to apply,
 * validate or test. `openspec/` therefore must not be git-ignored.
 */
export const PIPELINE_TRACKED_PATHS = ["openspec/"];
/**
 * Paths the managed .gitignore block must leave committable for this
 * project. Empty unless the pipeline workflow is already installed — a
 * later `openspec-pw update` must not re-ignore the OpenSpec artifacts.
 */
export function pipelineGitignoreOmit(projectRoot) {
    return existsSync(join(projectRoot, AUTO_PIPELINE_REL))
        ? [...PIPELINE_TRACKED_PATHS]
        : [];
}
export function generateAutoPipeline(projectRoot) {
    const target = join(projectRoot, AUTO_PIPELINE_REL);
    if (existsSync(target))
        return { status: "exists", path: target };
    const source = join(TEMPLATE_DIR, AUTO_PIPELINE_TEMPLATE);
    if (!existsSync(source)) {
        return { error: `pipeline template not found: ${source}` };
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(source, "utf-8"), "utf-8");
    return { status: "created", path: target };
}
/**
 * Branch protection is a repository setting, so the tool can only tell the
 * operator about it. Without it a red PR still merges, and the "only a human
 * reviews the PR" gate is decoration.
 */
export const BRANCH_PROTECTION_HINT = [
    "Branch protection is a repository setting and cannot be changed from here.",
    "Mark the `gate` job as a required status check:",
    "  Settings → Branches → Branch protection rules → Require status checks → gate",
    "Until then a PR with a red gate can still be merged.",
].join("\n");
//# sourceMappingURL=pipeline.js.map