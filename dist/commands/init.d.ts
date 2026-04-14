export interface InitOptions {
    change?: string;
    mcp?: boolean;
    seed?: boolean;
}
export declare function init(options: InitOptions): Promise<void>;
export declare function generateSeedTest(projectRoot: string, force: boolean): Promise<void>;
export declare function generateAppKnowledge(projectRoot: string): Promise<void>;
export declare function generateSharedPages(projectRoot: string): Promise<void>;
export declare function installSkillTemplates(projectRoot: string): void;
