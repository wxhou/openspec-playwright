import { type EditorAdapter, type CommandMeta } from "../types.js";
/**
 * Oh My Pi (omp) stores project slash commands in `.omp/commands/*.md`
 * (non-recursive scan, project before user). Native commands are parsed
 * with FATAL frontmatter parsing, so the YAML must be valid; `name`
 * overrides the filename and `description` feeds autocomplete. `$1` /
 * `$ARGUMENTS` placeholders expand at prompt time.
 *
 * Conventions follow the omp docs (docs/slash-command-internals.md,
 * docs/mcp-config.md):
 *   - Commands:  `.omp/commands/*.md`, invoked via `/name`.
 *   - MCP:       `.omp/mcp.json` with `{ "mcpServers": { ... } }` — same
 *                shape as Cline/Cursor. omp also inherits `.claude/` /
 *                `.cursor/` / opencode MCP configs when present.
 *   - Rules:     omp reads `AGENTS.md` natively — no wrapper file needed.
 */
export declare function formatOmpCommand(meta: CommandMeta): string;
export declare function getOmpCommandPath(id: string): string;
/**
 * True when Oh My Pi is in use: a project `.omp/` dir, or a global omp
 * config dir (`~/.omp/agent/`, created by omp on first run).
 */
export declare function hasOmp(projectRoot: string, homeDir?: string): boolean;
export declare const ompAdapter: EditorAdapter;
