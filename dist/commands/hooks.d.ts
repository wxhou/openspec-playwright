export type HookTier = "static" | "full";
export interface CommandHook {
    type: "command";
    command: string;
    timeout?: number;
}
export interface HookGroup {
    matcher?: string;
    hooks: CommandHook[];
}
export type ClaudeSettings = {
    hooks?: Record<string, HookGroup[]>;
} & Record<string, unknown>;
export declare function isHookTier(value: unknown): value is HookTier;
export declare function buildHookEntry(tier: HookTier): CommandHook;
export declare function isOwnHook(hook: CommandHook): boolean;
/**
 * Insert or refresh our hook. Idempotent: a second call leaves one entry.
 * Everything we do not recognise is preserved byte-for-byte.
 */
export declare function mergeStopHook(settings: ClaudeSettings, entry: CommandHook): ClaudeSettings;
/** Remove our hook and tidy up the empty containers it leaves behind. */
export declare function removeStopHook(settings: ClaudeSettings): {
    settings: ClaudeSettings;
    removed: boolean;
};
/**
 * Read the project settings file. A malformed file aborts the install rather
 * than being overwritten — it may hold the user's entire hook setup.
 */
export declare function readSettings(projectRoot: string): {
    settings: ClaudeSettings;
} | {
    error: string;
};
export declare function writeSettings(projectRoot: string, settings: ClaudeSettings): void;
export declare function installStopHook(projectRoot: string, tier: HookTier): {
    path: string;
    tier: HookTier;
} | {
    error: string;
};
export declare function uninstallStopHook(projectRoot: string): {
    path: string;
    removed: boolean;
} | {
    error: string;
};
