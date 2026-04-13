import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname, resolve as pathResolve } from "path";
import chalk from "chalk";
/** Shared YAML escape — matches OpenSpec's escape logic */
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
/** Format tags as YAML inline array */
export function formatTagsArray(tags) {
    return `[${tags.map((t) => escapeYamlValue(t)).join(", ")}]`;
}
// ─── Claude Code ──────────────────────────────────────────────────────────────
/** Claude Code command file: .claude/commands/opsx/<id>.md */
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
/** Build the command metadata for Claude Code */
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
/** Detect if Claude Code is installed */
export function hasClaudeCode(projectRoot) {
    return existsSync(join(projectRoot, ".claude"));
}
// ─── Install helpers ───────────────────────────────────────────────────────
/** Install command files and SKILL.md for Claude Code */
export function installForClaudeCode(body, projectRoot) {
    const meta = buildCommandMeta(body);
    const relPath = getClaudeCommandPath(meta.id);
    const absPath = pathResolve(projectRoot, relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, formatClaudeCommand(meta));
    console.log(chalk.green(`  ✓ claude: ${relPath}`));
}
/** Install SKILL.md for Claude Code */
export function installSkill(projectRoot, skillContent) {
    const skillDir = join(projectRoot, ".claude", "skills", "openspec-e2e");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), skillContent);
    console.log(chalk.green(`  ✓ claude: .claude/skills/openspec-e2e/SKILL.md`));
}
/** Install project-level CLAUDE.md with employee-grade standards + OpenSpec context */
export function installProjectClaudeMd(projectRoot, standardsContent) {
    const dest = join(projectRoot, "CLAUDE.md");
    const markerStart = "<!-- OPENSPEC:START -->";
    const markerEnd = "<!-- OPENSPEC:END -->";
    if (!existsSync(dest)) {
        // No CLAUDE.md → create with markers wrapping standards
        const projName = projectRoot.split("/").pop() ?? "Project";
        const content = `# ${projName}\n\n${markerStart}\n\n${standardsContent}\n\n${markerEnd}\n`;
        writeFileSync(dest, content);
        console.log(chalk.green(`  ✓ CLAUDE.md: created with employee-grade standards`));
        return;
    }
    // CLAUDE.md exists → read and manage OPENSPEC block
    const existing = readFileSync(dest, "utf-8");
    const hasStart = existing.includes(markerStart);
    const hasEnd = existing.includes(markerEnd);
    if (hasStart && hasEnd) {
        // Markers exist → replace the block (preserves outside content)
        const startIdx = existing.indexOf(markerStart);
        const endIdx = existing.indexOf(markerEnd) + markerEnd.length;
        const before = existing.slice(0, startIdx).trimEnd();
        const after = existing.slice(endIdx);
        const updated = before + "\n" + markerStart + "\n\n" + standardsContent.trim() + "\n\n" + markerEnd + after;
        writeFileSync(dest, updated);
        console.log(chalk.green(`  ✓ CLAUDE.md: updated employee-grade standards (markers preserved, content refreshed)`));
    }
    else if (!hasStart && !hasEnd) {
        // No markers → append with markers
        const updated = existing.trim() +
            "\n\n" +
            markerStart +
            "\n\n" +
            standardsContent +
            "\n\n" +
            markerEnd +
            "\n";
        writeFileSync(dest, updated);
        console.log(chalk.green(`  ✓ CLAUDE.md: appended employee-grade standards with markers`));
    }
    else {
        // Partial markers (start without end or vice versa) → malformed, warn
        console.log(chalk.yellow(`  ⚠ CLAUDE.md has incomplete OPENSPEC markers — skipped`));
    }
}
/** Read the employee-grade standards from a source file */
export function readEmployeeStandards(srcPath) {
    return existsSync(srcPath) ? readFileSync(srcPath, "utf-8") : "";
}
//# sourceMappingURL=editors.js.map