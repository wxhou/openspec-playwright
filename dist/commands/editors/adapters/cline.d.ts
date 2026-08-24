import { type EditorAdapter, type CommandMeta } from "../types.js";
/**
 * Cline stores project-level config in `.cline/` (skills/, rules/, mcp.json).
 * `.clinerules/` is the legacy rules-only directory, still auto-detected.
 *
 * Conventions follow the Cline documentation (2026):
 *   - Skills:   `.cline/skills/<name>/SKILL.md` with YAML frontmatter
 *                (name + description). Triggered via `/<name>` slash command.
 *   - MCP:      `.cline/mcp.json` with `{ "mcpServers": { ... } }` structure.
 *   - Rules:    Cline auto-detects `AGENTS.md` — no wrapper file needed.
 */
export declare function formatClineCommand(meta: CommandMeta): string;
export declare function getClineCommandPath(id: string): string;
export declare function hasCline(projectRoot: string): boolean;
export declare const clineAdapter: EditorAdapter;
