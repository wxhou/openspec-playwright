/** Shared YAML escape — matches OpenSpec's escape logic */
export declare function escapeYamlValue(value: string): string;
/** Format tags as YAML inline array */
export declare function formatTagsArray(tags: string[]): string;
/** Command metadata shared across editors */
export interface CommandMeta {
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    body: string;
}
/** Editor adapter — Strategy Pattern */
export interface EditorAdapter {
    /** Tool identifier */
    toolId: string;
    /** Whether this editor supports SKILL.md */
    hasSkill: boolean;
    /** Get the command file path relative to project root */
    getCommandPath(commandId: string): string;
    /** Format the complete file content */
    formatCommand(meta: CommandMeta): string;
}
/** Claude Code: .claude/commands/opsx/<id>.md + SKILL.md */
declare const claudeAdapter: EditorAdapter;
/** Detect which editors are installed by checking their config directories */
export declare function detectEditors(projectRoot: string): EditorAdapter[];
/** Build the shared command metadata */
export declare function buildCommandMeta(body: string): CommandMeta;
/** Install command files for all detected editors */
export declare function installForAllEditors(body: string, adapters: EditorAdapter[], projectRoot: string): void;
/** Install SKILL.md only for Claude Code */
export declare function installSkill(projectRoot: string, skillContent: string): void;
export { claudeAdapter };
