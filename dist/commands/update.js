import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
const SKILL_SRC = new URL('../../.claude/skills/openspec-e2e', import.meta.url).pathname;
const CMD_SRC = new URL('../../.claude/commands/opsx/e2e.md', import.meta.url).pathname;
export async function update(options) {
    console.log(chalk.blue('\n🔄 Updating OpenSpec + Playwright E2E\n'));
    const projectRoot = process.cwd();
    // 1. Update CLI tool
    if (options.cli !== false) {
        console.log(chalk.blue('─── Updating CLI ───'));
        try {
            execSync('npm install -g https://github.com/wxhou/openspec-playwright/archive/refs/heads/main.tar.gz', {
                stdio: 'inherit',
            });
            console.log(chalk.green('  ✓ CLI updated'));
        }
        catch {
            console.log(chalk.yellow('  ⚠ Failed to update CLI'));
            console.log(chalk.gray('  Run manually: npm install -g https://github.com/wxhou/openspec-playwright/archive/refs/heads/main.tar.gz'));
        }
    }
    // 2. Re-install skill and command
    if (options.skill !== false) {
        console.log(chalk.blue('\n─── Updating Skill & Command ───'));
        installSkill(projectRoot);
    }
    // Summary
    console.log(chalk.blue('\n─── Summary ───'));
    console.log(chalk.green('  ✓ Update complete!\n'));
    console.log(chalk.bold('Restart Claude Code to use the updated skill.'));
    console.log(chalk.gray('  Then run /opsx:e2e <change-name> to verify.\n'));
}
function installSkill(projectRoot) {
    const skillsDir = join(projectRoot, '.claude', 'skills');
    const skillDir = join(skillsDir, 'openspec-e2e');
    const cmdDir = join(projectRoot, '.claude', 'commands');
    // Copy skill
    mkdirSync(skillDir, { recursive: true });
    const skillContent = readFileSync(SKILL_SRC + '/SKILL.md', 'utf-8');
    writeFileSync(join(skillDir, 'SKILL.md'), skillContent);
    console.log(chalk.green(`  ✓ Skill updated: /openspec-e2e`));
    // Copy command
    mkdirSync(join(cmdDir, 'opsx'), { recursive: true });
    const cmdContent = readFileSync(CMD_SRC, 'utf-8');
    writeFileSync(join(cmdDir, 'opsx', 'e2e.md'), cmdContent);
    console.log(chalk.green(`  ✓ Command updated: /opsx:e2e`));
}
//# sourceMappingURL=update.js.map