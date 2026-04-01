import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, resolve as pathResolve } from 'path';
import chalk from 'chalk';

/** Shared YAML escape — matches OpenSpec's escape logic */
export function escapeYamlValue(value: string): string {
  const needsQuoting = /[:\n\r#{}[\],&*!|>'"%@`]|^\s|\s$/.test(value);
  if (needsQuoting) {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `"${escaped}"`;
  }
  return value;
}

/** Format tags as YAML inline array (escaped) */
export function formatTagsArray(tags: string[]): string {
  return `[${tags.map(t => escapeYamlValue(t)).join(', ')}]`;
}

/** Format tags as YAML inline array (plain, no escaping) */
function formatTagsPlain(tags: string[]): string {
  return `[${tags.join(', ')}]`;
}

/** Transform /opsx: to /opsx- for OpenCode */
function transformToHyphenCommands(text: string): string {
  return text.replace(/\/opsx:/g, '/opsx-');
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
  toolId: 'claude',
  hasSkill: true,
  getCommandPath(id) { return join('.claude', 'commands', 'opsx', `${id}.md`); },
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
  toolId: 'cursor',
  hasSkill: false,
  getCommandPath(id) { return join('.cursor', 'commands', `opsx-${id}.md`); },
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
  toolId: 'windsurf',
  hasSkill: false,
  getCommandPath(id) { return join('.windsurf', 'workflows', `opsx-${id}.md`); },
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

// ─── Cline ──────────────────────────────────────────────────────────────────

/** Cline: .clinerules/workflows/opsx-<id>.md — markdown header only */
const clineAdapter: EditorAdapter = {
  toolId: 'cline',
  hasSkill: false,
  getCommandPath(id) { return join('.clinerules', 'workflows', `opsx-${id}.md`); },
  formatCommand(meta) {
    return `# ${meta.name}

${meta.description}

${meta.body}
`;
  },
};

// ─── Continue ────────────────────────────────────────────────────────────────

/** Continue: .continue/prompts/opsx-<id>.prompt */
const continueAdapter: EditorAdapter = {
  toolId: 'continue',
  hasSkill: false,
  getCommandPath(id) { return join('.continue', 'prompts', `opsx-${id}.prompt`); },
  formatCommand(meta) {
    return `---
name: opsx-${meta.id}
description: ${meta.description}
invokable: true
---

${meta.body}
`;
  },
};

// ─── amazon-q ─────────────────────────────────────────────────────────────

/** Amazon Q: .amazonq/prompts/opsx-<id>.md */
const amazonqAdapter: EditorAdapter = {
  toolId: 'amazon-q',
  hasSkill: false,
  getCommandPath(id) { return join('.amazonq', 'prompts', `opsx-${id}.md`); },
  formatCommand(meta) {
    return `---
description: ${meta.description}
---

${meta.body}
`;
  },
};

// ─── antigravity ──────────────────────────────────────────────────────────

/** Antigravity: .agent/workflows/opsx-<id>.md */
const antigravityAdapter: EditorAdapter = {
  toolId: 'antigravity',
  hasSkill: false,
  getCommandPath(id) { return join('.agent', 'workflows', `opsx-${id}.md`); },
  formatCommand(meta) {
    return `---
description: ${meta.description}
---

${meta.body}
`;
  },
};

// ─── auggie ────────────────────────────────────────────────────────────────

/** Auggie: .augment/commands/opsx-<id>.md */
const auggieAdapter: EditorAdapter = {
  toolId: 'auggie',
  hasSkill: false,
  getCommandPath(id) { return join('.augment', 'commands', `opsx-${id}.md`); },
  formatCommand(meta) {
    return `---
description: ${meta.description}
argument-hint: command arguments
---

${meta.body}
`;
  },
};

// ─── codebuddy ─────────────────────────────────────────────────────────────

/** CodeBuddy: .codebuddy/commands/opsx/<id>.md */
const codebuddyAdapter: EditorAdapter = {
  toolId: 'codebuddy',
  hasSkill: false,
  getCommandPath(id) { return join('.codebuddy', 'commands', 'opsx', `${id}.md`); },
  formatCommand(meta) {
    return `---
name: ${meta.name}
description: "${meta.description}"
argument-hint: "[command arguments]"
---

${meta.body}
`;
  },
};

// ─── codex ────────────────────────────────────────────────────────────────

/** Codex: <CODEX_HOME>/prompts/opsx-<id>.md — global scope */
const codexAdapter: EditorAdapter = {
  toolId: 'codex',
  hasSkill: false,
  getCommandPath(id) {
    const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex');
    // pathResolve: if codexHome is absolute (C:\...), it returns codexHome directly
    // if relative, it resolves against projectRoot
    return pathResolve(codexHome, 'prompts', `opsx-${id}.md`);
  },
  formatCommand(meta) {
    return `---
description: ${meta.description}
argument-hint: command arguments
---

${meta.body}
`;
  },
};

// ─── costrict ─────────────────────────────────────────────────────────────

/** CoStrict: .cospec/openspec/commands/opsx-<id>.md */
const costrictAdapter: EditorAdapter = {
  toolId: 'costrict',
  hasSkill: false,
  getCommandPath(id) { return join('.cospec', 'openspec', 'commands', `opsx-${id}.md`); },
  formatCommand(meta) {
    return `---
description: "${meta.description}"
argument-hint: command arguments
---

${meta.body}
`;
  },
};

// ─── crush ────────────────────────────────────────────────────────────────

/** Crush: .crush/commands/opsx/<id>.md — raw values, no escaping */
const crushAdapter: EditorAdapter = {
  toolId: 'crush',
  hasSkill: false,
  getCommandPath(id) { return join('.crush', 'commands', 'opsx', `${id}.md`); },
  formatCommand(meta) {
    return `---
name: ${meta.name}
description: ${meta.description}
category: ${meta.category}
tags: ${formatTagsPlain(meta.tags)}
---

${meta.body}
`;
  },
};

// ─── factory ───────────────────────────────────────────────────────────────

/** Factory Droid: .factory/commands/opsx-<id>.md */
const factoryAdapter: EditorAdapter = {
  toolId: 'factory',
  hasSkill: false,
  getCommandPath(id) { return join('.factory', 'commands', `opsx-${id}.md`); },
  formatCommand(meta) {
    return `---
description: ${meta.description}
argument-hint: command arguments
---

${meta.body}
`;
  },
};

// ─── gemini ────────────────────────────────────────────────────────────────

/** Gemini CLI: .gemini/commands/opsx/<id>.toml */
const geminiAdapter: EditorAdapter = {
  toolId: 'gemini',
  hasSkill: false,
  getCommandPath(id) { return join('.gemini', 'commands', 'opsx', `${id}.toml`); },
  formatCommand(meta) {
    return `description = "${meta.description}"

prompt = """
${meta.body}
"""
`;
  },
};

// ─── github-copilot ────────────────────────────────────────────────────────

/** GitHub Copilot: .github/prompts/opsx-<id>.prompt.md */
const githubcopilotAdapter: EditorAdapter = {
  toolId: 'github-copilot',
  hasSkill: false,
  getCommandPath(id) { return join('.github', 'prompts', `opsx-${id}.prompt.md`); },
  formatCommand(meta) {
    return `---
description: ${meta.description}
---

${meta.body}
`;
  },
};

// ─── iflow ────────────────────────────────────────────────────────────────

/** iFlow: .iflow/commands/opsx-<id>.md */
const iflowAdapter: EditorAdapter = {
  toolId: 'iflow',
  hasSkill: false,
  getCommandPath(id) { return join('.iflow', 'commands', `opsx-${id}.md`); },
  formatCommand(meta) {
    return `---
name: /opsx-${meta.id}
id: opsx-${meta.id}
category: ${meta.category}
description: ${meta.description}
---

${meta.body}
`;
  },
};

// ─── kilocode ────────────────────────────────────────────────────────────

/** Kilo Code: .kilocode/workflows/opsx-<id>.md — body only */
const kilocodeAdapter: EditorAdapter = {
  toolId: 'kilocode',
  hasSkill: false,
  getCommandPath(id) { return join('.kilocode', 'workflows', `opsx-${id}.md`); },
  formatCommand(meta) {
    return `${meta.body}
`;
  },
};

// ─── kiro ─────────────────────────────────────────────────────────────────

/** Kiro: .kiro/prompts/opsx-<id>.prompt.md */
const kiroAdapter: EditorAdapter = {
  toolId: 'kiro',
  hasSkill: false,
  getCommandPath(id) { return join('.kiro', 'prompts', `opsx-${id}.prompt.md`); },
  formatCommand(meta) {
    return `---
description: ${meta.description}
---

${meta.body}
`;
  },
};

// ─── opencode ─────────────────────────────────────────────────────────────

/** OpenCode: .opencode/commands/opsx-<id>.md — transforms /opsx: to /opsx- */
const opencodeAdapter: EditorAdapter = {
  toolId: 'opencode',
  hasSkill: false,
  getCommandPath(id) { return join('.opencode', 'commands', `opsx-${id}.md`); },
  formatCommand(meta) {
    const transformed = transformToHyphenCommands(meta.body);
    return `---
description: ${meta.description}
---

${transformed}
`;
  },
};

// ─── pi ──────────────────────────────────────────────────────────────────

/** Pi: .pi/prompts/opsx-<id>.md */
const piAdapter: EditorAdapter = {
  toolId: 'pi',
  hasSkill: false,
  getCommandPath(id) { return join('.pi', 'prompts', `opsx-${id}.md`); },
  formatCommand(meta) {
    return `---
description: ${escapeYamlValue(meta.description)}
---

${meta.body}
`;
  },
};

// ─── qoder ────────────────────────────────────────────────────────────────

/** Qoder: .qoder/commands/opsx/<id>.md — raw values, no escaping */
const qoderAdapter: EditorAdapter = {
  toolId: 'qoder',
  hasSkill: false,
  getCommandPath(id) { return join('.qoder', 'commands', 'opsx', `${id}.md`); },
  formatCommand(meta) {
    return `---
name: ${meta.name}
description: ${meta.description}
category: ${meta.category}
tags: ${formatTagsPlain(meta.tags)}
---

${meta.body}
`;
  },
};

// ─── qwen ────────────────────────────────────────────────────────────────

/** Qwen Code: .qwen/commands/opsx-<id>.toml */
const qwenAdapter: EditorAdapter = {
  toolId: 'qwen',
  hasSkill: false,
  getCommandPath(id) { return join('.qwen', 'commands', `opsx-${id}.toml`); },
  formatCommand(meta) {
    return `description = "${meta.description}"

prompt = """
${meta.body}
"""
`;
  },
};

// ─── roocode ─────────────────────────────────────────────────────────────

/** RooCode: .roo/commands/opsx-<id>.md — markdown header */
const roocodeAdapter: EditorAdapter = {
  toolId: 'roocode',
  hasSkill: false,
  getCommandPath(id) { return join('.roo', 'commands', `opsx-${id}.md`); },
  formatCommand(meta) {
    return `# ${meta.name}

${meta.description}

${meta.body}
`;
  },
};

// ─── Detection map ───────────────────────────────────────────────────────

const ALL_ADAPTERS: EditorAdapter[] = [
  claudeAdapter,
  cursorAdapter,
  windsurfAdapter,
  clineAdapter,
  continueAdapter,
  amazonqAdapter,
  antigravityAdapter,
  auggieAdapter,
  codebuddyAdapter,
  codexAdapter,
  costrictAdapter,
  crushAdapter,
  factoryAdapter,
  geminiAdapter,
  githubcopilotAdapter,
  iflowAdapter,
  kilocodeAdapter,
  kiroAdapter,
  opencodeAdapter,
  piAdapter,
  qoderAdapter,
  qwenAdapter,
  roocodeAdapter,
];

/** Detect which editors are installed by checking their config directories */
export function detectEditors(projectRoot: string): EditorAdapter[] {
  const checks: Array<[string, EditorAdapter]> = [
    ['.claude', claudeAdapter],
    ['.cursor', cursorAdapter],
    ['.windsurf', windsurfAdapter],
    ['.clinerules', clineAdapter],
    ['.continue', continueAdapter],
    ['.amazonq', amazonqAdapter],
    ['.agent', antigravityAdapter],
    ['.augment', auggieAdapter],
    ['.codebuddy', codebuddyAdapter],
    ['.cospec', costrictAdapter],
    ['.crush', crushAdapter],
    ['.factory', factoryAdapter],
    ['.gemini', geminiAdapter],
    ['.github', githubcopilotAdapter],
    ['.iflow', iflowAdapter],
    ['.kilocode', kilocodeAdapter],
    ['.kiro', kiroAdapter],
    ['.opencode', opencodeAdapter],
    ['.pi', piAdapter],
    ['.qoder', qoderAdapter],
    ['.qwen', qwenAdapter],
    ['.roo', roocodeAdapter],
  ];

  return checks
    .filter(([dir]) => existsSync(join(projectRoot, dir)))
    .map(([, adapter]) => adapter);
}

// ─── Codex is global — detect separately ─────────────────────────────────

/** Detect Codex by checking if CODEX_HOME or ~/.codex exists */
export function detectCodex(): EditorAdapter | null {
  const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex');
  return existsSync(codexHome) ? codexAdapter : null;
}

// ─── Install helpers ───────────────────────────────────────────────────────

/** Build the shared command metadata */
export function buildCommandMeta(body: string): CommandMeta {
  return {
    id: 'e2e',
    name: 'OPSX: E2E',
    description: 'Run Playwright E2E verification for an OpenSpec change',
    category: 'OpenSpec',
    tags: ['openspec', 'playwright', 'e2e', 'testing'],
    body,
  };
}

/** Install command files for all detected editors */
export function installForAllEditors(
  body: string,
  adapters: EditorAdapter[],
  projectRoot: string
): void {
  const meta = buildCommandMeta(body);

  for (const adapter of adapters) {
    const relPath = adapter.getCommandPath(meta.id);
    const absPath = join(projectRoot, relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, adapter.formatCommand(meta));
    console.log(chalk.green(`  ✓ ${adapter.toolId}: ${relPath}`));
  }
}

/** Install SKILL.md only for Claude Code */
export function installSkill(projectRoot: string, skillContent: string): void {
  const skillDir = join(projectRoot, '.claude', 'skills', 'openspec-e2e');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), skillContent);
  console.log(chalk.green(`  ✓ claude: .claude/skills/openspec-e2e/SKILL.md`));
}

