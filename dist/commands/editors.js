/**
 * Editor adapter layer.
 *
 * Claude Code, OpenCode, Cline, and Cursor can host the /opsx:e2e command,
 * plus a project-level rules file (CLAUDE.md / AGENTS.md) and an MCP server
 * definition. Each editor has its own conventions — file path, frontmatter
 * shape, MCP install mechanism — so this module exposes a single
 * `EditorAdapter` interface and a registry that callers can iterate.
 *
 * Conventions follow the upstream OpenSpec reference implementation:
 *   - Claude:  `.claude/commands/opsx/<id>.md`, full frontmatter,
 *              `claude mcp add …`, reads CLAUDE.md directly.
 *   - OpenCode: `.opencode/commands/opsx-<id>.md`, description-only
 *              frontmatter, edits `opencode.json(c)`, reads files listed
 *              under `instructions` (CLAUDE.md is a built-in fallback).
 *   - Cline:   `.cline/skills/opsx-<id>/SKILL.md`, name+description
 *              frontmatter, edits `.cline/mcp.json`, auto-detects AGENTS.md.
 *   - Cursor:  `.cursor/commands/opsx-<id>.md` (plain MD) +
 *              `.cursor/skills/opsx-<id>/SKILL.md` (extraArtifacts),
 *              edits `.cursor/mcp.json`, auto-detects AGENTS.md.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, } from "fs";
import { execFileSync } from "node:child_process";
import { join, dirname, basename, resolve as pathResolve } from "path";
import chalk from "chalk";
import { modify, applyEdits, parseTree as parseJsonc, findNodeAtLocation, getNodeValue, } from "jsonc-parser";
import { TIMEOUT } from "../shared/constants.js";
import { needsShell } from "../shared/platform.js";
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
// ─── Claude Code adapter ─────────────────────────────────────────────────
export function formatClaudeCommand(meta) {
    return `---
name: ${escapeYamlValue(meta.name)}
description: ${escapeYamlValue(meta.description)}
category: ${escapeYamlValue(meta.category)}
tags: ${formatTagsArray(meta.tags)}
---

${meta.body}
`;
}
export function getClaudeCommandPath(id) {
    return join(".claude", "commands", "opsx", `${id}.md`);
}
export function hasClaudeCode(projectRoot) {
    return existsSync(join(projectRoot, ".claude"));
}
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
// ─── Cline adapter ───────────────────────────────────────────────────────
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
export function formatClineCommand(meta) {
    const body = transformToHyphenCommands(meta.body);
    const skillName = `opsx-${meta.id}`;
    return `---
name: ${escapeYamlValue(skillName)}
description: ${escapeYamlValue(meta.description)}
---

${body}
`;
}
export function getClineCommandPath(id) {
    return join(".cline", "skills", `opsx-${id}`, "SKILL.md");
}
export function hasCline(projectRoot) {
    return (existsSync(join(projectRoot, ".cline")) ||
        existsSync(join(projectRoot, ".clinerules")));
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
/** Path to the project-level MCP config file for Cline. */
function clineMcpPath(projectRoot) {
    return join(projectRoot, ".cline", "mcp.json");
}
/** Path to the project-level MCP config file for Cursor. */
function cursorMcpPath(projectRoot) {
    return join(projectRoot, ".cursor", "mcp.json");
}
// ─── Cursor adapter (format / paths) ─────────────────────────────────────
/**
 * Cursor slash commands are plain markdown (no frontmatter); the filename
 * is the command name. `$1` is the change-name argument.
 */
export function formatCursorCommand(meta) {
    const body = transformToHyphenCommands(meta.body);
    return `<!-- Change name: $1 (e.g. /opsx-${meta.id} my-change) -->

${body}
`;
}
export function getCursorCommandPath(id) {
    return join(".cursor", "commands", `opsx-${id}.md`);
}
export function getCursorSkillPath(id) {
    return join(".cursor", "skills", `opsx-${id}`, "SKILL.md");
}
/**
 * Cursor Agent Skill — explicit invocation only (`disable-model-invocation`).
 * No `$1` placeholders (those belong to the slash command file).
 */
