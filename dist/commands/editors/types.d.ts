/**
 * Core types for the editor adapter layer: command metadata, the runtime
 * `EditorAdapter` surface, and the declarative `AdapterDeclaration` that
 * `declaration.ts` compiles into it. Zero internal dependencies — every
 * other editors/* module may import from this file.
 */
export interface CommandMeta {
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    body: string;
}
/** Build the command metadata for the /opsx:e2e command. */
export declare function buildCommandMeta(body: string): CommandMeta;
export type EditorId = "claude" | "opencode" | "cline" | "cursor" | "pi" | "omp" | "codebuddy" | "minimax";
export interface ExtraArtifact {
    relativePath: string;
    contents: string;
}
/**
 * How an editor spells its slash command: `colon` (`/opsx:e2e`, editors that
 * load command files) or `hyphen` (`/opsx-e2e`, editors that load skills).
 */
export type CommandForm = "colon" | "hyphen";
/**
 * How an adapter names its artifact, which determines both the invocation
 * form and the body rewrite:
 *   - `namespace-dir` → `<dir>/opsx/<id>.md`, invoked `/opsx:<id>`, body
 *     keeps its `/opsx:` references (Claude Code, CodeBuddy CLI).
 *   - `hyphen-prefix` → `<dir>/opsx-<id>.md` or `<dir>/opsx-<id>/SKILL.md`,
 *     invoked `/opsx-<id>`, body rewrites `/opsx:` → `/opsx-`.
 */
export type ArtifactNaming = "namespace-dir" | "hyphen-prefix";
/**
 * Frontmatter fields an artifact emits, in the fixed order
 * name → description → argument-hint → disable-model-invocation.
 * Omit the whole object for artifacts with no frontmatter (Cursor commands).
 */
export interface ArtifactFrontmatter {
    /** Emit `name: opsx-<id>`. */
    name?: boolean;
    /** Emit `description: <meta.description>`. */
    description?: boolean;
    /** Emit `argument-hint: "<value>"` — the value is always double-quoted. */
    argumentHint?: string;
    /** Emit `disable-model-invocation: true`. */
    disableModelInvocation?: boolean;
}
/** One file an adapter writes for a command id. */
export interface ArtifactSpec {
    /** Relative path inside the project. */
    path(id: string): string;
    naming: ArtifactNaming;
    frontmatter?: ArtifactFrontmatter;
    /** Text emitted before the frontmatter/body (Cursor's `$1` comment). */
    header?: string | ((meta: CommandMeta) => string);
}
/**
 * A directory whose contents are a tool-owned artifact namespace. Used when
 * the artifacts are NOT contained by a project marker directory — MiniMax
 * Code writes `.agents/skills/opsx-*` while its marker is `.minimax/`.
 */
export interface ArtifactRoot {
    /** Project-relative directory. */
    dir: string;
    /** Entry-name prefix, e.g. `opsx-`. */
    prefix: string;
    /** File that must exist inside a matching directory, e.g. `SKILL.md`. */
    entry?: string;
}
/**
 * Detection has three tiers, each with distinct authority:
 *   - intentPaths  → interactive first-run pre-select only. Never authorizes.
 *   - projectPaths → project-level signal (pre-select + write authorization).
 *   - globalPaths  → any-scope detection only (user's home), never project.
 *   - artifactRoots → project-level signal from tool-owned artifacts.
 */
export interface DetectionSpec {
    intentPaths?: string[];
    projectPaths?: string[];
    globalPaths?: string[];
    artifactRoots?: ArtifactRoot[];
}
/**
 * How an adapter carries MCP configuration:
 *   - none               → no MCP client (Pi).
 *   - mcp-servers-file   → `{ "mcpServers": { ... } }` JSON file; `path` may
 *                          be shared with other adapters (project `.mcp.json`).
 *   - claude-cli         → the file is read directly but written through
 *                          `claude mcp add/remove --scope project`.
 *   - opencode-json      → exclusive `opencode.json(c)` (`mcp.<server>`).
 */
export type McpSpec = {
    kind: "none";
} | {
    kind: "mcp-servers-file";
    path(root: string): string;
} | {
    kind: "claude-cli";
    configPath(root: string): string;
} | {
    kind: "opencode-json";
};
/** Project rules file, plus optional config registration. */
export interface RulesSpec {
    /** Absolute path of the editor's project rules file. */
    path(root: string): string;
    /** Register the rules file in the editor's own config (OpenCode). */
    registerInConfig?: "opencode-json";
}
/**
 * The declarative input of `defineAdapter`: every editor is a choice of
 * artifacts + detection + MCP carrier + rules file. Editor quirks belong in
 * these data fields, not in new optional hooks.
 */
