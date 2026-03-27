export interface InitOptions {
    change?: string;
    playwrightInit?: boolean;
    mcp?: boolean;
    seed?: boolean;
}
export declare function init(options: InitOptions): Promise<void>;