export function formatCursorSkill(meta) {
    const body = transformToHyphenCommands(meta.body);
    const skillName = `opsx-${meta.id}`;
    return `---
name: ${escapeYamlValue(skillName)}
description: ${escapeYamlValue(meta.description)}
disable-model-invocation: true
---

${body}
`;
}
export function hasCursor(projectRoot) {
    return existsSync(join(projectRoot, ".cursor"));
}
// ─── Registry ────────────────────────────────────────────────────────────
const ADAPTERS = [
// Adapters are registered after const declarations at the bottom of this file.
];
export function getAdapter(id) {
    return ADAPTERS.find((a) => a.id === id);
}
export function detectAdapters(projectRoot) {
    return ADAPTERS.filter((a) => a.detect(projectRoot));
}
function registerAdapter(adapter) {
    ADAPTERS.push(adapter);
}
/** Slash-command hint for user-facing messages. */
export function slashCommandForAdapter(adapter) {
    return adapter.id === "claude" ? "/opsx:e2e" : "/opsx-e2e";
}
/** Relative paths installCommand writes for this adapter + meta. */
export function listCommandArtifactPaths(adapter, meta) {
    const paths = [adapter.commandFilePath(meta.id)];
    for (const extra of adapter.extraArtifacts?.(meta) ?? []) {
        paths.push(extra.relativePath);
    }
    return paths;
}
// ─── Install helpers ─────────────────────────────────────────────────────
/** Install the command file (and optional extraArtifacts) for one adapter. */
export function installCommand(adapter, meta, projectRoot) {
    const relPath = adapter.commandFilePath(meta.id);
    const absPath = pathResolve(projectRoot, relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, adapter.formatCommand(meta));
    console.log(chalk.green(`  ✓ ${adapter.label}: ${relPath}`));
    for (const extra of adapter.extraArtifacts?.(meta) ?? []) {
        const extraAbs = pathResolve(projectRoot, extra.relativePath);
        mkdirSync(dirname(extraAbs), { recursive: true });
        writeFileSync(extraAbs, extra.contents);
        console.log(chalk.green(`  ✓ ${adapter.label}: ${extra.relativePath}`));
    }
}
// ─── Project rules file (CLAUDE.md / AGENTS.md) ──────────────────────────
/**
 * Read the OPENSPEC marker block from a rules file, or `null` when the file
 * is missing / has no markers. Used by drift detection and update to decide
 * whether a rules file needs rewriting.
 */
export function readOpenSpecBlock(projectRoot, adapter) {
    const dest = adapter.projectRulesPath(projectRoot);
    if (!existsSync(dest))
        return null;
    const content = readFileSync(dest, "utf-8");
    const startIdx = content.indexOf("<!-- OPENSPEC:START -->");
    const endIdx = content.indexOf("<!-- OPENSPEC:END -->");
    if (startIdx === -1 || endIdx === -1)
        return null;
    return content.slice(startIdx + "<!-- OPENSPEC:START -->".length, endIdx).trim();
}
/**
 * Whether a rules file's OPENSPEC block matches the expected content.
 * A missing file or absent/truncated markers counts as "does not match"
 * (the caller will rewrite it), which keeps update idempotent but safe.
 */
export function blockMatchesExpected(projectRoot, adapter, expected) {
    const block = readOpenSpecBlock(projectRoot, adapter);
    if (block === null)
        return false;
    return block === expected.trim();
}
/**
 * Install employee-grade standards into the editor's rules file
 * (CLAUDE.md for Claude, AGENTS.md for OpenCode, Cline, and Cursor). Wraps content in
 * `<!-- OPENSPEC:START -->` / `<!-- OPENSPEC:END -->` markers so future
 * updates can replace the block without touching the rest of the file.
 */
