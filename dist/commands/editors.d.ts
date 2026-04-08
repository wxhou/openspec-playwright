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
/** Claude Code command file: .claude/commands/opsx/<id>.md */
export declare function formatClaudeCommand(meta: CommandMeta): string;
export declare function getClaudeCommandPath(id: string): string;
/** Build the command metadata for Claude Code */
export declare function buildCommandMeta(body: string): CommandMeta;
/** Detect if Claude Code is installed */
export declare function hasClaudeCode(projectRoot: string): boolean;
/** Install command files and SKILL.md for Claude Code */
export declare function installForClaudeCode(body: string, projectRoot: string): void;
/** Install SKILL.md for Claude Code */
export declare function installSkill(projectRoot: string, skillContent: string): void;
/** Install project-level CLAUDE.md with employee-grade standards + OpenSpec context */
export declare function installProjectClaudeMd(projectRoot: string, standardsContent: string): void;
/** Read the employee-grade standards from a source file */
export declare function readEmployeeStandards(srcPath: string): string;
