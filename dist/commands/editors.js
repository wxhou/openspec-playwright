import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import chalk from 'chalk';
/** Shared YAML escape — matches OpenSpec's escape logic */
export function escapeYamlValue(value) {
    const needsQuoting = /[:\n\r#{}[\],&*!|>'"%@`]|^\s|\s$/.test(value);
    if (needsQuoting) {
        const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        return `"${escaped}"`;
    }
    return value;
}
/** Format tags as YAML inline array (escaped) */
export function formatTagsArray(tags) {
    return `[${tags.map(t => escapeYamlValue(t)).join(', ')}]`;
}
/** Format tags as YAML inline array (plain, no escaping) */
function formatTagsPlain(tags) {
    return `[${tags.join(', ')}]`;
}
/** Transform /opsx: to /opsx- for OpenCode */
function transformToHyphenCommands(text) {
    return text.replace(/\/opsx:/g, '/opsx-');
}
// ─── Claude Code ──────────────────────────────────────────────────────────────
/** Claude Code: .claude/commands/opsx/<id>.md + SKILL.md */
const claudeAdapter = {
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
const cursorAdapter = {
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
const windsurfAdapter = {
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
const clineAdapter = {
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
const continueAdapter = {
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
const amazonqAdapter = {
    toolId: 'amazon-q',
    hasSkill: false,
    getCommandPath(id) { return join('.amazonq', 'prompts', `opsx-${id}.md`); },
    formatCommand(meta) {
        return `---
description: ${escapeYamlValue(meta.description)}
---

${meta.body}
`;
    },
};
// ─── antigravity ──────────────────────────────────────────────────────────
/** Antigravity: .agent/workflows/opsx-<id>.md */
const antigravityAdapter = {
    toolId: 'antigravity',
    hasSkill: false,
    getCommandPath(id) { return join('.agent', 'workflows', `opsx-${id}.md`); },
    formatCommand(meta) {
        return `---
description: ${escapeYamlValue(meta.description)}
---

${meta.body}
`;
    },
};
// ─── auggie ────────────────────────────────────────────────────────────────
/** Auggie: .augment/commands/opsx-<id>.md */
const auggieAdapter = {
    toolId: 'auggie',
    hasSkill: false,
    getCommandPath(id) { return join('.augment', 'commands', `opsx-${id}.md`); },
    formatCommand(meta) {
        return `---
description: ${escapeYamlValue(meta.description)}
argument-hint: command arguments
---

${meta.body}
`;
    },
};
// ─── codebuddy ─────────────────────────────────────────────────────────────
/** CodeBuddy: .codebuddy/commands/opsx/<id>.md */
const codebuddyAdapter = {
    toolId: 'codebuddy',
    hasSkill: false,
    getCommandPath(id) { return join('.codebuddy', 'commands', 'opsx', `${id}.md`); },
    formatCommand(meta) {
        return `---
name: ${escapeYamlValue(meta.name)}
description: "${meta.description}"
argument-hint: "[command arguments]"
---

${meta.body}
`;
    },
};
// ─── codex ────────────────────────────────────────────────────────────────
/** Codex: <CODEX_HOME>/prompts/opsx-<id>.md — global scope */
const codexAdapter = {
    toolId: 'codex',
    hasSkill: false,
    getCommandPath(id) {
        const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex');
        return join(codexHome, 'prompts', `opsx-${id}.md`);
    },
    formatCommand(meta) {
        return `---
description: ${escapeYamlValue(meta.description)}
argument-hint: command arguments
---

${meta.body}
`;
    },
};
// ─── costrict ─────────────────────────────────────────────────────────────
/** CoStrict: .cospec/openspec/commands/opsx-<id>.md */
const costrictAdapter = {
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
/** Crush: .crush/commands/opsx/<id>.md — tags plain join */
const crushAdapter = {
    toolId: 'crush',
    hasSkill: false,
    getCommandPath(id) { return join('.crush', 'commands', 'opsx', `${id}.md`); },
    formatCommand(meta) {
        return `---
name: ${escapeYamlValue(meta.name)}
description: ${escapeYamlValue(meta.description)}
category: ${escapeYamlValue(meta.category)}
tags: ${formatTagsPlain(meta.tags)}
---

${meta.body}
`;
    },
};
// ─── factory ───────────────────────────────────────────────────────────────
/** Factory Droid: .factory/commands/opsx-<id>.md */
const factoryAdapter = {
    toolId: 'factory',
    hasSkill: false,
    getCommandPath(id) { return join('.factory', 'commands', `opsx-${id}.md`); },
    formatCommand(meta) {
        return `---
description: ${escapeYamlValue(meta.description)}
argument-hint: command arguments
---

${meta.body}
`;
    },
};
// ─── gemini ────────────────────────────────────────────────────────────────
/** Gemini CLI: .gemini/commands/opsx/<id>.toml */
const geminiAdapter = {
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
const githubcopilotAdapter = {
    toolId: 'github-copilot',
    hasSkill: false,
    getCommandPath(id) { return join('.github', 'prompts', `opsx-${id}.prompt.md`); },
    formatCommand(meta) {
        return `---
description: ${escapeYamlValue(meta.description)}
---

${meta.body}
`;
    },
};
// ─── iflow ────────────────────────────────────────────────────────────────
/** iFlow: .iflow/commands/opsx-<id>.md */
const iflowAdapter = {
    toolId: 'iflow',
    hasSkill: false,
    getCommandPath(id) { return join('.iflow', 'commands', `opsx-${id}.md`); },
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
// ─── kilocode ────────────────────────────────────────────────────────────
/** Kilo Code: .kilocode/workflows/opsx-<id>.md — body only */
const kilocodeAdapter = {
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
const kiroAdapter = {
    toolId: 'kiro',
    hasSkill: false,
    getCommandPath(id) { return join('.kiro', 'prompts', `opsx-${id}.prompt.md`); },
    formatCommand(meta) {
        return `---
description: ${escapeYamlValue(meta.description)}
---

${meta.body}
`;
    },
};
// ─── opencode ─────────────────────────────────────────────────────────────
/** OpenCode: .opencode/commands/opsx-<id>.md — transforms /opsx: to /opsx- */
const opencodeAdapter = {
    toolId: 'opencode',
    hasSkill: false,
    getCommandPath(id) { return join('.opencode', 'commands', `opsx-${id}.md`); },
    formatCommand(meta) {
        const transformed = transformToHyphenCommands(meta.body);
        return `---
description: ${escapeYamlValue(meta.description)}
---

${transformed}
`;
    },
};
// ─── pi ──────────────────────────────────────────────────────────────────
/** Pi: .pi/prompts/opsx-<id>.md */
const piAdapter = {
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
/** Qoder: .qoder/commands/opsx/<id>.md — tags plain join */
const qoderAdapter = {
    toolId: 'qoder',
    hasSkill: false,
    getCommandPath(id) { return join('.qoder', 'commands', 'opsx', `${id}.md`); },
    formatCommand(meta) {
        return `---
name: ${escapeYamlValue(meta.name)}
description: ${escapeYamlValue(meta.description)}
category: ${escapeYamlValue(meta.category)}
tags: ${formatTagsPlain(meta.tags)}
---

${meta.body}
`;
    },
};
// ─── qwen ────────────────────────────────────────────────────────────────
/** Qwen Code: .qwen/commands/opsx-<id>.toml */
const qwenAdapter = {
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
const roocodeAdapter = {
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
const ALL_ADAPTERS = [
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
export function detectEditors(projectRoot) {
    const checks = [
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
export function detectCodex() {
    const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex');
    return existsSync(codexHome) ? codexAdapter : null;
}
// ─── Install helpers ───────────────────────────────────────────────────────
/** Build the shared command metadata */
export function buildCommandMeta(body) {
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
export function installForAllEditors(body, adapters, projectRoot) {
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
export function installSkill(projectRoot, skillContent) {
    const skillDir = join(projectRoot, '.claude', 'skills', 'openspec-e2e');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), skillContent);
    console.log(chalk.green(`  ✓ claude: .claude/skills/openspec-e2e/SKILL.md`));
}
export { claudeAdapter };
//# sourceMappingURL=editors.js.map