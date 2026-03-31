import { existsSync, mkdirSync, writeFileSync } from 'fs';
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
/** Format tags as YAML inline array */
export function formatTagsArray(tags) {
    return `[${tags.map(t => escapeYamlValue(t)).join(', ')}]`;
}
/** Claude Code: .claude/commands/opsx/<id>.md + SKILL.md */
const claudeAdapter = {
    toolId: 'claude',
    hasSkill: true,
    getCommandPath(id) {
        return join('.claude', 'commands', 'opsx', `${id}.md`);
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
/** Cursor: .cursor/commands/opsx-<id>.md */
const cursorAdapter = {
    toolId: 'cursor',
    hasSkill: false,
    getCommandPath(id) {
        return join('.cursor', 'commands', `opsx-${id}.md`);
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
/** Windsurf: .windsurf/workflows/opsx-<id>.md */
const windsurfAdapter = {
    toolId: 'windsurf',
    hasSkill: false,
    getCommandPath(id) {
        return join('.windsurf', 'workflows', `opsx-${id}.md`);
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
/** Cline: .clinerules/workflows/opsx-<id>.md — markdown header only */
const clineAdapter = {
    toolId: 'cline',
    hasSkill: false,
    getCommandPath(id) {
        return join('.clinerules', 'workflows', `opsx-${id}.md`);
    },
    formatCommand(meta) {
        return `# ${meta.name}

${meta.description}

${meta.body}
`;
    },
};
/** Continue: .continue/prompts/opsx-<id>.prompt */
const continueAdapter = {
    toolId: 'continue',
    hasSkill: false,
    getCommandPath(id) {
        return join('.continue', 'prompts', `opsx-${id}.prompt`);
    },
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
/** All supported adapters */
const ALL_ADAPTERS = [
    claudeAdapter,
    cursorAdapter,
    windsurfAdapter,
    clineAdapter,
    continueAdapter,
];
/** Detect which editors are installed by checking their config directories */
export function detectEditors(projectRoot) {
    const checks = [
        ['.claude', claudeAdapter],
        ['.cursor', cursorAdapter],
        ['.windsurf', windsurfAdapter],
        ['.clinerules', clineAdapter],
        ['.continue', continueAdapter],
    ];
    return checks
        .filter(([dir]) => existsSync(join(projectRoot, dir)))
        .map(([, adapter]) => adapter);
}
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