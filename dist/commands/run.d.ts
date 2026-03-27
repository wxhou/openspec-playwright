export interface RunOptions {
    project?: string;
    timeout?: number;
}
export declare function run(changeName: string, options: RunOptions): Promise<void>;
