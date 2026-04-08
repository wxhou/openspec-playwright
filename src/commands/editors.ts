import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname, resolve as pathResolve } from "path";
import chalk from "chalk";

/** Shared YAML escape — matches OpenSpec's escape logic */
export function escapeYamlValue(value: string): string {
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
export function formatTagsArray(tags: string[]): string {
  return `[${tags.map((t) => escapeYamlValue(t)).join(", ")}]`;
}

/** Command metadata shared across editors */
export interface CommandMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  body: string;
}

// ─── Claude Code ──────────────────────────────────────────────────────────────

/** Claude Code command file: .claude/commands/opsx/<id>.md */
export function formatClaudeCommand(meta: CommandMeta): string {
  return `---
name: ${escapeYamlValue(meta.name)}
description: ${escapeYamlValue(meta.description)}
category: ${escapeYamlValue(meta.category)}
tags: ${formatTagsArray(meta.tags)}
---

${meta.body}
`;
}

export function getClaudeCommandPath(id: string): string {
  return join(".claude", "commands", "opsx", `${id}.md`);
}

/** Build the command metadata for Claude Code */
export function buildCommandMeta(body: string): CommandMeta {
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
export function hasClaudeCode(projectRoot: string): boolean {
  return existsSync(join(projectRoot, ".claude"));
}

// ─── Install helpers ───────────────────────────────────────────────────────

/** Install command files and SKILL.md for Claude Code */
export function installForClaudeCode(
  body: string,
  projectRoot: string,
): void {
  const meta = buildCommandMeta(body);
  const relPath = getClaudeCommandPath(meta.id);
  const absPath = pathResolve(projectRoot, relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, formatClaudeCommand(meta));
  console.log(chalk.green(`  ✓ claude: ${relPath}`));
}

/** Install SKILL.md for Claude Code */
export function installSkill(projectRoot: string, skillContent: string): void {
  const skillDir = join(projectRoot, ".claude", "skills", "openspec-e2e");
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), skillContent);
  console.log(chalk.green(`  ✓ claude: .claude/skills/openspec-e2e/SKILL.md`));
}

/** Install project-level CLAUDE.md with employee-grade standards + OpenSpec context */
export function installProjectClaudeMd(
  projectRoot: string,
  standardsContent: string,
): void {
  const dest = join(projectRoot, "CLAUDE.md");
  const exists = existsSync(dest);
  if (exists) {
    // Append standards inside OPENSPEC:START/END markers
    const existing = readFileSync(dest, "utf-8");
    const markerStart = "<!-- OPENSPEC:START -->";
    const markerEnd = "<!-- OPENSPEC:END -->";

    if (existing.includes(markerStart) && existing.includes(markerEnd)) {
      // Already has markers, skip
      console.log(
        chalk.gray("  - CLAUDE.md already has standards markers, skipping"),
      );
    } else {
      const updated =
        existing.trim() +
        "\n\n" +
        markerStart +
        "\n\n" +
        standardsContent +
        "\n\n" +
        markerEnd +
        "\n";
      writeFileSync(dest, updated);
      console.log(
        chalk.green("  ✓ CLAUDE.md: appended employee-grade standards"),
      );
    }
  } else {
    // No existing CLAUDE.md, create from template
    const projName = projectRoot.split("/").pop() ?? "Project";
    const content = `# ${projName}\n\n${standardsContent}\n`;
    writeFileSync(dest, content);
    console.log(
      chalk.green("  ✓ CLAUDE.md: created with employee-grade standards"),
    );
  }
}

/** Read the employee-grade standards from a source file */
export function readEmployeeStandards(srcPath: string): string {
  return existsSync(srcPath) ? readFileSync(srcPath, "utf-8") : "";
}
