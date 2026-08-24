/**
 * Cross-editor shared helpers: YAML frontmatter escaping, command body
 * transforms, command metadata, and the mcpServers JSON file family
 * (Cline / Cursor / Oh My Pi).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
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
/** Build the command metadata for the /opsx:e2e command. */
export function buildCommandMeta(body) {
    return {
        id: "e2e",
        name: "OPSX: E2E",
        description: "Run Playwright E2E verification for an OpenSpec change",
        category: "OpenSpec",
        tags: ["openspec", "playwright", "e2e", "testing"],
        body,
    };
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