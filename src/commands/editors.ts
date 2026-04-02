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

/** Editor adapter — Strategy Pattern */
export interface EditorAdapter {
  toolId: string;
  hasSkill: boolean;
  getCommandPath(commandId: string): string;
  formatCommand(meta: CommandMeta): string;
}

// ─── Claude Code ──────────────────────────────────────────────────────────────

/** Claude Code: .claude/commands/opsx/<id>.md + SKILL.md */
const claudeAdapter: EditorAdapter = {
  toolId: "claude",
  hasSkill: true,
  getCommandPath(id) {
    return join(".claude", "commands", "opsx", `${id}.md`);
  },
  formatCommand(meta) {
    return `---
name: ${escapeYamlValue(meta.name)}
description: ${escapeYamlValue(meta.description)}
category: ${escapeYamlValue(meta.category)}
tags: ${formatTagsArray(meta.tags)}
---

${meta.body}
`;
  },
};

// ─── Cursor ─────────────────────────────────────────────────────────────────

/** Cursor: .cursor/commands/opsx-<id>.md */
const cursorAdapter: EditorAdapter = {
  toolId: "cursor",
  hasSkill: false,
  getCommandPath(id) {
    return join(".cursor", "commands", `opsx-${id}.md`);
  },
  formatCommand(meta) {
    return `---
name: /opsx-${meta.id}
id: opsx-${meta.id}
category: ${escapeYamlValue(meta.category)}
description: ${escapeYamlValue(meta.description)}
---

${meta.body}
`;
  },
};

// ─── Windsurf ────────────────────────────────────────────────────────────────

/** Windsurf: .windsurf/workflows/opsx-<id>.md */
const windsurfAdapter: EditorAdapter = {
  toolId: "windsurf",
  hasSkill: false,
  getCommandPath(id) {
    return join(".windsurf", "workflows", `opsx-${id}.md`);
  },
  formatCommand(meta) {
    return `---
name: ${escapeYamlValue(meta.name)}
description: ${escapeYamlValue(meta.description)}
category: ${escapeYamlValue(meta.category)}
tags: ${formatTagsArray(meta.tags)}
---

${meta.body}
`;
  },
};

// ─── Gemini CLI ──────────────────────────────────────────────────────────────

/** Gemini CLI: .gemini/commands/opsx/<id>.toml */
const geminiAdapter: EditorAdapter = {
  toolId: "gemini",
  hasSkill: false,
  getCommandPath(id) {
    return join(".gemini", "commands", "opsx", `${id}.toml`);
  },
  formatCommand(meta) {
    return `description = "${meta.description}"

prompt = """
${meta.body}
"""
`;
  },
};

// ─── GitHub Copilot ────────────────────────────────────────────────────────

/** GitHub Copilot: .github/prompts/opsx-<id>.prompt.md */
const githubcopilotAdapter: EditorAdapter = {
  toolId: "github-copilot",
  hasSkill: false,
  getCommandPath(id) {
    return join(".github", "prompts", `opsx-${id}.prompt.md`);
  },
  formatCommand(meta) {
    return `---
description: ${meta.description}
---

${meta.body}
`;
  },
};

// ─── Detection map ───────────────────────────────────────────────────────

const ALL_ADAPTERS: EditorAdapter[] = [
  claudeAdapter,
  cursorAdapter,
  windsurfAdapter,
  geminiAdapter,
  githubcopilotAdapter,
];

/** Detect which editors are installed by checking their config directories */
export function detectEditors(projectRoot: string): EditorAdapter[] {
  const checks: Array<[string, EditorAdapter]> = [
    [".claude", claudeAdapter],
    [".cursor", cursorAdapter],
    [".windsurf", windsurfAdapter],
    [".gemini", geminiAdapter],
    [".github", githubcopilotAdapter],
  ];

  return checks
    .filter(([dir]) => existsSync(join(projectRoot, dir)))
    .map(([, adapter]) => adapter);
}

// ─── Install helpers ───────────────────────────────────────────────────────

/** Build the shared command metadata */
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

/** Install command files for all detected editors */
export function installForAllEditors(
  body: string,
  adapters: EditorAdapter[],
  projectRoot: string,
): void {
  const meta = buildCommandMeta(body);

  for (const adapter of adapters) {
    const relPath = adapter.getCommandPath(meta.id);
    const absPath = pathResolve(projectRoot, relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, adapter.formatCommand(meta));
    console.log(chalk.green(`  ✓ ${adapter.toolId}: ${relPath}`));
  }
}

/** Install SKILL.md only for Claude Code */
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

export { claudeAdapter, ALL_ADAPTERS };
