export interface InitOptions {
    change?: string;
    mcp?: boolean;
    ci?: boolean;
}
export declare function init(options: InitOptions): Promise<void>;
export declare function generateSeedTest(projectRoot: string): Promise<void>;
export declare function generateAppKnowledge(projectRoot: string): Promise<void>;
export declare function generateSharedPages(projectRoot: string): Promise<void>;
export declare function generateGithubWorkflow(projectRoot: string): Promise<void>;
export declare function generatePlaywrightConfig(projectRoot: string): Promise<void>;
