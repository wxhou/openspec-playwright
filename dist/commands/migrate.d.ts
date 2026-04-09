export interface MigrateOptions {
    dryRun?: boolean;
    force?: boolean;
}
export declare function migrate(options: MigrateOptions): Promise<void>;