export function installOpenSpecBlock(projectRoot, standardsContent, adapter = claudeAdapter) {
    const dest = adapter.projectRulesPath(projectRoot);
    const fileLabel = basename(dest);
    const markerStart = "<!-- OPENSPEC:START -->";
    const markerEnd = "<!-- OPENSPEC:END -->";
    if (!existsSync(dest)) {
        const projName = projectRoot.split("/").pop() ?? "Project";
        const content = `# ${projName}\n\n${markerStart}\n\n${standardsContent.trim()}\n\n${markerEnd}\n`;
        writeFileSync(dest, content);
        console.log(chalk.green(`  ✓ ${fileLabel}: created with employee-grade standards`));
        return;
    }
    const existing = readFileSync(dest, "utf-8");
    const hasStart = existing.includes(markerStart);
    const hasEnd = existing.includes(markerEnd);
    if (hasStart && hasEnd) {
        const startIdx = existing.indexOf(markerStart);
        const endIdx = existing.indexOf(markerEnd) + markerEnd.length;
        const before = existing.slice(0, startIdx).trimEnd();
        const after = existing.slice(endIdx);
        const updated = before +
            "\n" +
            markerStart +
            "\n\n" +
            standardsContent.trim() +
            "\n\n" +
            markerEnd +
            after;
        writeFileSync(dest, updated);
        console.log(chalk.green(`  ✓ ${fileLabel}: updated employee-grade standards (markers preserved, content refreshed)`));
    }
    else if (!hasStart && !hasEnd) {
        const updated = existing.trim() +
            "\n\n" +
            markerStart +
            "\n\n" +
            standardsContent.trim() +
            "\n\n" +
            markerEnd +
            "\n";
        writeFileSync(dest, updated);
        console.log(chalk.green(`  ✓ ${fileLabel}: appended employee-grade standards with markers`));
    }
    else {
        // Incomplete markers (only START, or only END) — corrupted tool territory.
        // Keep everything before the first marker (user content), discard the
        // truncated tool output after it, and write a clean complete block so
        // `doctor`/`update` converge instead of dead-ending on a skipped file.
        const firstIdx = hasStart
            ? existing.indexOf(markerStart)
            : existing.indexOf(markerEnd);
        const header = existing.slice(0, firstIdx).trimEnd();
        const updated = header +
            "\n\n" +
            markerStart +
            "\n\n" +
            standardsContent.trim() +
            "\n\n" +
            markerEnd +
            "\n";
        writeFileSync(dest, updated);
        console.log(chalk.green(`  ✓ ${fileLabel}: repaired incomplete OPENSPEC markers with employee-grade standards`));
    }
}
/**
 * CodeGraph-first guidance prepended to the Claude wrapper so the model sees
 * it in the main rules file instead of relying on the AGENTS.md import
 * (imported content ranks lower and is treated as optional by the model).
 */
const CODE_GRAPH_FIRST_BLOCK = `## CodeGraph 优先 🔴

存在 \`.codegraph/\` 时：结构性任务（定位定义、调用链、影响面、流程）**默认第一步**调用 \`codegraph_explore\`，直接用结果回答，不要先 grep/read；grep/read 仅用于字面文本、已打开文件、或结果不足时补查。不派子 agent 重建索引。无 \`.codegraph/\` 跳过。违反会退化为 grep/read 探索循环，token 成本高 5-10×。`;
/**
 * The expected OPENSPEC block content for a thin CLAUDE.md wrapper
 * (CodeGraph-first guidance + `@AGENTS.md` import). Exported so drift
 * detection / update can compare against it.
 */
export function claudeWrapperStandardsContent() {
    return `${CODE_GRAPH_FIRST_BLOCK}\n\n@AGENTS.md\n`;
}
/**
 * Install a thin CLAUDE.md that imports AGENTS.md.
 *
 * Uses the same OPENSPEC:START/END markers as the full standards block so
 * `cleanProjectRules` can remove it uniformly. The CodeGraph-first block is
 * written directly into CLAUDE.md (before the @AGENTS.md import) so Claude
 * Code picks it up without depending on the import.
 *
 * Also handles migration: if CLAUDE.md has an existing OPENSPEC:START block
 * (old format that wrote standards directly to CLAUDE.md), calling
 * `installOpenSpecBlock` replaces the content with the CodeGraph block +
 * `@AGENTS.md` import.
 */
