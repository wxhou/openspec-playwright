#!/usr/bin/env node
import { Command } from 'commander';
import { init } from './commands/init.js';
import { verify } from './commands/verify.js';
import { plan } from './commands/plan.js';
import { heal } from './commands/heal.js';

const program = new Command();

program
  .name('openspec-pw')
  .description('OpenSpec + Playwright Test Agents integration')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize project with OpenSpec + Playwright integration')
  .option('-c, --change <name>', 'change name to initialize', 'default')
  .action(init);

program
  .command('verify')
  .description('Run OpenSpec verify with Playwright E2E validation')
  .option('-c, --change <name>', 'change name to verify', 'default')
  .option('--skip-native', 'skip OpenSpec native verify')
  .option('--skip-playwright', 'skip Playwright E2E verify')
  .action(verify);

program
  .command('plan')
  .description('Run Playwright Planner only (generate test plan from specs)')
  .option('-c, --change <name>', 'change name', 'default')
  .action(plan);

program
  .command('heal')
  .description('Run Playwright Healer only (run tests with auto-heal)')
  .option('-c, --change <name>', 'change name', 'default')
  .action(heal);

program.parse();
