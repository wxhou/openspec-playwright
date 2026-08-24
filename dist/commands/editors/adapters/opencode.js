/**
 * OpenCode adapter: `.opencode/commands/opsx-<id>.md`, description-only
 * frontmatter; edits `opencode.json(c)` for both MCP (`mcp.playwright`)
 * and the `instructions` list that routes AGENTS.md into context.
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { modify, applyEdits, parseTree as parseJsonc, findNodeAtLocation, getNodeValue, } from "jsonc-parser";
import { defineAdapter } from "../types.js";
import { escapeYamlValue, transformToHyphenCommands } from "../shared.js";
import { registerAdapter } from "../registry.js";
// ─── OpenCode adapter ────────────────────────────────────────────────────
export function formatOpenCodeCommand(meta) {
    const body = transformToHyphenCommands(meta.body);
    return `---
description: ${escapeYamlValue(meta.description)}
---

${body}
`;
}
export function getOpenCodeCommandPath(id) {
    return join(".opencode", "commands", `opsx-${id}.md`);
}
export function hasOpenCode(projectRoot) {
    return existsSync(join(projectRoot, ".opencode"));
}
const JSONC_FORMAT = { tabSize: 2, insertSpaces: true };
/** Find the first existing opencode.json(c), or null. */
function findOpenCodeConfig(projectRoot) {
    for (const name of ["opencode.jsonc", "opencode.json"]) {
        const p = join(projectRoot, name);
        if (existsSync(p))
            return { path: p, text: readFileSync(p, "utf-8") };
    }
    return null;
}
/**
 * Set a value at a JSON path inside opencode.json(c), creating the file
 * with a `$schema` scaffold if it doesn't exist. Replaces any existing
 * value at the path (does not merge arrays).
 */
function setOpenCodeValue(projectRoot, keySegments, value) {
    const existing = findOpenCodeConfig(projectRoot);
    const targetPath = existing?.path ?? join(projectRoot, "opencode.jsonc");
    if (!existing) {
        const scaffold = {
            $schema: "https://opencode.ai/config.json",
        };
        // Build nested scaffold for multi-segment keys (e.g. ["mcp", "playwright"])
        let cursor = scaffold;
        for (let i = 0; i < keySegments.length - 1; i++) {
            const k = String(keySegments[i]);
            cursor[k] = {};
            cursor = cursor[k];
        }
        cursor[String(keySegments[keySegments.length - 1])] = value;
        // ponytail: new file uses 2-space indent; modify branch preserves existing formatting.
        writeFileSync(targetPath, JSON.stringify(scaffold, null, 2) + "\n");
        return;
    }
    const edits = modify(existing.text, keySegments, value, {
        formattingOptions: JSONC_FORMAT,
    });
    writeFileSync(targetPath, applyEdits(existing.text, edits));
}
/** Read the current value at a JSON path (returns undefined if missing). */
function readOpenCodeValue(text, keySegments) {
    try {
        const tree = parseJsonc(text);
        if (!tree)
            return undefined;
        const node = findNodeAtLocation(tree, keySegments);
        return node ? getNodeValue(node) : undefined;
    }
    catch {
        return undefined;
    }
}
/** Read the current `instructions` array from opencode.json(c), or undefined. */
function readOpenCodeInstructions(projectRoot) {
    const config = findOpenCodeConfig(projectRoot);
    if (!config)
        return undefined;
    const value = readOpenCodeValue(config.text, ["instructions"]);
    if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
        return value;
    }
    return undefined;
}
export const opencodeAdapter = defineAdapter({
    id: "opencode",
    label: "opencode",
    displayName: "OpenCode",
    detect: hasOpenCode,
    commandFilePath: getOpenCodeCommandPath,
    formatCommand: formatOpenCodeCommand,
    // AGENTS.md is the default; not declared explicitly.
    isMcpInstalled(projectRoot, serverName) {
        const config = findOpenCodeConfig(projectRoot);
        if (!config)
            return false;
        const value = readOpenCodeValue(config.text, ["mcp", serverName]);
        return value !== undefined;
    },
    installMcp(projectRoot, serverName, command) {
        setOpenCodeValue(projectRoot, ["mcp", serverName], {
            type: "local",
            command,
        });
    },
    removeMcp(projectRoot, serverName) {
        // Read current mcp map, rebuild without this server, write back
        const config = findOpenCodeConfig(projectRoot);
        if (!config)
            return;
        const value = readOpenCodeValue(config.text, ["mcp", serverName]);
        if (value === undefined)
            return;
        const current = readOpenCodeValue(config.text, ["mcp"]);
        if (current && typeof current === "object") {
            const next = { ...current };
            delete next[serverName];
            setOpenCodeValue(projectRoot, ["mcp"], next);
        }
    },
    registerInstructions(projectRoot, instructions) {
        setOpenCodeValue(projectRoot, ["instructions"], instructions);
    },
});
export { readOpenCodeInstructions };
registerAdapter(opencodeAdapter);
//# sourceMappingURL=opencode.js.map