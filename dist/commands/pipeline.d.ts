export declare const AUTO_PIPELINE_REL: string;
export declare const AUTO_PIPELINE_TEMPLATE = "auto-pipeline.yml";
/**
 * Paths the pipeline needs committed: CI checks out the repository, and
 * without the OpenSpec artifacts in the tree there is no change to apply,
 * validate or test. `openspec/` therefore must not be git-ignored.
 */
export declare const PIPELINE_TRACKED_PATHS: readonly ["openspec/"];
/**
 * Paths the managed .gitignore block must leave committable for this
 * project. Empty unless the pipeline workflow is already installed — a
 * later `openspec-pw update` must not re-ignore the OpenSpec artifacts.
 */
export declare function pipelineGitignoreOmit(projectRoot: string): string[];
export type GenerateResult = {
    status: "created";
    path: string;
} | {
    status: "exists";
    path: string;
} | {
    error: string;
};
export declare function generateAutoPipeline(projectRoot: string): GenerateResult;
/**
 * Branch protection is a repository setting, so the tool can only tell the
 * operator about it. Without it a red PR still merges, and the "only a human
 * reviews the PR" gate is decoration.
 */
export declare const BRANCH_PROTECTION_HINT: string;
