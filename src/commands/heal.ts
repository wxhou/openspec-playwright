import chalk from 'chalk';
import { runPlaywrightHealer } from '../lib/playwright-agent.js';

export interface HealOptions {
  change?: string;
}

export async function heal(options: HealOptions) {
  const change = options.change || 'default';
  const projectRoot = process.cwd();

  console.log(chalk.blue(`\n🔧 Playwright Healer for change: ${change}\n`));

  const result = await runPlaywrightHealer(change, projectRoot);

  if (result.passed) {
    console.log(chalk.green('\n✅ All tests passed!\n'));
  } else {
    console.log(chalk.red(`\n✗ ${result.failed} test(s) failed after ${result.attempts} attempts\n`));
    process.exit(1);
  }
}