export interface AdapterDeclaration {
    id: EditorId;
    label: string;
    displayName: string;
    /** Ordered; the first artifact is the primary command artifact. */
    artifacts: ArtifactSpec[];
    detection: DetectionSpec;
    mcp: McpSpec;
    /** Defaults to `<root>/AGENTS.md` with no config registration. */
    rules?: RulesSpec;
    /** Retired artifact directories to clean up (project-relative). */
    legacyArtifacts?: string[];
    /** Consent-gated, ownership-aware extra files (Claude's vendored agents). */
    optionalArtifacts?: (install: boolean) => ExtraArtifact[];
}
export interface EditorAdapter {
    id: EditorId;
    /** Short label used in log messages. */
    label: string;
    /** Human-readable name used in user-facing messages. */
    displayName: string;
    /**
     * True if this editor's config dir is present in the project.
     * Some adapters (Pi, Oh My Pi) also treat a global config dir in the
     * user's home as a detection signal — `homeDir` lets tests inject a
     * fake home so detection stays hermetic.
     *
     * detect() is the "any scope" signal: display + interactive pre-select
     * only. It NEVER authorizes writes — use projectSignal for that.
     */
    detect(projectRoot: string, homeDir?: string): boolean;
    /**
     * Project-level signal only (marker dir inside the project). Used for
     * the init non-TTY fallback and anywhere a global dir must not count.
     * Defaults to detect() with a sentinel home so home-blind adapters
     * (claude/opencode/cline/cursor) reuse their detect() unchanged.
     */
    projectSignal?(projectRoot: string): boolean;
    /**
     * True when this editor has an MCP client to configure. False skips all
     * MCP install/check/remove phases (Pi has no MCP client).
     */
    supportsMcp?: boolean;
    /** Relative path of the command file inside the project. */
    commandFilePath(id: string): string;
    /**
     * How this editor spells its slash command: `colon` (`/opsx:e2e`, editors
     * that load command files) or `hyphen` (`/opsx-e2e`, editors that load
     * skills). Defaults to `hyphen` — the skill form every skill-delivering
     * adapter uses. The body transform must match: skill artifacts are written
     * with hyphenated command references, command files keep the colon form.
     */
    commandForm?: CommandForm;
    /** Format command file contents (frontmatter + body). */
    formatCommand(meta: CommandMeta): string;
    /** Absolute path of the project rules file. */
    projectRulesPath(projectRoot: string): string;
    /** True if MCP server `serverName` is already configured. */
    isMcpInstalled(projectRoot: string, serverName: string): boolean;
    /** Install MCP server config in this editor. */
    installMcp(projectRoot: string, serverName: string, command: string[]): void;
    /** Remove MCP server config from this editor. */
    removeMcp(projectRoot: string, serverName: string): void;
    /**
     * Optional: absolute path of the MCP config file this adapter reads and
     * writes. Declared by every adapter that owns an MCP config file, so the
     * init deselect-removal phase can tell whether an MCP entry is shared with
     * a still-selected editor (see `retainedMcpConfigFiles` in removal.ts).
     *
     * Two adapters declare none: pi (no MCP client at all) and opencode, whose
     * `opencode.json(c)` is exclusive to OpenCode — nothing can share its
     * entries, so the shared-file guard never applies to it.
     */
    mcpConfigPath?(projectRoot: string): string;
    /** Optional: register project rules file path in editor config. */
    registerInstructions?(projectRoot: string, instructions: string[]): void;
    /** Optional: secondary files written alongside commandFilePath (Cursor skill). */
    extraArtifacts?(meta: CommandMeta): ExtraArtifact[];
    /**
     * Optional: consent-gated secondary files (claude's vendored Playwright
     * agents). Only written when `install` is true — the caller resolves
     * consent (the `--agents` flag or the interactive confirm). Unlike
     * extraArtifacts, these paths NEVER enter listCommandArtifactPaths, so
     * they confer no configured status and no write authorization.
     */
    optionalArtifacts?(install: boolean): ExtraArtifact[];
    /**
     * The declaration this adapter was compiled from. Read by
     * `preselectAdapters()` for the intent tier.
     */
    declaration?: AdapterDeclaration;
}
