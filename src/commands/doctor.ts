import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

export async function doctor() {
  console.log(chalk.blue('\n🔍 OpenSpec + Playwright E2E Prerequisites Check\n'));

  const projectRoot = process.cwd();
  let allOk = true;

  // Node.js
  console.log(chalk.blue('─── Node.js ───'));
  try {
    const node = execSync('node --version', { encoding: 'utf-8' }).trim();
    console.log(chalk.green(`  ✓ Node.js ${node}`));
  } catch {
    console.log(chalk.red('  ✗ Node.js not found'));
    allOk = false;
  }

  // npm
  console.log(chalk.blue('\n─── npm ───'));
  try {
    const npm = execSync('npm --version', { encoding: 'utf-8' }).trim();
    console.log(chalk.green(`  ✓ npm ${npm}`));
  } catch {
    console.log(chalk.red('  ✗ npm not found'));
    allOk = false;
  }

  // OpenSpec
  console.log(chalk.blue('\n─── OpenSpec ───'));
  const hasOpenSpec = existsSync(join(projectRoot, 'openspec'));
  if (hasOpenSpec) {
    console.log(chalk.green('  ✓ OpenSpec initialized'));
  } else {
    console.log(chalk.red('  ✗ OpenSpec not initialized'));
    console.log(chalk.gray('    Run: openspec init'));
    allOk = false;
  }

  // Playwright
  console.log(chalk.blue('\n─── Playwright ───'));
  const hasPlaywrightDir = existsSync(join(projectRoot, '.github'));
  if (hasPlaywrightDir) {
    console.log(chalk.green('  ✓ Playwright Test Agents initialized'));
  } else {
    console.log(chalk.red('  ✗ Playwright Test Agents not initialized'));
    console.log(chalk.gray('    Run: npx playwright init-agents --loop=claude'));
    allOk = false;
  }

  // Playwright MCP
  console.log(chalk.blue('\n─── Playwright MCP ───'));
  const settingsPath = join(projectRoot, '.claude', 'settings.local.json');
  let mcpConfigured = false;
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(
        readFileSync(settingsPath, 'utf-8')
      );
      if (settings.mcpServers?.['playwright-e2e']) {
        mcpConfigured = true;
      }
    } catch {
      // ignore
    }
  }
  if (mcpConfigured) {
    console.log(chalk.green('  ✓ Playwright MCP configured'));
  } else {
    console.log(chalk.red('  ✗ Playwright MCP not configured'));
    console.log(chalk.gray('    Run: openspec-pw init'));
    allOk = false;
  }

  // Skill
  console.log(chalk.blue('\n─── Claude Code Skill ───'));
  const hasSkill = existsSync(
    join(projectRoot, '.claude', 'skills', 'openspec-e2e', 'SKILL.md')
  );
  if (hasSkill) {
    console.log(chalk.green('  ✓ /openspec-e2e skill installed'));
  } else {
    console.log(chalk.red('  ✗ Skill not installed'));
    console.log(chalk.gray('    Run: openspec-pw init'));
    allOk = false;
  }

  // Seed test
  console.log(chalk.blue('\n─── Seed Test ───'));
  const hasSeed = existsSync(
    join(projectRoot, 'tests', 'playwright', 'seed.spec.ts')
  );
  if (hasSeed) {
    console.log(chalk.green('  ✓ seed.spec.ts found'));
  } else {
    console.log(chalk.yellow('  ⚠ seed.spec.ts not found (optional)'));
    console.log(chalk.gray('    Run: openspec-pw init --no-seed false'));
  }

  // Summary
  console.log(chalk.blue('\n─── Summary ───'));
  if (allOk) {
    console.log(chalk.green('  ✅ All prerequisites met!\n'));
    console.log(chalk.gray('  Run: /opsx:e2e <change-name> in Claude Code\n'));
  } else {
    console.log(chalk.red('  ❌ Some prerequisites are missing\n'));
    console.log(chalk.gray('  Run: openspec-pw init to fix\n'));
    process.exit(1);
  }
}
