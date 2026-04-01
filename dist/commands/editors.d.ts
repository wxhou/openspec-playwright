/** Shared YAML escape — matches OpenSpec's escape logic */
export declare function escapeYamlValue(value: string): string;
/** Format tags as YAML inline array (escaped) */
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
    toolId: string;
    hasSkill: boolean;
    getCommandPath(commandId: string): string;
    formatCommand(meta: CommandMeta): string;
}
/** Claude Code: .claude/commands/opsx/<id>.md + SKILL.md */
declare const claudeAdapter: EditorAdapter;
declare const ALL_ADAPTERS: EditorAdapter[];
/** Detect which editors are installed by checking their config directories */
export declare function detectEditors(projectRoot: string): EditorAdapter[];
/** Detect Codex by checking if CODEX_HOME or ~/.codex exists */
export declare function detectCodex(): EditorAdapter | null;
/** Build the shared command metadata */
export declare function buildCommandMeta(body: string): CommandMeta;
/** Install command files for all detected editors */
export declare function installForAllEditors(body: string, adapters: EditorAdapter[], projectRoot: string): void;
/** Install SKILL.md only for Claude Code */
export declare function installSkill(projectRoot: string, skillContent: string): void;
/** Install project-level CLAUDE.md with employee-grade standards + OpenSpec context */
export declare function installProjectClaudeMd(projectRoot: string, standardsContent: string): void;
/** Read the employee-grade standards from a source file */
export declare function readEmployeeStandards(srcPath: string): string;
export { claudeAdapter, ALL_ADAPTERS };
