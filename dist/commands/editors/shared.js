/**
 * Cross-editor shared helpers: YAML frontmatter escaping, command body
 * transforms, command metadata, and the mcpServers JSON file family
 * (Cline / Cursor / Oh My Pi).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
/**
 * The claude-only skill directory retired installs (pre-0.3.74) left
 * behind. Declared by the claude adapter and reused by uninstall's fixed
 * historical cleanup.
 */
export const CLAUDE_LEGACY_SKILL_REL = join(".claude", "skills", "openspec-e2e");
// ─── YAML helpers (shared by Claude frontmatter and elsewhere) ───────────
/** Escape a value for safe inclusion in a YAML frontmatter scalar. */
export function escapeYamlValue(value) {
    const needsQuoting = /[:\n\r#{}[\],&*!|>'"%@`]|^\s|\s$/.test(value);
    if (needsQuoting) {
        const escaped = value
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\n/g, "\\n");
        return `"${escaped}"`;
    }
    return value;
}
/** Format tags as a YAML inline array. */
export function formatTagsArray(tags) {
    return `[${tags.map((t) => escapeYamlValue(t)).join(", ")}]`;
}
// ─── Body transform ──────────────────────────────────────────────────────
/**
 * OpenCode slash-command names are hyphenated (`/opsx-e2e`), Claude's are
 * colon-prefixed (`/opsx:e2e`). Rewrite all `/opsx:` references in a
 * command body for OpenCode installation.
 */
export function transformToHyphenCommands(text) {
    return text.replace(/\/opsx:/g, "/opsx-");
}
// ─── Command artifact formatting ─────────────────────────────────────────
/**
 * Render one artifact from its declaration. The naming convention is the
 * single source of truth for both the invocation form and the body rewrite:
 * `hyphen-prefix` artifacts invoke as `/opsx-<id>` and get their `/opsx:`
 * references rewritten; `namespace-dir` artifacts invoke as `/opsx:<id>`
 * and keep the body unchanged.
 *
 * Frontmatter fields always emit in the order name → description →
 * argument-hint → disable-model-invocation so artifacts stay byte-stable.
 */
export function formatArtifact(spec, meta) {
    const body = spec.naming === "hyphen-prefix"
        ? transformToHyphenCommands(meta.body)
        : meta.body;
    let out = "";
    if (spec.header !== undefined) {
        const header = typeof spec.header === "function" ? spec.header(meta) : spec.header;
        out += `${header}\n\n`;
    }
    if (spec.frontmatter) {
        const lines = [];
        if (spec.frontmatter.name) {
            lines.push(`name: ${escapeYamlValue(`opsx-${meta.id}`)}`);
        }
        if (spec.frontmatter.description) {
            lines.push(`description: ${escapeYamlValue(meta.description)}`);
        }
        if (spec.frontmatter.argumentHint !== undefined) {
            lines.push(`argument-hint: "${spec.frontmatter.argumentHint}"`);
        }
        if (spec.frontmatter.disableModelInvocation) {
            lines.push("disable-model-invocation: true");
        }
        out += `---\n${lines.join("\n")}\n---\n\n`;
    }
    return `${out}${body}\n`;
}
/**
 * Read an MCP config file with a top-level `mcpServers` map, or null if
 * missing/unparseable. Preserves unknown top-level fields.
 */
export function readMcpServersFile(configPath) {
    if (!existsSync(configPath))
        return null;
    try {
        const raw = JSON.parse(readFileSync(configPath, "utf-8"));
        if (raw.mcpServers && typeof raw.mcpServers === "object") {
            return raw;
        }
        raw.mcpServers = {};
        return raw;
    }
    catch {
        return null;
    }
}
/** Write an MCP config file, creating parent directories if needed. */
export function writeMcpServersFile(configPath, config) {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}
export function isMcpServerInFile(configPath, serverName) {
    const config = readMcpServersFile(configPath);
    if (!config)
        return false;
    return config.mcpServers[serverName] !== undefined;
}
export function installMcpServerInFile(configPath, serverName, command) {
    const config = readMcpServersFile(configPath) ?? { mcpServers: {} };
    config.mcpServers[serverName] = {
        command: command[0],
        args: command.slice(1),
    };
    writeMcpServersFile(configPath, config);
}
export function removeMcpServerFromFile(configPath, serverName) {
    const config = readMcpServersFile(configPath);
    if (!config)
        return;
    if (config.mcpServers[serverName] === undefined)
        return;
    delete config.mcpServers[serverName];
    writeMcpServersFile(configPath, config);
}
//# sourceMappingURL=shared.js.map