import { execSync } from 'child_process';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'fs';
import { join } from 'path';
import chalk from 'chalk';

const SKILL_SRC = new URL('../../.claude/skills/openspec-e2e', import.meta.url).pathname;
const CMD_SRC = new URL('../../.claude/commands/opsx/e2e.md', import.meta.url).pathname;

export interface UpdateOptions {
  cli?: boolean;
  skill?: boolean;
}

export async function update(options: UpdateOptions) {
  console.log(chalk.blue('\n🔄 Updating OpenSpec + Playwright E2E\n'));

  const projectRoot = process.cwd();

  // 1. Update CLI tool (from git latest, not npm)
  if (options.cli !== false) {
    console.log(chalk.blue('─── Updating CLI ───'));
    try {
      execSync(
        'npm install -g https://github.com/wxhou/openspec-playwright/archive/refs/heads/main.tar.gz',
        { stdio: 'inherit' }
      );
      console.log(chalk.green('  ✓ CLI updated to latest commit'));
    } catch {
      console.log(chalk.yellow('  ⚠ Failed to update CLI'));
      console.log(
        chalk.gray('  Run manually: npm install -g https://github.com/wxhou/openspec-playwright/archive/refs/heads/main.tar.gz')
      );
    }
  }

  // 2. Update skill and command from git tarball (latest commit, not npm package)
  if (options.skill !== false) {
    console.log(chalk.blue('\n─── Updating Skill & Command ───'));
    try {
      // Download and extract latest SKILL.md from git
      const skillTarball = execSync(
        'curl -sL https://github.com/wxhou/openspec-playwright/archive/refs/heads/main.tar.gz',
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );

      // Write tarball to temp file and extract skill/command from it
      const tmpSkill = '/tmp/openspec-e2e-skill.tar.gz';
      const tmpDir = '/tmp/openspec-e2e-update';

      execSync(
        `curl -sL https://github.com/wxhou/openspec-playwright/archive/refs/heads/main.tar.gz -o ${tmpSkill}`,
        { stdio: 'pipe' }
      );
      execSync(`mkdir -p ${tmpDir} && tar -xzf ${tmpSkill} -C ${tmpDir}`, { stdio: 'pipe' });

      const skillSrc = `${tmpDir}/openspec-playwright-main/.claude/skills/openspec-e2e/SKILL.md`;
      const cmdSrc = `${tmpDir}/openspec-playwright-main/.claude/commands/opsx/e2e.md`;

      installSkillFrom(skillSrc, cmdSrc, projectRoot);
      console.log(chalk.green('  ✓ Skill & command updated to latest'));
    } catch {
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

function installSkill(projectRoot: string) {
  installSkillFrom(SKILL_SRC, CMD_SRC, projectRoot);
}

function installSkillFrom(skillSrc: string, cmdSrc: string, projectRoot: string) {
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
}
