import type { EditorAdapter, EditorId } from "./editors.js";
import { type LintConfigResult } from "../shared/index.js";
export interface InitOptions {
    change?: string;
    mcp?: boolean;
    ci?: boolean;
    tools?: string;
    /** Opt-in install of the vendored official Playwright agents (claude only). */
    agents?: boolean;
    /**
     * Init-mode override: true forces frontend mode, false forces minimal
     * mode, undefined lets the frontend signal decide (init-minimal-mode).
     */
    frontend?: boolean;
    /**
     * Opt-in lint-config bootstrap (`--lint-config`): create missing ESLint/ruff
     * configs or append the managed ruff block; existing configs are never edited.
     */
    lintConfig?: boolean;
    /**
     * Claude Code Stop hook (`--hook[=static|full]`, `--no-hook`): true means
     * the default static tier, a string names the tier, false removes it.
     */
    hook?: boolean | string;
    /** Generate `.github/workflows/openspec-auto.yml` (`--auto-pipeline`). */
    autoPipeline?: boolean;
}
export interface InitDeps {
    /** Interactive selection prompt; defaults to @inquirer/prompts checkbox.
     * Receives the pre-selected id set (configured tier or first-run bypass)
     * and the configured id set (`(configured)` suffix driver). */
    prompt?: (allEditors: EditorAdapter[], preselectedIds: ReadonlySet<EditorId>, configuredIds?: ReadonlySet<EditorId>) => Promise<EditorId[]>;
    /**
     * Confirmation prompt for the deselect-removal list; defaults to
     * @inquirer/prompts confirm. Separate from `prompt` — a checkbox stub
     * cannot answer a boolean question, and without an injection point tests
     * would block on stdin.
     */
    confirm?: (message: string) => Promise<boolean>;
    /**
     * Managed-.gitignore opt-out prompt; defaults to @inquirer/prompts
     * checkbox. Receives the grouped candidates and returns the paths that
     * stay ignored — the rest are recorded as skip in the block header.
     */
    gitignorePrompt?: (groups: readonly {
        label: string;
        paths: readonly string[];
    }[]) => Promise<string[]>;
    /** Override TTY detection (tests inject false here). */
    isTTY?: boolean;
    /** Override home dir for Pi/Oh My Pi global detection (tests inject an empty dir). */
    homeDir?: string;
}
/**
 * Interactive multi-select of all supported editors, pre-selecting the
 * editors passed in `preselected`. In the artifact-manifest tier those are
 * the configured editors — the `configured` set drives the "(configured)"
 * name suffix. In the first-run bypass tier `configured` is empty, so no
 * suffix renders. Dynamically imports @inquirer/prompts so non-interactive
 * runs never load it.
 */
export declare function promptSelectEditors(allEditors: EditorAdapter[], preselected: ReadonlySet<EditorId>, configured?: ReadonlySet<EditorId>): Promise<EditorId[]>;
export declare function groupGitignoreCandidates(candidates: readonly string[]): {
    label: string;
    paths: string[];
}[];
/**
 * Multi-select of managed paths that stay ignored — all checked, so Enter
 * keeps the previous behavior; unchecking records the path as a skip in the
 * block header.
 */
export declare function promptSelectGitignorePaths(groups: readonly {
    label: string;
    paths: readonly string[];
}[]): Promise<string[]>;
/**
 * Init modes: "frontend" keeps the full Playwright scaffold (existing
 * behavior); "minimal" delivers only tests/README.md plus employee
 * standards. Explicit --frontend/--no-frontend flags win over the detection
 * signal; null (no readable package.json, e.g. Python/Go backends) is
 * minimal mode — init-minimal-mode spec.
 */
export declare function resolveInitMode(options: InitOptions, frontendSignal: boolean | null): "frontend" | "minimal";
/** Paste-ready snippet matching the config file the user already owns. */
export declare function lintConfigSnippet(result: LintConfigResult): {
    hint: string;
    lines: string[];
};
export declare function init(options: InitOptions, deps?: InitDeps): Promise<void>;
/**
 * Minimal-mode scaffold: tests/README.md describing the acceptance-test
 * contract (init-minimal-mode). Returns true when the file on disk is OURS
 * (freshly generated, or already current — the Summary links the contract
 * doc only then); a user-owned README returns false. Drift sync belongs to
 * the update phase, ownership pruning to pruneMinimalModeReadme.
 */
export declare function generateTestsReadme(projectRoot: string): Promise<boolean>;
/**
 * Frontend-mode counterpart: a tool-owned tests/README.md from a previous
 * minimal-mode run describes the minimal contract and is outdated once the
 * full Playwright scaffold installs. Byte-identical to the template →
 * tool-owned → removed (empty tests/ dir goes too); anything else is
 * user-owned → kept with a notice.
 */
export declare function pruneMinimalModeReadme(projectRoot: string): Promise<void>;
export declare function generateSeedTest(projectRoot: string): Promise<void>;
export declare function generateAppKnowledge(projectRoot: string): Promise<void>;
/**
 * Copy the special-element test-plan playbook into the user's project as a
 * reference template (app-exploration.md points here). Same lifecycle as
 * BasePage.ts: init creates it once, update refreshes it on drift.
 */
export declare function generateTestPlanTemplate(projectRoot: string): Promise<void>;
export declare function generateSharedPages(projectRoot: string): Promise<void>;
export declare function generateGithubWorkflow(projectRoot: string): Promise<void>;
export declare function generatePlaywrightConfig(projectRoot: string): Promise<void>;
