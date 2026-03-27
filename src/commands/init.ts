import { execSync } from 'child_process';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { readFile } from 'fs/promises';

const TEMPLATE_DIR = new URL('../templates', import.meta.url).pathname;
const SKILL_SRC = new URL('../.claude/skills/openspec-e2e', import.meta.url).pathname;
const CMD_SRC = new URL('../.claude/commands/opsx/e2e.md', import.meta.url).pathname;

export interface InitOptions {
  change?: string;
  playwrightInit?: boolean;
  mcp?: boolean;
  seed?: boolean;
}

export async function init(options: InitOptions) {
  console.log(chalk.blue('\n🔧 OpenSpec + Playwright E2E Setup\n'));

  const projectRoot = process.cwd();

  // 1. Check prerequisites
  console.log(chalk.blue('─── Prerequisites ───'));

  const hasNode = execCmd('node --version', 'Node.js', true);
  const hasNpm = execCmd('npm --version', 'npm', true);
  const hasOpenspec = execCmd('npx openspec --version 2>/dev/null || echo "not found"', 'OpenSpec', true);

  if (!hasNode || !hasNpm) {
    console.log(chalk.red('  ✗ Node.js/npm is required'));
    process.exit(1);
  }
  console.log(chalk.green('  ✓ Node.js and npm found'));

  // 2. Check OpenSpec
  if (!existsSync(join(projectRoot, 'openspec'))) {
    console.log(chalk.yellow('\n⚠ OpenSpec not initialized. Run these commands first:'));
    console.log(chalk.gray('  npm install -g @fission-ai/openspec'));
    console.log(chalk.gray('  openspec init'));
    console.log(chalk.gray('  openspec config profile core'));
    console.log(chalk.gray('  openspec update\n'));
    console.log(chalk.gray('  Then run openspec-pw init again.\n'));
    return;
  }
  console.log(chalk.green('  ✓ OpenSpec initialized'));

  // 3. Install Playwright agents
  if (options.playwrightInit !== false) {
    console.log(chalk.blue('\n─── Installing Playwright Test Agents ───'));

    // Check if already installed
    if (existsSync(join(projectRoot, '.github'))) {
      console.log(chalk.green('  ✓ Playwright agents already installed'));
    } else {
      try {
        execSync('npx playwright init-agents --loop=claude', {
          cwd: projectRoot,
          stdio: 'inherit',
        });
        console.log(chalk.green('  ✓ Playwright Test Agents initialized'));
      } catch {
        console.log(chalk.yellow('  ⚠ Failed to run playwright init-agents'));
        console.log(chalk.gray('  Try manually: npx playwright init-agents --loop=claude'));
      }
    }
  }

  // 4. Configure Playwright MCP
  if (options.mcp !== false) {
    console.log(chalk.blue('\n─── Configuring Playwright MCP ───'));
    await configurePlaywrightMCP(projectRoot);
  }

  // 5. Copy skill files
  console.log(chalk.blue('\n─── Installing Claude Code Skill ───'));
  await installSkill(projectRoot);

  // 6. Generate seed test
  if (options.seed !== false) {
    console.log(chalk.blue('\n─── Generating Seed Test ───'));
    await generateSeedTest(projectRoot);
  }

  // 7. Summary
  console.log(chalk.blue('\n─── Summary ───'));
  console.log(chalk.green('  ✓ Setup complete!\n'));

  console.log(chalk.bold('Next steps:'));
  console.log(chalk.gray('  1. Start your dev server: npm run dev'));
  console.log(chalk.gray('  2. In Claude Code, run: /opsx:e2e <change-name>'));
  console.log(chalk.gray('  3. Or: openspec-pw doctor to verify setup\n'));

  console.log(chalk.bold('How it works:'));
  console.log(chalk.gray('  /opsx:e2e reads your OpenSpec specs and runs Playwright'));
  console.log(chalk.gray('  E2E tests through a three-agent pipeline:'));
  console.log(chalk.gray('  Planner → Generator → Healer\n'));
}

async function configurePlaywrightMCP(projectRoot: string) {
  const claudeDir = join(projectRoot, '.claude');
  mkdirSync(claudeDir, { recursive: true });

  const settingsPath = join(claudeDir, 'settings.local.json');
  let settings: Record<string, any> = {};

  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    } catch {
      // ignore
    }
  }

  if (!settings.mcpServers) {
    settings.mcpServers = {};
  }

  const playwrightMCP = {
    command: 'npx',
    args: ['@playwright/mcp', 'start'],
  };

  // Check if already configured
  const existingKeys = Object.keys(settings.mcpServers);
  const hasPlaywrightMCP = existingKeys.some(
    (k) => settings.mcpServers[k]?.command === 'npx' &&
           settings.mcpServers[k]?.args?.includes('@playwright/mcp')
  );

  if (hasPlaywrightMCP) {
    console.log(chalk.green('  ✓ Playwright MCP already configured'));
  } else {
    settings.mcpServers['playwright-e2e'] = playwrightMCP;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log(chalk.green('  ✓ Playwright MCP configured in .claude/settings.local.json'));
    console.log(chalk.gray('  (Restart Claude Code to activate the MCP server)'));
  }
}

async function installSkill(projectRoot: string) {
  const skillsDir = join(projectRoot, '.claude', 'skills');
  const skillDir = join(skillsDir, 'openspec-e2e');
  const cmdDir = join(projectRoot, '.claude', 'commands');

  // Copy skill
  mkdirSync(skillDir, { recursive: true });
  const skillContent = await readFile(SKILL_SRC + '/SKILL.md', 'utf-8');
  writeFileSync(join(skillDir, 'SKILL.md'), skillContent);
  console.log(chalk.green(`  ✓ Skill installed: /openspec-e2e`));

  // Copy command
  mkdirSync(cmdDir, { recursive: true });
  const cmdContent = await readFile(CMD_SRC, 'utf-8');
  writeFileSync(join(cmdDir, 'e2e.md'), cmdContent);
  console.log(chalk.green(`  ✓ Command installed: /opsx:e2e`));
}

async function generateSeedTest(projectRoot: string) {
  const testsDir = join(projectRoot, 'tests', 'playwright');
  mkdirSync(testsDir, { recursive: true });

  const seedPath = join(testsDir, 'seed.spec.ts');
  if (existsSync(seedPath)) {
    console.log(chalk.gray('  - seed.spec.ts already exists, skipping'));
    return;
  }

  const seedContent = await readFile(TEMPLATE_DIR + '/seed.spec.ts', 'utf-8');
  writeFileSync(seedPath, seedContent);
  console.log(chalk.green('  ✓ Generated: tests/playwright/seed.spec.ts'));
  console.log(chalk.gray('  (Customize BASE_URL and selectors for your app)'));
}

function execCmd(
  cmd: string,
  name: string,
  silent = false
): boolean {
  try {
    execSync(cmd, { stdio: 'pipe' });
    if (!silent) console.log(chalk.green(`  ✓ ${name} found`));
    return true;
  } catch {
    if (!silent) console.log(chalk.yellow(`  ⚠ ${name} not found`));
    return false;
  }
}