export function installClaudeWrapper(projectRoot) {
    const dest = join(projectRoot, "CLAUDE.md");
    // No-op if our full wrapper (CodeGraph block + @AGENTS.md import) is already
    // in place — content-equal, so a user edit inside the markers is detected.
    // A bare @AGENTS.md without our markers (added by openspec CLI or the user)
    // is left untouched.
    if (existsSync(dest)) {
        const existing = readFileSync(dest, "utf-8");
        const hasMarkers = existing.includes("<!-- OPENSPEC:START -->");
        if (!hasMarkers && /^@AGENTS\.md\r?$/m.test(existing))
            return;
        if (hasMarkers && blockMatchesExpected(projectRoot, claudeAdapter, claudeWrapperStandardsContent())) {
            return;
        }
    }
    // Delegate to installOpenSpecBlock which handles create/update/append
    // with OPENSPEC:START/END markers.
    installOpenSpecBlock(projectRoot, claudeWrapperStandardsContent(), claudeAdapter);
}
/**
 * Route employee-grade standards into project rules files.
 *
 * AGENTS.md is always the single source of truth, regardless of which
 * editors are detected. If Claude is in use, a thin CLAUDE.md wrapper
 * with `@AGENTS.md` import is created so Claude loads AGENTS.md as
 * its project rules. Cline and Cursor auto-detect AGENTS.md natively — no
 * wrapper needed.
 */
