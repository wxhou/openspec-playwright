export interface UpdateOptions {
    cli?: boolean;
    skill?: boolean;
}
export declare function update(options: UpdateOptions): Promise<void>;
