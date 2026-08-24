import { type EditorAdapter, type CommandMeta } from "../types.js";
/**
 * DeepSeek Harness (dsh) stores project skills in `.dsh/skills/` — the
 * `project-dsh` local provider root, rank 100 (highest local priority).
 * Skills are directory bundles (`<name>/SKILL.md`) with YAML frontmatter
 * (name + description); the kebab-case name becomes the model-invocable
 * skill name (`opsx-e2e`).
 *
 * Conventions follow the dsh skills subsystem (docs/subsystems/skills.md):
 *   - Skills:   `.dsh/skills/<name>/SKILL.md`, invoked via the `skill` tool.
 *   - Rules:    dsh reads `AGENTS.md` / `CLAUDE.md` natively (default
 *               instructionFileCandidates) — no wrapper file needed.
 *   - MCP:      dsh configures MCP via `cordis.yml` plugin config
 *               (@deepseek-ai/dsh-mcp-client), not a simple mcpServers file —
 *               the adapter declares `supportsMcp: false` so shared MCP phases
 *               skip it (configure Playwright MCP manually in cordis.yml).
 *   - Detected via `.dsh/` or the global `~/.dsh/` (DSH_HOME).
 */
export declare function formatDshCommand(meta: CommandMeta): string;
export declare function getDshCommandPath(id: string): string;
/**
 * True when DeepSeek Harness is in use: a project `.dsh/` dir, or the global
 * dsh home (`~/.dsh/`, DSH_HOME). The home signal lets `openspec-pw init`
 * detect dsh in a fresh project that has no `.dsh/` yet.
 */
export declare function hasDsh(projectRoot: string, homeDir?: string): boolean;
export declare const dshAdapter: EditorAdapter;
