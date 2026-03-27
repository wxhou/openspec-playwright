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
const CMD_SRC = new URL('../../.claude/commands/opsx', import.meta.url).pathname;
const SCHEMA_DIR = new URL('../../schemas', import.meta.url).pathname;

export interface UpdateOptions {
  cli?: boolean;
  skill?: boolean;
}

export async function update(options: UpdateOptions) {
  console.log(chalk.blue('\n🔄 Updating OpenSpec + Playwright E2E\n'));

  const projectRoot = process.cwd();

  // 1. Update CLI tool from npm
  if (options.cli !== false) {
    console.log(chalk.blue('─── Updating CLI ───'));
    try {
      execSync(
        'npm install -g openspec-playwright',
        { stdio: 'inherit', cwd: projectRoot }
      );
      console.log(chalk.green('  ✓ CLI updated via npm'));
    } catch {
      console.log(chalk.yellow('  ⚠ Failed to update CLI via npm'));
      console.log(
        chalk.gray('  Run manually: npm install -g openspec-playwright')
      );
    }
  }

  // 2. Update skill and command from npm tarball
  if (options.skill !== false) {
    console.log(chalk.blue('\n─── Updating Skill & Command ───'));
    try {
      // Download npm tarball and extract
      const tmpDir = '/tmp/openspec-e2e-update';
      execSync(`rm -rf ${tmpDir} && mkdir -p ${tmpDir}`, { stdio: 'pipe', cwd: projectRoot });
      execSync(
        `npm pack openspec-playwright --pack-destination ${tmpDir}`,
        { stdio: 'pipe', cwd: projectRoot }
      );
      const tarball = execSync(
        `ls -t ${tmpDir}/openspec-playwright-*.tgz | head -1`,
        { encoding: 'utf-8', cwd: projectRoot }
      ).trim();
      // Move tarball out before extracting to avoid "overwrite archive" error
      const tmpTarball = `${tmpDir}/package.tgz`;
      execSync(`mv "${tarball}" "${tmpTarball}"`, { stdio: 'pipe', cwd: projectRoot });
      execSync(`tar -xzf "${tmpTarball}" -C ${tmpDir} --strip-components=1`, { stdio: 'pipe', cwd: projectRoot });

      const skillSrc = join(tmpDir, '.claude', 'skills', 'openspec-e2e', 'SKILL.md');
      const cmdSrc = join(tmpDir, '.claude', 'commands', 'opsx', 'e2e.md');
      const schemaSrc = join(tmpDir, 'schemas', 'playwright-e2e');

      installSkillFrom(skillSrc, cmdSrc, schemaSrc, projectRoot);
      console.log(chalk.green('  ✓ Skill & command updated to latest'));
    } catch {
      console.log(chalk.yellow('  ⚠ Failed to update skill/command from npm'));
      console.log(chalk.gray('  Falling back to local files...'));
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
  installSkillFrom(
    join(SKILL_SRC, 'SKILL.md'),
    join(CMD_SRC, 'e2e.md'),
    join(SCHEMA_DIR, 'playwright-e2e'),
    projectRoot
  );
}

function installSkillFrom(skillSrc: string, cmdSrc: string, schemaSrc: string, projectRoot: string) {
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

function installSchemaFrom(schemaSrc: string, projectRoot: string) {
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