/** Install project-level CLAUDE.md with employee-grade standards + OpenSpec context */
export function installProjectClaudeMd(projectRoot: string, standardsContent: string): void {
  const dest = join(projectRoot, 'CLAUDE.md');
  const exists = existsSync(dest);
  if (exists) {
    // Append standards inside OPENSPEC:START/END markers
    const existing = readFileSync(dest, 'utf-8');
    const markerStart = '<!-- OPENSPEC:START -->';
    const markerEnd = '<!-- OPENSPEC:END -->';

    if (existing.includes(markerStart) && existing.includes(markerEnd)) {
      // Already has markers, skip
      console.log(chalk.gray('  - CLAUDE.md already has standards markers, skipping'));
    } else {
      const updated = existing.trim() + '\n\n' + markerStart + '\n\n' + standardsContent + '\n\n' + markerEnd + '\n';
      writeFileSync(dest, updated);
      console.log(chalk.green('  ✓ CLAUDE.md: appended employee-grade standards'));
    }
  } else {
    // No existing CLAUDE.md, create from template
    const content = `# ${projectRoot.split('/').pop()}\n\n` + standardsContent;
    writeFileSync(dest, content);
    console.log(chalk.green('  ✓ CLAUDE.md: created with employee-grade standards'));
  }
}

/** Read the employee-grade standards from a source file */
export function readEmployeeStandards(srcPath: string): string {
  return existsSync(srcPath) ? readFileSync(srcPath, 'utf-8') : '';
}

export { claudeAdapter, ALL_ADAPTERS };
