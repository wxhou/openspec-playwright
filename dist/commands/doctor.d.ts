export interface DoctorOptions {
    json?: boolean;
}
export declare function isOptionalCheck(name: string): boolean;
/**
 * Command hint for a project where no editor is authorized yet: every
 * supported editor, grouped by the command form it actually accepts.
 *
 * Only Claude Code and CodeBuddy CLI use the colon form (`/opsx:e2e`);
 * OpenCode, Cline, Cursor, Pi, Oh My Pi and MiniMax Code invoke the skill
 * command with a hyphen (`/opsx-e2e`). The list is built from the registry
 * so a new adapter can never drift out of the hint.
 */
export declare function allEditorCommandHints(): string;
export declare function doctor(options?: DoctorOptions): Promise<void>;
