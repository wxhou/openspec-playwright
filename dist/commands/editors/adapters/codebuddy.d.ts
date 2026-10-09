import { type EditorAdapter, type CommandMeta } from "../types.js";
/**
 * CodeBuddy's documented command frontmatter fields are description,
 * argument-hint, model, allowed-tools, disable-model-invocation — no
 * `name` field (extra keys are ignored). Same shape as Claude's, so the
 * body keeps its `/opsx:` references (subdirectory colon naming).
 */
export declare function formatCodebuddyCommand(meta: CommandMeta): string;
export declare function getCodebuddyCommandPath(id: string): string;
export declare function hasCodebuddy(projectRoot: string): boolean;
export declare const codebuddyAdapter: EditorAdapter;
