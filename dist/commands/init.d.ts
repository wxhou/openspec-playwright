export interface InitOptions {
    change?: string;
    mcp?: boolean;
    seed?: boolean;
}
export declare function init(options: InitOptions): Promise<void>;