export function installProjectRules(projectRoot, standardsContent, detected) {
    if (detected.length === 0)
        return;
    // AGENTS.md is always the single source of truth
    installOpenSpecBlock(projectRoot, standardsContent, opencodeAdapter);
    // Thin CLAUDE.md with @AGENTS.md import if Claude is in use
    if (detected.some((a) => a.id === "claude")) {
        installClaudeWrapper(projectRoot);
    }
    // Register AGENTS.md in opencode.json for OpenCode
    if (detected.some((a) => a.id === "opencode") && opencodeAdapter.registerInstructions) {
        const existing = readOpenCodeInstructions(projectRoot);
        const next = Array.from(new Set([...(existing ?? []), "AGENTS.md"]));
        opencodeAdapter.registerInstructions(projectRoot, next);
    }
}
/** Remove all OpenSpec marker blocks from AGENTS.md (always) and CLAUDE.md (for claude adapter). */
export function cleanProjectRules(adapter, projectRoot) {
    // AGENTS.md always has the employee standards (SSOT)
    removeMarkersFromFile(join(projectRoot, "AGENTS.md"), "AGENTS.md");
    // CLAUDE.md may have the wrapper import if Claude is detected
    if (adapter.id === "claude") {
        removeMarkersFromFile(adapter.projectRulesPath(projectRoot), basename(adapter.projectRulesPath(projectRoot)));
    }
}
/** Remove OpenSpec marker blocks from a single file. Only edits within markers. */
function removeMarkersFromFile(dest, fileLabel) {
    if (!existsSync(dest)) {
        console.log(chalk.gray(`  - ${fileLabel} not found, skipping`));
        return;
    }
    const existing = readFileSync(dest, "utf-8");
    if (!existing.includes("<!-- OPENSPEC:START -->")) {
        console.log(chalk.gray(`  - No OpenSpec markers found in ${fileLabel}`));
        return;
    }
    // Remove markers and their content, consuming surrounding whitespace.
    // Then collapse runs of 3+ blank lines to at most 2 for a clean result.
    let updated = existing.replace(/\s*<!-- OPENSPEC:START -->[\s\S]*?<!-- OPENSPEC:END -->\s*/g, "\n\n").replace(/\n{3,}/g, "\n\n").trim();
    // Delete empty file rather than leaving a ghost.
    if (updated === "") {
        rmSync(dest);
        console.log(chalk.green(`  ✓ Removed empty ${fileLabel}`));
        return;
    }
    writeFileSync(dest, updated + "\n");
    console.log(chalk.green(`  ✓ Removed OpenSpec markers from ${fileLabel}`));
}
/** Read the employee-grade standards source file (empty string if missing). */
export function readEmployeeStandards(srcPath) {
    return existsSync(srcPath) ? readFileSync(srcPath, "utf-8") : "";
}
// ─── Adapter instances (registered after helpers above are defined) ──────
//
// We declare them here (not at the top) so they can reference the helper
// functions defined in this same module. JS hoisting covers `function`
// declarations; `const` arrows don't get hoisted, so the order matters.
function claudeMcpOutputIncludes(output, serverName) {
    return String(output ?? "").includes(serverName);
}
export const claudeAdapter = {
    id: "claude",
    label: "claude",
    displayName: "Claude Code",
    detect: hasClaudeCode,
    commandFilePath: getClaudeCommandPath,
    formatCommand: formatClaudeCommand,
    projectRulesPath: (root) => join(root, "CLAUDE.md"),
    isMcpInstalled(_root, serverName) {
        try {
            const out = execFileSync("claude", ["mcp", "list"], {
                encoding: "utf-8",
                timeout: TIMEOUT.MCP_LIST,
                stdio: ["pipe", "pipe", "pipe"],
                shell: needsShell,
            });
            return claudeMcpOutputIncludes(out, serverName);
        }
        catch {
            // Command failed — assume server not installed
            return false;
        }
    },
    installMcp(_root, serverName, command) {
        execFileSync("claude", ["mcp", "add", serverName, ...command], {
            encoding: "utf-8",
            timeout: TIMEOUT.MCP_LIST,
            stdio: ["pipe", "pipe", "pipe"],
            shell: needsShell,
        });
    },
    removeMcp(_root, serverName) {
        execFileSync("claude", ["mcp", "remove", serverName], {
            encoding: "utf-8",
            timeout: TIMEOUT.MCP_LIST,
            stdio: ["pipe", "pipe", "pipe"],
            shell: needsShell,
        });
    },
};
export const opencodeAdapter = {
    id: "opencode",
    label: "opencode",
    displayName: "OpenCode",
    detect: hasOpenCode,
    commandFilePath: getOpenCodeCommandPath,
    formatCommand: formatOpenCodeCommand,
    projectRulesPath: (root) => join(root, "AGENTS.md"),
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
};
export const clineAdapter = {
    id: "cline",
    label: "cline",
    displayName: "Cline",
    detect: hasCline,
    commandFilePath: getClineCommandPath,
    formatCommand: formatClineCommand,
    // Cline auto-detects AGENTS.md — no wrapper file needed. The SSOT
    // (AGENTS.md) is created by installProjectRules regardless of adapter.
    projectRulesPath: (root) => join(root, "AGENTS.md"),
    isMcpInstalled(projectRoot, serverName) {
        return isMcpServerInFile(clineMcpPath(projectRoot), serverName);
    },
    installMcp(projectRoot, serverName, command) {
        installMcpServerInFile(clineMcpPath(projectRoot), serverName, command);
    },
    removeMcp(projectRoot, serverName) {
        removeMcpServerFromFile(clineMcpPath(projectRoot), serverName);
    },
};
export const cursorAdapter = {
    id: "cursor",
    label: "cursor",
    displayName: "Cursor",
    detect: hasCursor,
    commandFilePath: getCursorCommandPath,
    formatCommand: formatCursorCommand,
    // Cursor auto-detects AGENTS.md — no .mdc wrapper needed.
    projectRulesPath: (root) => join(root, "AGENTS.md"),
    isMcpInstalled(projectRoot, serverName) {
        return isMcpServerInFile(cursorMcpPath(projectRoot), serverName);
    },
    installMcp(projectRoot, serverName, command) {
        installMcpServerInFile(cursorMcpPath(projectRoot), serverName, command);
    },
    removeMcp(projectRoot, serverName) {
        removeMcpServerFromFile(cursorMcpPath(projectRoot), serverName);
    },
    extraArtifacts(meta) {
        return [
            {
                relativePath: getCursorSkillPath(meta.id),
                contents: formatCursorSkill(meta),
            },
        ];
    },
};
// Register the adapters now that the const arrows exist
registerAdapter(claudeAdapter);
registerAdapter(opencodeAdapter);
registerAdapter(clineAdapter);
registerAdapter(cursorAdapter);
//# sourceMappingURL=editors.js.map