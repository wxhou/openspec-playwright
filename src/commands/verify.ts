import { resolve } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { runNativeVerify, NativeVerifyResult } from '../lib/openspec.js';
import { runPlaywrightVerify, PlaywrightVerifyResult } from '../lib/playwright-agent.js';
import { generateReport } from '../lib/report.js';

export interface VerifyOptions {
  change?: string;
  skipNative?: boolean;
  skipPlaywright?: boolean;
}

export async function verify(options: VerifyOptions) {
  const change = options.change || 'default';
  const projectRoot = process.cwd();

  console.log(chalk.blue(`\n🧭 OpenSpec Verify for change: ${change}\n`));

  let nativeResult: NativeVerifyResult = { passed: false, details: '', issues: [] };
  let playwrightResult: PlaywrightVerifyResult = { passed: false, details: '', tests: [], failed: 0, attempts: 0 };

  // Layer 1: OpenSpec Native Verify
  if (!options.skipNative) {
    console.log(chalk.blue('─── Layer 1: OpenSpec Native Verify ───'));
    nativeResult = await runNativeVerify(change, projectRoot);
    if (nativeResult.passed) {
      console.log(chalk.green('  ✓ Native verify passed\n'));
    } else {
      console.log(chalk.yellow('  ⚠ Native verify had issues\n'));
    }
  }

  // Layer 2: Playwright E2E Verify
  if (!options.skipPlaywright) {
    console.log(chalk.blue('─── Layer 2: Playwright E2E Verify ───'));
    playwrightResult = await runPlaywrightVerify(change, projectRoot);
    if (playwrightResult.passed) {
      console.log(chalk.green('  ✓ Playwright E2E passed\n'));
    } else {
      console.log(chalk.red(`  ✗ Playwright E2E failed (${playwrightResult.tests.filter((t) => !t.passed).length} tests failed)\n`));
    }
  }

  // Generate combined report
  const combinedPassed = nativeResult.passed && playwrightResult.passed;
  const report = generateReport(change, nativeResult, playwrightResult, projectRoot);

  console.log(chalk.blue('─── Summary ───'));
  console.log(`  Native verify:  ${nativeResult.passed ? chalk.green('PASS') : chalk.yellow('PARTIAL/FAIL')}`);
  console.log(`  Playwright E2E: ${playwrightResult.passed ? chalk.green('PASS') : chalk.red('FAIL')}`);
  console.log(`  Overall:        ${combinedPassed ? chalk.green('PASS ✓') : chalk.red('FAIL ✗')}`);
  console.log(`\n  Report: ${chalk.gray(report)}\n`);

  if (!combinedPassed) {
    process.exit(1);
  }
}
