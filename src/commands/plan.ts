import chalk from 'chalk';
import { runPlaywrightPlanner } from '../lib/playwright-agent.js';

export interface PlanOptions {
  change?: string;
}

export async function plan(options: PlanOptions) {
  const change = options.change || 'default';
  const projectRoot = process.cwd();

  console.log(chalk.blue(`\n📋 Playwright Planner for change: ${change}\n`));
  console.log(chalk.gray('  Reading OpenSpec specs/ as PRD...\n'));

  await runPlaywrightPlanner(change, projectRoot);

  console.log(chalk.green('\n✅ Planner complete. Run `openspec-pw heal` to execute tests.\n'));
}
