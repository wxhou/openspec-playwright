import { type EditorAdapter, type CommandMeta } from "../types.js";
/**
 * Pi stores project resources in `.pi/` (skills/, prompts/, extensions/).
 * Prompt templates are Markdown with optional YAML frontmatter; the
 * filename becomes the slash command name (`opsx-e2e.md` → `/opsx-e2e`),
 * `description` feeds autocomplete, and `argument-hint` shows expected
 * arguments. `$1` / `$ARGUMENTS` placeholders expand at prompt time.
 *
 * Conventions follow the Pi docs (packages/coding-agent/docs):
 *   - Prompts:   `.pi/prompts/*.md`, invoked via `/name`.
 *   - Skills:    `.pi/skills/` (root `.md` files or `SKILL.md` dirs),
 *                invoked via `/skill:name`.
 *   - Rules:     Pi loads `AGENTS.md` (or `CLAUDE.md`) walking up from cwd
 *                natively — no wrapper file needed.
 *   - MCP:       Pi has NO MCP client (built-in tools only). The adapter
 *                still implements the interface with no-ops and declares
 *                `supportsMcp: false` so shared MCP phases skip it.
 */
export declare function formatPiCommand(meta: CommandMeta): string;
export declare function getPiCommandPath(id: string): string;
/**
 * True when Pi is in use: a project `.pi/` dir, or a global Pi config dir
 * (`~/.pi/agent/`, created by Pi on first run). The home signal lets
 * `openspec-pw init` detect Pi in a fresh project that has no `.pi/` yet.
 */
export declare function hasPi(projectRoot: string, homeDir?: string): boolean;
export declare const piAdapter: EditorAdapter;
