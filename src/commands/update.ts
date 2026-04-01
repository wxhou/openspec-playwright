import { execSync, exec } from 'child_process';
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
import chalk from 'chalk';
import * as tar from 'tar';
import { syncMcpTools } from './mcpSync.js';
import { detectEditors, detectCodex, installForAllEditors, installSkill } from './editors.js';

const CMD_BODY_SRC = fileURLToPath(new URL('../../.claude/commands/opsx/e2e-body.md', import.meta.url));
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

  // 2. Update commands for all detected editors + schema
  if (options.skill !== false) {
    console.log(chalk.blue('\n─── Updating Commands & Schema ───'));
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

      const bodySrc = join(tmpDir, '.claude', 'commands', 'opsx', 'e2e-body.md');
      const schemaSrc = join(tmpDir, 'schemas', 'playwright-e2e');

      // Install commands for all detected editors
      const detected = detectEditors(projectRoot);
      const codex = detectCodex();
      const adapters = codex ? [...detected, codex] : detected;
      if (adapters.length > 0 && existsSync(bodySrc)) {
        const body = readFileSync(bodySrc, 'utf-8');
        installForAllEditors(body, adapters, projectRoot);
      }

      // Install SKILL.md for Claude Code
      const skillSrc = join(tmpDir, '.claude', 'skills', 'openspec-e2e', 'SKILL.md');
      if (existsSync(join(projectRoot, '.claude')) && existsSync(skillSrc)) {
        const skillContent = readFileSync(skillSrc, 'utf-8');
        installSkill(projectRoot, skillContent);
      }

      // Install schema
      installSchemaFrom(schemaSrc, projectRoot);

      rmSync(tmpDir, { recursive: true, force: true });
      console.log(chalk.green('  ✓ Commands & schema updated to latest'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.yellow(`  ⚠ Failed to update from npm: ${msg}`));
      console.log(chalk.gray('  Trying npm install to pull latest version...'));
      try {
        execSync('npm install -g openspec-playwright', { stdio: 'inherit', cwd: projectRoot });
        console.log(chalk.green('  ✓ Updated via npm install'));
      } catch {
        console.log(chalk.red('  ✗ Failed to update. Run manually:'));
        console.log(chalk.gray('    npm install -g openspec-playwright'));
      }
    }
  }

  // 3. Sync Healer tools (Claude Code only)
  if (existsSync(join(projectRoot, '.claude', 'skills', 'openspec-e2e', 'SKILL.md'))) {
    console.log(chalk.blue('\n─── Syncing Healer Tools ───'));
    const skillDest = join(projectRoot, '.claude', 'skills', 'openspec-e2e', 'SKILL.md');
    await syncMcpTools(skillDest, true);
  }

  // Summary
  console.log(chalk.blue('\n─── Summary ───'));
  console.log(chalk.green('  ✓ Update complete!\n'));

  if (existsSync(join(projectRoot, '.claude'))) {
    console.log(chalk.bold('Restart Claude Code to use the updated skill.'));
    console.log(chalk.gray('  Then run /opsx:e2e <change-name> to verify.\n'));
  } else {
    console.log(chalk.bold('Restart your AI coding assistant to use the updated commands.'));
    console.log(chalk.gray('  Then run openspec-pw run <change-name> to verify.\n'));
  }
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
    const templateFiles = ['test-plan.md', 'report.md', 'e2e-test.ts', 'playwright.config.ts', 'app-knowledge.md'];
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
