import { execSync } from 'child_process';
import { existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readdirSync,
  statSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import chalk from 'chalk';
import * as tar from 'tar';
import { syncMcpTools } from './mcpSync.js';

const SKILL_SRC = fileURLToPath(new URL('../../.claude/skills/openspec-e2e', import.meta.url));
const CMD_SRC = fileURLToPath(new URL('../../.claude/commands/opsx', import.meta.url));
const SCHEMA_DIR = fileURLToPath(new URL('../../schemas', import.meta.url));

export interface UpdateOptions {
  cli?: boolean;
  skill?: boolean;
}

export async function update(options: UpdateOptions) {
  console.log(chalk.blue('\n🔄 Updating OpenSpec + Playwright E2E\n'));

  const projectRoot = process.cwd();

  // Check if init has been run
  const hasSkill = existsSync(join(projectRoot, '.claude', 'skills', 'openspec-e2e', 'SKILL.md'));
  const hasOpenSpec = existsSync(join(projectRoot, 'openspec'));
  if (!hasSkill && !hasOpenSpec) {
    console.log(chalk.yellow('  ⚠ OpenSpec + Playwright E2E not initialized.'));
    console.log(chalk.gray('  Run "openspec-pw init" first to set up the integration.\n'));
    return;
  }

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
      const tmpDir = join(tmpdir(), 'openspec-e2e-update');
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });

      const execAsync = promisify(exec);
      await execAsync(
        `npm pack openspec-playwright --pack-destination ${tmpDir}`,
        { timeout: 30000 }
      );

      // Find the latest tarball by mtime
      const tgzFiles = readdirSync(tmpDir)
        .filter(f => f.startsWith('openspec-playwright-') && f.endsWith('.tgz'))
        .map(f => ({ name: f, mtime: statSync(join(tmpDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      if (tgzFiles.length === 0) throw new Error('No tarball found');
      const tarballPath = join(tmpDir, tgzFiles[0].name);

      // Extract tarball
      await tar.extract({ file: tarballPath, cwd: tmpDir, strip: 1 });

      const skillSrc = join(tmpDir, '.claude', 'skills', 'openspec-e2e', 'SKILL.md');
      const cmdSrc = join(tmpDir, '.claude', 'commands', 'opsx', 'e2e.md');
      const schemaSrc = join(tmpDir, 'schemas', 'playwright-e2e');

      installSkillFrom(skillSrc, cmdSrc, schemaSrc, projectRoot);
      rmSync(tmpDir, { recursive: true, force: true });
      console.log(chalk.green('  ✓ Skill & command updated to latest'));
    } catch {
      console.log(chalk.yellow('  ⚠ Failed to update skill/command from npm'));
      console.log(chalk.gray('  Falling back to local files...'));
      installSkill(projectRoot);
    }
  }

  // 3. Sync Healer tools with latest @playwright/mcp
  console.log(chalk.blue('\n─── Syncing Healer Tools ───'));
  const skillDest = join(projectRoot, '.claude', 'skills', 'openspec-e2e', 'SKILL.md');
  await syncMcpTools(skillDest, true);

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
  const schemaYamlSrc = join(schemaSrc, 'schema.yaml');
  if (existsSync(schemaYamlSrc)) {
    writeFileSync(join(schemaDest, 'schema.yaml'), readFileSync(schemaYamlSrc));
  }

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
