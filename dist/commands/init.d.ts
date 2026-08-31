import type { EditorAdapter, EditorId } from "./editors.js";
export interface InitOptions {
    change?: string;
    mcp?: boolean;
    ci?: boolean;
    tools?: string;
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
export declare function init(options: InitOptions, deps?: InitDeps): Promise<void>;
export declare function generateSeedTest(projectRoot: string): Promise<void>;
export declare function generateAppKnowledge(projectRoot: string): Promise<void>;
export declare function generateSharedPages(projectRoot: string): Promise<void>;
export declare function generateGithubWorkflow(projectRoot: string): Promise<void>;
export declare function generatePlaywrightConfig(projectRoot: string): Promise<void>;
