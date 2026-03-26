import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function init(options: { change?: string }) {
  console.log(chalk.blue('Initializing OpenSpec + Playwright integration...\n'));

  const projectRoot = process.cwd();

  // 1. Check if OpenSpec is initialized
  const openspecDir = join(projectRoot, 'openspec');
  if (!existsSync(openspecDir)) {
    console.log(chalk.yellow('⚠ OpenSpec not initialized. Run `openspec init` first.'));
    console.log(chalk.gray('  Then run `openspec-pw init` again.\n'));
    return;
  }
  console.log(chalk.green('✓ OpenSpec directory found'));

  // 2. Run Playwright agent init
  console.log(chalk.blue('\nRunning `npx playwright init-agents --loop=claude`...\n'));
  try {
    execSync('npx playwright init-agents --loop=claude', {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    console.log(chalk.green('✓ Playwright Test Agents initialized'));
  } catch (e) {
    console.log(chalk.yellow('⚠ Playwright init-agents failed. Make sure Playwright is installed.'));
    console.log(chalk.gray('  Run: npm install -D @playwright/test && npx playwright install\n'));
  }

  // 3. Inject Playwright context into openspec/config.yaml
  const configPath = join(openspecDir, 'config.yaml');
  const playwrightContext = `
# Playwright Verify Integration (added by openspec-playwright)
# When /opsx:verify runs, these instructions guide Playwright E2E validation:
# 1. Read openspec/changes/<name>/specs/*.md as the PRD for test generation
# 2. Planner agent generates test plan in specs/playwright/test-plan.md
# 3. Generator agent creates tests in tests/playwright/*.spec.ts
# 4. Healer agent runs tests and auto-heals failures
# 5. Results are written to reports/playwright-verify.md

`;

  if (existsSync(configPath)) {
    const config = readFileSync(configPath, 'utf-8');
    if (config.includes('Playwright Verify Integration')) {
      console.log(chalk.green('✓ Playwright context already injected into config.yaml'));
    } else {
      writeFileSync(configPath, config + playwrightContext);
      console.log(chalk.green('✓ Injected Playwright context into config.yaml'));
    }
  } else {
    // Create minimal config
    writeFileSync(configPath, `schema: spec-driven\ncontext: |${playwrightContext}`);
    console.log(chalk.green('✓ Created config.yaml with Playwright context'));
  }

  // 4. Create directories
  const dirs = [
    join(projectRoot, 'tests', 'playwright'),
    join(projectRoot, 'openspec', 'reports'),
  ];
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }
  console.log(chalk.green('✓ Created directory structure'));

  console.log(chalk.blue('\n✅ OpenSpec + Playwright integration ready!\n'));
  console.log(chalk.gray('Next steps:'));
  console.log(chalk.gray('  1. Run openspec-pw verify --change <name>'));
  console.log(chalk.gray('  2. Or use /opsx:verify in Claude Code\n'));
}
