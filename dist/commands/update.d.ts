export interface UpdateOptions {
    cli?: boolean;
    skill?: boolean;
    mcp?: boolean;
}
export declare function update(options: UpdateOptions): Promise<void>;
