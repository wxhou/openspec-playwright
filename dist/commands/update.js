import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
const SKILL_SRC = new URL('../../.claude/skills/openspec-e2e', import.meta.url).pathname;
const CMD_SRC = new URL('../../.claude/commands/opsx/e2e.md', import.meta.url).pathname;
const SCHEMA_DIR = new URL('../../schemas', import.meta.url).pathname;
export async function update(options) {
    console.log(chalk.blue('\n🔄 Updating OpenSpec + Playwright E2E\n'));
    const projectRoot = process.cwd();
    // 1. Update CLI tool (from git latest, not npm)
    if (options.cli !== false) {
        console.log(chalk.blue('─── Updating CLI ───'));
        try {
            execSync('npm install -g https://github.com/wxhou/openspec-playwright/archive/refs/heads/main.tar.gz', { stdio: 'inherit' });
            console.log(chalk.green('  ✓ CLI updated to latest commit'));
        }
        catch {
            console.log(chalk.yellow('  ⚠ Failed to update CLI'));
            console.log(chalk.gray('  Run manually: npm install -g https://github.com/wxhou/openspec-playwright/archive/refs/heads/main.tar.gz'));
        }
    }
    // 2. Update skill and command from git tarball (latest commit, not npm package)
    if (options.skill !== false) {
        console.log(chalk.blue('\n─── Updating Skill & Command ───'));
        try {
            // Download tarball to temp file and extract
            const tmpSkill = '/tmp/openspec-e2e-skill.tar.gz';
            const tmpDir = '/tmp/openspec-e2e-update';
            execSync(`curl -sL https://github.com/wxhou/openspec-playwright/archive/refs/heads/main.tar.gz -o ${tmpSkill}`, { stdio: 'pipe' });
            // Clean and re-extract to avoid stale files from previous runs
            execSync(`rm -rf ${tmpDir} && mkdir -p ${tmpDir} && tar -xzf ${tmpSkill} -C ${tmpDir} --strip-components=1`, { stdio: 'pipe' });
            const skillSrc = `${tmpDir}/.claude/skills/openspec-e2e/SKILL.md`;
            const cmdSrc = `${tmpDir}/.claude/commands/opsx/e2e.md`;
            const schemaSrc = `${tmpDir}/schemas/playwright-e2e`;
            installSkillFrom(skillSrc, cmdSrc, schemaSrc, projectRoot);
            console.log(chalk.green('  ✓ Skill & command updated to latest'));
        }
        catch {
            console.log(chalk.yellow('  ⚠ Failed to update skill/command from git'));
            console.log(chalk.gray('  Running from npm package instead...'));
            installSkill(projectRoot);
        }
    }
    // Summary
    console.log(chalk.blue('\n─── Summary ───'));
    console.log(chalk.green('  ✓ Update complete!\n'));
    console.log(chalk.bold('Restart Claude Code to use the updated skill.'));
    console.log(chalk.gray('  Then run /opsx:e2e <change-name> to verify.\n'));
}
function installSkill(projectRoot) {
    installSkillFrom(SKILL_SRC, CMD_SRC, SCHEMA_DIR + '/playwright-e2e', projectRoot);
}
function installSkillFrom(skillSrc, cmdSrc, schemaSrc, projectRoot) {
    const skillDir = join(projectRoot, '.claude', 'skills', 'openspec-e2e');
    const cmdDir = join(projectRoot, '.claude', 'commands');
    mkdirSync(skillDir, { recursive: true });
    const skillContent = readFileSync(skillSrc, 'utf-8');
    writeFileSync(join(skillDir, 'SKILL.md'), skillContent);
    console.log(chalk.green(`  ✓ Skill updated: /openspec-e2e`));
    mkdirSync(join(cmdDir, 'opsx'), { recursive: true });
    const cmdContent = readFileSync(cmdSrc, 'utf-8');
    writeFileSync(join(cmdDir, 'opsx', 'e2e.md'), cmdContent);
    console.log(chalk.green(`  ✓ Command updated: /opsx:e2e`));
    installSchemaFrom(schemaSrc, projectRoot);
}
function installSchemaFrom(schemaSrc, projectRoot) {
    const schemaDest = join(projectRoot, 'openspec', 'schemas', 'playwright-e2e');
    mkdirSync(schemaDest, { recursive: true });
    // Copy schema.yaml
    const schemaYamlSrc = join(schemaSrc, 'schema.yaml');
    if (existsSync(schemaYamlSrc)) {
        writeFileSync(join(schemaDest, 'schema.yaml'), readFileSync(schemaYamlSrc));
    }
    // Copy templates
    const templatesSrc = join(schemaSrc, 'templates');
    const templatesDest = join(schemaDest, 'templates');
    if (existsSync(templatesSrc)) {
        mkdirSync(templatesDest, { recursive: true });
        const templateFiles = ['test-plan.md', 'report.md', 'e2e-test.ts', 'playwright.config.ts'];
        for (const file of templateFiles) {
            const src = join(templatesSrc, file);
            const dest = join(templatesDest, file);
            if (existsSync(src)) {
                writeFileSync(dest, readFileSync(src));
            }
        }
    }
    console.log(chalk.green('  ✓ Schema updated: openspec/schemas/playwright-e2e/'));
}
//# sourceMappingURL=update.js.map